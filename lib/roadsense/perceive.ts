import { RoadsenseValidationError } from "./errors";
import { parseSceneFacts } from "./facts";
import type { MetaClient } from "./meta-client";
import { PERCEPTION_SYSTEM, PERCEPTION_USER } from "./prompts";
import { PERCEPTION_SCHEMA } from "./schemas";
import type { SceneFacts } from "./types";

/** Muse Spark reads the photo into scene facts. Output that fails validation gets one more try. */
export async function perceiveScene(client: MetaClient, imageDataUrl: string): Promise<{ facts: SceneFacts; costUsd: number }> {
  let costUsd = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      const { json, costUsd: cost } = await client.chatJson({
        system: PERCEPTION_SYSTEM,
        user: PERCEPTION_USER,
        imageDataUrl,
        schemaName: "scene_facts",
        schema: PERCEPTION_SCHEMA,
      });
      costUsd += cost;
      return { facts: parseSceneFacts(json), costUsd };
    } catch (err) {
      if (!(err instanceof RoadsenseValidationError) || attempt >= 2) throw err;
    }
  }
}
