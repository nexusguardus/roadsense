// The Meta Model API client: request shapes taken from the Task 1 spike, retries
// on rate limits and server errors only, a hard timeout, and per-call cost from
// the published prices. fetch is replaced by a stand-in that records requests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// lib/ and components/ import through the "@/" alias and without extensions.
const ROOT = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    try {
      return nextResolve(target, context);
    } catch (err) {
      if (!specifier.startsWith(".") && !specifier.startsWith("@/")) throw err;
      return nextResolve(`${target}.ts`, context);
    }
  },
});

const { createMetaClient, MODELS, MetaApiError, MetaTimeoutError } = await import("../lib/roadsense/meta-client.ts");
const { RoadsenseValidationError } = await import("../lib/roadsense/errors.ts");

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: any;
}

/** A fetch stand-in that replies from `replies` in order and records every request. */
function fakeFetch(replies: (() => Response)[]) {
  const calls: Captured[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    return reply();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const json = (status: number, body: unknown) => () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const CHAT_OK = json(200, {
  choices: [{ message: { content: '{"signs":[]}' } }],
  usage: { prompt_tokens: 1500, completion_tokens: 800, prompt_tokens_details: { cached_tokens: 0 } },
});
const IMAGE_OK = json(200, { data: [{ b64_json: "AAAA" }], output_format: "webp" });
const noSleep = async () => {};
const client = (fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) =>
  createMetaClient({ apiKey: "k", fetchImpl, sleep: noSleep, ...extra });
const CHAT_ARGS = { system: "s", user: "u", imageDataUrl: "data:image/webp;base64,AAAA", schemaName: "signs", schema: { type: "object" } };

test("sends bearer auth, the model and the strict schema", async () => {
  const { impl, calls } = fakeFetch([CHAT_OK]);
  const result = await client(impl).chatJson(CHAT_ARGS);
  assert.deepEqual(result.json, { signs: [] });
  assert.equal(calls[0].url, "https://api.meta.ai/v1/chat/completions");
  assert.equal(calls[0].headers.Authorization, "Bearer k");
  assert.equal(calls[0].body.model, "muse-spark-1.3");
  assert.equal(calls[0].body.response_format.json_schema.strict, true);
  assert.deepEqual(calls[0].body.messages[1].content[1], { type: "image_url", image_url: { url: CHAT_ARGS.imageDataUrl } });
});

test("uses Standard mode unless contributor mode is asked for", async () => {
  const standard = fakeFetch([CHAT_OK]);
  await client(standard.impl).chatJson(CHAT_ARGS);
  assert.equal(standard.calls[0].body.model, "muse-spark-1.3");
  const contributor = fakeFetch([CHAT_OK]);
  await client(contributor.impl, { sparkMode: "contributor" }).chatJson(CHAT_ARGS);
  assert.equal(contributor.calls[0].body.model, "muse-spark-1.3-contributor");
  assert.doesNotMatch(MODELS.spark, /contributor/);
});

test("names the Muse Spark model it calls", () => {
  const { impl } = fakeFetch([CHAT_OK]);
  assert.equal(client(impl).sparkModel, "muse-spark-1.3");
  assert.equal(client(impl, { sparkMode: "contributor" }).sparkModel, "muse-spark-1.3-contributor");
});

test("contributor calls are billed at contributor prices", async () => {
  const { impl } = fakeFetch([CHAT_OK]);
  const { costUsd } = await client(impl, { sparkMode: "contributor" }).chatJson(CHAT_ARGS);
  assert.ok(Math.abs(costUsd - 0.00031) < 1e-12, String(costUsd));
});

test("contributor mode only changes Muse Spark", async () => {
  const { impl, calls } = fakeFetch([json(200, { output: [] }), IMAGE_OK]);
  const contributor = client(impl, { sparkMode: "contributor" });
  await contributor.segment({ imageDataUrl: "data:image/webp;base64,AAAA", concept: "car" });
  await contributor.editImage({ imageDataUrl: "data:image/webp;base64,AAAA", prompt: "swap" });
  assert.deepEqual(calls.map((c) => c.body.model), ["sam-3.1", "muse-image-1.0"]);
});

test("reasoning effort is sent only when set", async () => {
  const plain = fakeFetch([CHAT_OK]);
  await client(plain.impl).chatJson(CHAT_ARGS);
  assert.equal("reasoning_effort" in plain.calls[0].body, false);
  const low = fakeFetch([CHAT_OK]);
  await client(low.impl, { reasoningEffort: "low" }).chatJson(CHAT_ARGS);
  assert.equal(low.calls[0].body.reasoning_effort, "low");
});

test("retries 429 then succeeds", async () => {
  const { impl, calls } = fakeFetch([json(429, { error: {} }), CHAT_OK]);
  await client(impl).chatJson(CHAT_ARGS);
  assert.equal(calls.length, 2);
});

test("gives up after two retries on 503", async () => {
  const { impl, calls } = fakeFetch([json(503, { error: {} })]);
  await assert.rejects(client(impl).chatJson(CHAT_ARGS), (err: unknown) => err instanceof MetaApiError && err.status === 503);
  assert.equal(calls.length, 3);
});

test("does not retry 400", async () => {
  const { impl, calls } = fakeFetch([json(400, { error: { message: "bad" } })]);
  await assert.rejects(client(impl).chatJson(CHAT_ARGS), (err: unknown) => err instanceof MetaApiError && err.status === 400);
  assert.equal(calls.length, 1);
});

test("times out at timeoutMs", async () => {
  const hanging = ((_url: string, init: RequestInit) =>
    new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as unknown as typeof fetch;
  await assert.rejects(client(hanging, { timeoutMs: 20 }).chatJson(CHAT_ARGS), MetaTimeoutError);
});

test("chat cost uses token prices", async () => {
  const { impl } = fakeFetch([CHAT_OK]);
  const { costUsd } = await client(impl).chatJson(CHAT_ARGS);
  assert.ok(Math.abs(costUsd - 0.005275) < 1e-9, String(costUsd));
});

test("cached prompt tokens are billed at the cached price", async () => {
  const { impl } = fakeFetch([
    json(200, { choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 1000, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 1000 } } }),
  ]);
  const { costUsd } = await client(impl).chatJson(CHAT_ARGS);
  assert.ok(Math.abs(costUsd - 0.00015) < 1e-12, String(costUsd));
});

test("non-JSON content is a validation error", async () => {
  const { impl } = fakeFetch([json(200, { choices: [{ message: { content: "not json" } }], usage: {} })]);
  await assert.rejects(client(impl).chatJson(CHAT_ARGS), RoadsenseValidationError);
});

test("SAM asks for confidence in metadata and returns the output text", async () => {
  const text = readFileSync(new URL("tests/fixtures/roadsense/sam-traffic-sign.txt", ROOT), "utf8");
  const { impl, calls } = fakeFetch([json(200, { output: [{ type: "message", content: [{ type: "output_text", text }] }] })]);
  const result = await client(impl).segment({ imageDataUrl: "data:image/webp;base64,AAAA", concept: "traffic sign" });
  assert.equal(result.text, text);
  assert.equal(result.costUsd, 0.0025);
  assert.equal(calls[0].url, "https://api.meta.ai/v1/responses");
  assert.equal(calls[0].body.model, "sam-3.1");
  assert.deepEqual(calls[0].body.metadata, { include_confidence: "true" });
  assert.equal("include_confidence" in calls[0].body, false);
});

test("image edit returns a data URL", async () => {
  const { impl, calls } = fakeFetch([IMAGE_OK]);
  const result = await client(impl).editImage({ imageDataUrl: "data:image/webp;base64,BBBB", prompt: "swap" });
  assert.equal(result.imageDataUrl, "data:image/webp;base64,AAAA");
  assert.equal(result.costUsd, 0.01);
  assert.equal(calls[0].url, "https://api.meta.ai/v1/images/edits");
  assert.deepEqual(calls[0].body.images, [{ image_url: "data:image/webp;base64,BBBB" }]);
});

test("image generation asks for WebP at 3:2", async () => {
  const { impl, calls } = fakeFetch([IMAGE_OK]);
  await client(impl).generateImage({ prompt: "a junction" });
  assert.equal(calls[0].url, "https://api.meta.ai/v1/images/generations");
  assert.equal(calls[0].body.size, "1536x1024");
  assert.equal(calls[0].body.output_format, "webp");
});
