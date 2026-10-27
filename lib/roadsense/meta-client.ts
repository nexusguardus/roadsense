import { RoadsenseValidationError } from "./errors";

// Client for the Meta Model API (https://api.meta.ai/v1), raw fetch like the
// repo's other model clients. Request shapes come from the Task 1 spike
// (docs/roadsense/notes/2026-10-27-spike.md).
//
// Standard mode is the default: learner uploads must never train Meta models.
// Contributor mode (cheaper; Meta may train on everything sent) exists only for
// Muse Spark and is used only for DriveIQ's own generated scenes, precompute and
// evaluation runs (owner, 2026-10-26).

export const MODELS = {
  spark: "muse-spark-1.3",
  sparkContributor: "muse-spark-1.3-contributor",
  sam: "sam-3.1",
  image: "muse-image-1.0",
} as const;

/** USD, from dev.meta.ai/docs/pricing-rate-limits. */
export const PRICES = {
  sparkInputPerM: 1.25,
  sparkCachedPerM: 0.15,
  sparkOutputPerM: 4.25,
  sparkContributorInputPerM: 0.1,
  sparkContributorCachedPerM: 0.002,
  sparkContributorOutputPerM: 0.2,
  samPerImage: 0.0025,
  imagePerOutput: 0.01,
} as const;

/** "contributor" only for content DriveIQ owns (generated scenes, precompute, evaluation), never learner uploads. */
export type SparkMode = "standard" | "contributor";

export type ReasoningEffort = "low" | "medium" | "high";

export interface MetaClient {
  /** The Muse Spark model id this client calls: Standard, or contributor for DriveIQ's own content. */
  readonly sparkModel: string;
  chatJson(args: {
    system: string;
    user: string;
    imageDataUrl?: string;
    schemaName: string;
    schema: Record<string, unknown>;
  }): Promise<{ json: unknown; costUsd: number }>;
  segment(args: { imageDataUrl: string; concept: string }): Promise<{ text: string; costUsd: number }>;
  editImage(args: { imageDataUrl: string; prompt: string }): Promise<{ imageDataUrl: string; costUsd: number }>;
  generateImage(args: { prompt: string }): Promise<{ imageDataUrl: string; costUsd: number }>;
}

export interface MetaClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Per request; the pipeline's 25 s budget sits above this. */
  timeoutMs?: number;
  /** Retries on 429 and 5xx only. */
  maxRetries?: number;
  /** Sent to Muse Spark only when set; the evaluation decides whether "low" is accurate enough. */
  reasoningEffort?: ReasoningEffort;
  /** Defaults to "standard". */
  sparkMode?: SparkMode;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export class MetaApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
  }
}

export class MetaTimeoutError extends Error {
  constructor(path: string, timeoutMs: number) {
    super(`Meta API ${path} timed out after ${timeoutMs} ms`);
    this.name = "MetaTimeoutError";
  }
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const BACKOFF_MS = [400, 1200];
const MAX_RETRY_AFTER_MS = 3000;

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

/** Prompt tokens at the input price (cached ones at the cached price), completion tokens (reasoning included) at the output price. */
function chatCost(usage: ChatUsage | undefined, mode: SparkMode): number {
  const prompt = usage?.prompt_tokens ?? 0;
  const cached = Math.min(usage?.prompt_tokens_details?.cached_tokens ?? 0, prompt);
  const completion = usage?.completion_tokens ?? 0;
  const [input, cachedPrice, output] =
    mode === "contributor"
      ? [PRICES.sparkContributorInputPerM, PRICES.sparkContributorCachedPerM, PRICES.sparkContributorOutputPerM]
      : [PRICES.sparkInputPerM, PRICES.sparkCachedPerM, PRICES.sparkOutputPerM];
  return ((prompt - cached) * input + cached * cachedPrice + completion * output) / 1_000_000;
}

function imageResult(body: unknown): { imageDataUrl: string; costUsd: number } {
  const b = body as { data?: { b64_json?: string }[]; output_format?: string };
  const b64 = b?.data?.[0]?.b64_json;
  if (!b64) throw new RoadsenseValidationError("image response has no data[0].b64_json");
  return { imageDataUrl: `data:image/${b.output_format ?? "png"};base64,${b64}`, costUsd: PRICES.imagePerOutput };
}

export function createMetaClient(options: MetaClientOptions): MetaClient {
  const baseUrl = options.baseUrl ?? "https://api.meta.ai/v1";
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const maxRetries = options.maxRetries ?? 2;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const sparkMode: SparkMode = options.sparkMode ?? "standard";
  const sparkModel = sparkMode === "contributor" ? MODELS.sparkContributor : MODELS.spark;

  async function post(path: string, payload: Record<string, unknown>): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchImpl(baseUrl + path, {
          method: "POST",
          headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) throw new MetaTimeoutError(path, timeoutMs);
        throw err;
      } finally {
        clearTimeout(timer);
      }
      if (res.ok) return res.json();
      if (RETRYABLE.has(res.status) && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after")) * 1000;
        await sleep(retryAfter > 0 && retryAfter <= MAX_RETRY_AFTER_MS ? retryAfter : BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
        continue;
      }
      const detail = await res.text().catch(() => "");
      throw new MetaApiError(res.status, `Meta API ${path} returned ${res.status}: ${detail.slice(0, 300)}`);
    }
  }

  return {
    sparkModel,

    async chatJson({ system, user, imageDataUrl, schemaName, schema }) {
      const content: Record<string, unknown>[] = [{ type: "text", text: user }];
      if (imageDataUrl) content.push({ type: "image_url", image_url: { url: imageDataUrl } });
      const body = (await post("/chat/completions", {
        model: sparkModel,
        ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        response_format: { type: "json_schema", json_schema: { name: schemaName, schema, strict: true } },
      })) as { choices?: { message?: { content?: string } }[]; usage?: ChatUsage };
      const raw = body?.choices?.[0]?.message?.content ?? "";
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new RoadsenseValidationError("Muse Spark returned content that is not JSON");
      }
      return { json, costUsd: chatCost(body?.usage, sparkMode) };
    },

    async segment({ imageDataUrl, concept }) {
      const body = (await post("/responses", {
        model: MODELS.sam,
        input: [
          {
            type: "message",
            role: "user",
            content: [
              { type: "input_text", text: concept },
              { type: "input_image", image_url: imageDataUrl },
            ],
          },
        ],
        // A top-level include_confidence is rejected; it belongs in metadata.
        metadata: { include_confidence: "true" },
      })) as { output?: { content?: { type?: string; text?: string }[] }[] };
      const text = (body?.output ?? [])
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text")
        .map((part) => part.text ?? "")
        .join("");
      return { text, costUsd: PRICES.samPerImage };
    },

    async editImage({ imageDataUrl, prompt }) {
      return imageResult(await post("/images/edits", { model: MODELS.image, prompt, images: [{ image_url: imageDataUrl }], n: 1 }));
    },

    async generateImage({ prompt }) {
      return imageResult(await post("/images/generations", { model: MODELS.image, prompt, n: 1, size: "1536x1024", output_format: "webp" }));
    },
  };
}
