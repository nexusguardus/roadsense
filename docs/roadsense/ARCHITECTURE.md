# RoadSense architecture

RoadSense answers one question about a photo taken from the driver's seat: what must the driver do at the junction ahead, under Spain's traffic rules? Two independent paths answer it, a rule engine and Muse Spark, and SAM 3.1 checks the evidence both depend on. Only when all three agree is the answer marked "checked".

## The pipeline

`analyzeScene` (`lib/roadsense/pipeline.ts`) runs these stages. The time budget is checked before each one, so a timeout never leaves a call running.

1. **Perceive** (`perceive.ts`, `prompts.ts`). Muse Spark turns the photo into `SceneFacts` (`types.ts`), with structured output limited to closed vocabularies (`schemas.ts`, `vocabulary.ts`):
   - the junction type and whether each road is paved;
   - signs, lights and markings, each with the approach it governs (the learner's own, left, right or ahead);
   - road users and where they come from;
   - boxes on a 0–1000 grid, a confidence for each fact, and unknowns such as `ego_signage_hidden`;
   - whether the photo is in scope at all.

   An invalid reply is retried once.
2. **Check** (`engine.ts`). `decideObligation(facts)` is a deterministic rule engine. It returns one of three statuses: `decided`, `insufficient` (something it needs is hidden) or `out_of_scope`. With it come the obligation, the rule ids and the facts the decision depends on.
   - It follows art. 133's order of preference: officers, temporary signals, lights, signs, markings.
   - It covers arts. 56–59 with the 57.1 exceptions, art. 65 (pedestrians), arts. 67–69 (emergency vehicles) and Anexo I.
   - `docs/roadsense/RULES.md` is its table, row by row.
3. **Confirm** (`evidence.ts`, `sam.ts`). SAM 3.1 segments the concept of each fact the decision depends on, at most five concepts per photo. A fact is confirmed when one detection covers at least 0.4 of the smaller of the two boxes, at a comparable size (area ratio of at least 0.25).
4. **Retrieve** (`retrieve.ts`, `corpus.ts`). A deterministic lookup from facts to rule ids. Each rule's excerpt in `data/roadsense/corpus.json` is the BOE consolidated text, word for word, with its sha256, its version date and plain explanations in four languages. `scripts/roadsense/check-corpus.ts` fetches the BOE again and fails if an excerpt no longer matches.
5. **Decide** (`decide.ts`). Muse Spark decides from the facts and the retrieved excerpts only:
   - structured output, which may cite only the retrieved ids;
   - written in the learner's language;
   - with the tempting wrong answer and why the law rules it out.

   Confirm and decide run in parallel.
6. **Certainty** (`certaintyOf`):
   - `outside_scope`;
   - `not_sure` when:
     - the engine lacks a fact;
     - the answer rests on no fact SAM can confirm (nobody coming, the type of junction, the road surface);
     - a critical fact is unconfirmed or doubtful (confidence under 0.6, or a SAM score under 0.5);
     - or the decision failed validation;
   - `disagree` when the answers differ, or the model doesn't cite a rule the engine used;
   - otherwise `checked`.

## What-if edits

`proposeEdits(facts)` (`edits.ts`) offers up to four edits from a closed list: swap the learner's STOP and yield signs, remove the sign, switch the light between red and green, add a pedestrian on the crossing, or add an ambulance with its lights on.

`runWhatIf` (`whatif.ts`) then works in three steps:
1. Muse Image makes the edit.
2. Muse Spark reads the edited photo again.
3. `verifyEdit` accepts it only if the intended change is there and nothing else the engine reads has changed, so the answer can't move for the wrong reason. Only then is the edited photo analysed.

The curated scenes ship with pre-generated what-ifs, each checked by an AI reviewer.

## Models and modes

`meta-client.ts` calls the Meta Model API:

| Model | Used for | Mode and settings |
|---|---|---|
| Muse Spark 1.3 (`muse-spark-1.3`) | learners' photos | Standard mode, which doesn't train on them; low reasoning effort, about 10 s p95 |
| Muse Spark 1.3 (`-contributor`) | DriveIQ's own generated scenes and evaluation runs | contributor mode, never for learners' photos |
| SAM 3.1 | the evidence check | through `/responses`, with confidence scores |
| Muse Image | scene generation and what-if edits | |

## Evaluation and replay

`scripts/roadsense/eval.ts` analyses the 33 curated scenes and scores them with `scoreRun` (`eval.ts`). An answerable scene counts only when it is checked and right, and a wrong answer marked checked is counted on its own.

`--record` saves every model response, keyed by a hash of the call with each image replaced by its own hash (`replay.ts`). `--mode replay` repeats the run from those files with no key and no cost. The results are in `docs/roadsense/EVAL.md`.

## The page

`components/roadsense` holds the RoadSense page's React components:

| File | What it does |
|---|---|
| `RoadSenseApp` | holds the state |
| `ScenePicker` | the grid of curated scenes |
| `UploadPanel` | the photo upload, with the privacy notice before the button |
| `EvidenceImage` | solid outlines where SAM 3.1 confirmed a fact, dashed where it didn't |
| `ResultCard` | the badge with its explanation, the answer, the BOE excerpt and the explanation |
| `WhatIfBar` | the what-if chips |
| `useAnalysisStream` | reads the streamed stages and the result |
| `resizeImage` | redraws a photo at 1920 px as JPEG, which drops its EXIF data |

The copy for es, en, fr and ar is in `copy-table.ts`.

## What stays in DriveIQ

These parts run in DriveIQ and are not in this repository:

- **The page itself.** It is off until switched on, and offers the shortest exam pass that covers the learner's exam date.
- **`POST /api/roadsense/analyze` and `/whatif`.** Curated scenes answer with their precomputed results, free. Live analyses stream NDJSON and go through these checks, in order:
  1. a burst limit;
  2. a daily quota by plan;
  3. a kill switch;
  4. a daily and a total spend cap, failing closed.

  The quota is refunded on errors, and every call's cost is counted. Uploads are at most 3 MB, have their metadata stripped again, and always use Standard mode.
- **An analysis log, kept 90 days.** It holds the result, the facts, the rule ids and the cost. It never keeps the photo, and guests' IP addresses are stored only as a salted hash. DriveIQ's privacy policy names Meta as the processor.
