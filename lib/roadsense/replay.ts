import { createHash } from "node:crypto";
import { MODELS, type MetaClient } from "./meta-client";

// Recording and replay of Meta Model API calls, so an evaluation run can be
// repeated exactly and at no cost. A call's key is the hash of its method and
// arguments, with each image replaced by its own hash.

type Method = "chatJson" | "segment" | "editImage" | "generateImage";

/** Where a recording keeps the Muse Spark model id; call keys are 64 hex characters, so it can't clash. */
const SPARK_MODEL_KEY = "sparkModel";

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** JSON with keys sorted at every level and data URLs replaced by their hash. */
function stableJson(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value.startsWith("data:") ? `sha256:${sha256(value)}` : value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function recordingKey(method: Method, args: Record<string, unknown>): string {
  return sha256(`${method}\n${stableJson(args)}`);
}

/** Passes every call to `inner` and stores its response in `sink` under the call's key. */
export function createRecordingClient(inner: MetaClient, sink: Record<string, unknown>): MetaClient {
  sink[SPARK_MODEL_KEY] = inner.sparkModel;
  const record = async <T>(method: Method, args: Record<string, unknown>, call: () => Promise<T>): Promise<T> => {
    const response = await call();
    sink[recordingKey(method, args)] = response;
    return response;
  };
  return {
    sparkModel: inner.sparkModel,
    chatJson: (args) => record("chatJson", args, () => inner.chatJson(args)),
    segment: (args) => record("segment", args, () => inner.segment(args)),
    editImage: (args) => record("editImage", args, () => inner.editImage(args)),
    generateImage: (args) => record("generateImage", args, () => inner.generateImage(args)),
  };
}

/** Answers each call from `recordings`; a call that was never recorded is an error. */
export function createReplayClient(recordings: Record<string, unknown>): MetaClient {
  const replay = async <T>(method: Method, args: Record<string, unknown>): Promise<T> => {
    const key = recordingKey(method, args);
    if (!(key in recordings)) throw new Error(`no recording for this ${method} call`);
    return recordings[key] as T;
  };
  const sparkModel = recordings[SPARK_MODEL_KEY];
  return {
    sparkModel: typeof sparkModel === "string" ? sparkModel : MODELS.spark,
    chatJson: (args) => replay("chatJson", args),
    segment: (args) => replay("segment", args),
    editImage: (args) => replay("editImage", args),
    generateImage: (args) => replay("generateImage", args),
  };
}
