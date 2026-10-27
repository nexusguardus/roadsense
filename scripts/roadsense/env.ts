import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** MODEL_API_KEY from .env.local in the repo root. Never printed. */
export function readModelKey(): string {
  const line = readFileSync(resolve(".env.local"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("MODEL_API_KEY="));
  const key = line?.slice("MODEL_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("MODEL_API_KEY is missing from .env.local");
  return key;
}

/** Runs `work` over `items`, at most `limit` at a time. */
export async function inPool<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: limit }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}
