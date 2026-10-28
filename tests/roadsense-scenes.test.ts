// The curated scene library: enough scenes of each kind, ground truth the engine
// agrees with, every engine rule shown somewhere, images on disk, and precomputed
// answers that are right or honestly "not sure" for every scene learners can pick.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

const { scenesFrom, thumbnailPath } = await import("../lib/roadsense/scenes.ts");
const { parseSceneFacts } = await import("../lib/roadsense/facts.ts");
const { decideObligation } = await import("../lib/roadsense/engine.ts");
const { RULE_IDS } = await import("../lib/roadsense/corpus.ts");

const scenes = scenesFrom(JSON.parse(readFileSync(new URL("data/roadsense/scenes/index.json", ROOT), "utf8")));
const LOCALES = ["es", "en", "fr", "ar"] as const;
/**
 * Every rule the engine can cite, less two no curated scene can show: art. 58.1 (how to give
 * way) is only retrieved for the model, and a still photo cannot show that an amber light is
 * flashing (Anexo I 4.2.d), so no scene may claim it.
 */
const ENGINE_RULES = RULE_IDS.filter((id: string) => id !== "rgc-58-1" && id !== "anexo-i-light-amber-flashing");
const STATUS_FOR_KIND = { answerable: "decided", abstain: "insufficient", out_of_scope: "out_of_scope" } as const;

/** What a shown scene's answer may be: right and checked, or honestly not sure (design: no wrong answer marked "checked"). */
function acceptable(expected: (typeof scenes)[number]["expected"], result: (typeof scenes)[number]["precomputed"]["es"]): boolean {
  if (expected.kind === "abstain") return result.certainty === "not_sure";
  if (expected.kind === "out_of_scope") return result.certainty === "outside_scope";
  if (result.certainty === "not_sure") return true;
  return result.certainty === "checked" && result.model?.obligation === expected.obligation;
}

test("at least 30 scenes, 5 abstain and 3 out of scope", () => {
  assert.ok(scenes.length >= 30, `${scenes.length} scenes`);
  assert.ok(scenes.filter((s) => s.expected.kind === "abstain").length >= 5);
  assert.ok(scenes.filter((s) => s.expected.kind === "out_of_scope").length >= 3);
});

test("ground truth is valid facts and matches the engine", () => {
  for (const scene of scenes) {
    const verdict = decideObligation(parseSceneFacts(scene.facts));
    assert.equal(verdict.status, STATUS_FOR_KIND[scene.expected.kind], scene.id);
    assert.equal(verdict.obligation, scene.expected.obligation, scene.id);
    assert.deepEqual(verdict.ruleIds, scene.expected.ruleIds, scene.id);
  }
});

test("every engine rule has a scene", () => {
  const covered = new Set(scenes.flatMap((s) => s.expected.ruleIds));
  assert.deepEqual(
    ENGINE_RULES.filter((id: string) => !covered.has(id)),
    [],
  );
});

test("every image file exists", () => {
  const paths = scenes.flatMap((s) => [s.imagePath, ...s.whatIfs.map((w) => w.imagePath)]);
  assert.deepEqual(
    paths.filter((path) => !existsSync(new URL(`public${path}`, ROOT))),
    [],
  );
});

test("precomputed results exist for all four locales", () => {
  for (const scene of scenes) {
    for (const locale of LOCALES) {
      assert.ok(scene.precomputed[locale]?.certainty, `${scene.id} ${locale}`);
      for (const whatIf of scene.whatIfs) assert.ok(whatIf.precomputed[locale]?.certainty, `${scene.id} ${whatIf.key} ${locale}`);
    }
  }
});

test("shown scenes are right or honestly not sure", () => {
  for (const scene of scenes.filter((s) => s.shown)) {
    for (const locale of LOCALES) {
      const result = scene.precomputed[locale];
      assert.ok(acceptable(scene.expected, result), `${scene.id} ${locale}: ${result.certainty}`);
    }
  }
});

test("shown scenes' what-ifs are checked or honestly not sure", () => {
  for (const scene of scenes.filter((s) => s.shown)) {
    for (const whatIf of scene.whatIfs) {
      for (const locale of LOCALES) {
        const { certainty } = whatIf.precomputed[locale];
        assert.ok(certainty === "checked" || certainty === "not_sure", `${scene.id} ${whatIf.key} ${locale}: ${certainty}`);
      }
    }
  }
});

test("every shown scene has a small thumbnail for the picker", () => {
  for (const scene of scenes.filter((s: { shown: boolean }) => s.shown)) {
    const file = new URL(`public${thumbnailPath(scene)}`, ROOT);
    assert.ok(existsSync(file), `${scene.id}: no thumbnail at ${thumbnailPath(scene)}`);
    // The picker shows 33 of them: each stays well under the 1920 px scene image.
    assert.ok(readFileSync(file).length < 60_000, `${scene.id}: thumbnail over 60 KB`);
  }
});

// Typed what-ifs (2026-10-27 redesign): every answerable example offers the what-ifs its facts
// allow, generated from the facts its answer was read with, minus the ones review dropped.
const { DROPPED_WHATIFS } = await import("../lib/roadsense/scenes.ts");
const { proposeEdits, editKey } = await import("../lib/roadsense/edits.ts");

test("no dropped what-if is in the index", () => {
  assert.ok(DROPPED_WHATIFS.includes("conflict-2|set_light:l1:red") && DROPPED_WHATIFS.includes("conflict-1|remove_sign:s1"));
  for (const scene of scenes) {
    for (const whatIf of scene.whatIfs) assert.ok(!DROPPED_WHATIFS.includes(`${scene.id}|${whatIf.key}`), `${scene.id} ${whatIf.key}`);
  }
});

test("every shown scene's what-ifs are edits its facts offer", () => {
  for (const scene of scenes.filter((s) => s.shown)) {
    const offered = proposeEdits(scene.precomputed.es.facts).map(editKey);
    for (const whatIf of scene.whatIfs) assert.ok(offered.includes(whatIf.key), `${scene.id}: ${whatIf.key} is not in ${offered.join(", ")}`);
  }
});
