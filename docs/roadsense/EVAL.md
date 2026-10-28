# RoadSense evaluation

Live run, 2026-10-28. Models: muse-spark-1.3-contributor (reasoning effort low), sam-3.1.

| Measure | Result | Target | Status |
|---|---|---|---|
| Answerable scenes answered right and checked | 17/24 (71%) | ≥ 90% | **MISSED** |
| Wrong answers marked checked | 0 | 0 | met |
| Answerable scenes left not sure | 6/24 | reported |  |
| Abstain scenes answered not sure | 5/5 (100%) | ≥ 80% | met |
| Out-of-scope scenes caught | 4/4 | reported |  |
| Valid citations | 56/56 (100%) | 100% | met |
| Valid structured output | 33/33 (100%) | 100% | met |
| Latency p50 / p95 | 20.9 s / 38.9 s | p95 ≤ 20 s | **MISSED** |
| Cost | $0.074 ($0.0023 a scene) | reported |  |

## By rule (answerable scenes)

| Rule | Scenes | Answered right and checked |
|---|---|---|
| anexo-i-light-amber | 2 | 2 |
| anexo-i-light-green | 3 | 3 |
| anexo-i-light-red | 1 | 1 |
| anexo-i-m-4-1 | 1 | 1 |
| anexo-i-m-4-2 | 1 | 1 |
| anexo-i-m-4-3 | 2 | 2 |
| anexo-i-m-6-3 | 1 | 1 |
| anexo-i-m-6-5 | 1 | 1 |
| rgc-133-1 | 10 | 10 |
| rgc-133-2 | 1 | 1 |
| rgc-56-1 | 7 | 7 |
| rgc-56-3 | 5 | 5 |
| rgc-56-4 | 1 | 1 |
| rgc-56-5 | 6 | 6 |
| rgc-57-1 | 4 | 0 |
| rgc-57-1-a | 2 | 0 |
| rgc-57-1-b | 1 | 1 |
| rgc-57-1-c | 2 | 1 |
| rgc-59-1 | 3 | 3 |
| rgc-65-1-a | 2 | 2 |
| rgc-67-1 | 1 | 1 |
| rgc-69 | 1 | 1 |

## Scenes not answered as expected

- unsigned-1: expected checked (yield), got disagree (proceed)
- unsigned-2: expected checked (proceed), got not_sure (proceed)
- unsigned-3: expected checked (proceed), got not_sure (proceed)
- roundabout-2: expected checked (yield), got not_sure (yield)
- emergency-2: expected checked (proceed), got not_sure (proceed)
- surface-1: expected checked (yield), got not_sure (yield)
- surface-2: expected checked (proceed), got not_sure (proceed)

## How this evaluation works

- **Scenes.** The 33 curated scenes in `data/roadsense/scenes/index.json`:
  - 24 with a right-of-way answer;
  - 5 where the honest answer is "not sure": a sign behind a lorry, a hidden right-hand approach, a light washed out by the sun, a junction at night in the rain, and a sign behind branches;
  - 4 outside RoadSense's scope: the UK, the US, a motorway, and a police officer directing traffic.

  The images are generated with Muse Image. Each scene's ground truth was written by looking at the image, never copied from model output. It agrees with the rule engine and was checked by an independent reviewer.
- **Run.** Each scene's published 1920 px image is analysed once, in English, by the pipeline the app uses:
  - perception (Muse Spark);
  - the rule engine;
  - the evidence check (SAM 3.1);
  - the decision (Muse Spark).

  Muse Spark runs at low reasoning effort, as in the app. It runs in contributor mode: the owner decided on 2026-10-26 to use contributor mode for DriveIQ's own images, while learners' photos always use Standard mode.
- **Replay.** Every model response is saved in `data/roadsense/recordings/`. `npx tsx scripts/roadsense/eval.ts --mode replay` repeats the run from those files and gives the same numbers at no cost.
- **Scoring:**
  - An answerable scene counts as right only when the answer is "checked" and the model's obligation matches the ground truth.
  - A wrong answer marked "checked" is the failure that must never happen, so it is counted on its own.
  - "Not sure" on an answerable scene is neither right nor wrong.
  - Abstain scenes count as right only when the answer is "not sure". Out-of-scope scenes count as right only when the answer is "outside scope".
  - A citation is valid when it is a corpus rule that belongs to the scene: one of its expected rules, the engine's, or the excerpts retrieved for the model.

## Latency in the mode learners get

Contributor mode answers two to three times more slowly than Standard mode, so the latency above is not what learners see.

The same pipeline in Standard mode at low reasoning effort, on 8 of the scenes (`eval-latency-standard.md`), gave:
- p95 9.8 s;
- about $0.016 an analysis;
- 6 of 7 answerable scenes checked right, the abstain scene "not sure", and no wrong answer checked.

At the default reasoning effort, a run of the same 8 scenes took p95 22.5 s, which is why the app uses low effort.

## What the evaluation changed

These numbers are in-sample: the prompts, thresholds and settings below were tuned on these same 33 scenes.

- **Hidden signs.** In Standard mode, a crossroads whose sign stood behind a parked lorry came back checked "go". Perception now looks at the spot where the learner's sign would stand. It treats an empty spot in clear view as "no sign".
- **Image size.** At 1280 px, SAM missed small signs and lights: 7 of 8 scenes came back checked right at 1920 px, against 5 of 8 at 1280 px. So analysis images stay at 1920 px.
- **Evidence matching.** Correct signs and markings measured 0.45 and 0.49 overlap with SAM's boxes, so the threshold is now 0.4. SAM finds nothing for "emergency vehicle" or "tram", so it is asked for an "ambulance" and a "streetcar".
- **Reasoning effort.** Low effort halved latency in Standard mode, and no wrong answer was checked.

## What the final review changed (2026-10-27)

- **No badge without evidence.** An answer that rests on nothing SAM 3.1 can confirm is now "not sure", because the badge promises that SAM found what the answer depends on. Examples are "go" because nobody is coming, an empty roundabout entry, or an unpaved road. Five answerable scenes moved from checked to not sure (unsigned-2, unsigned-3, roundabout-2, surface-1, surface-2): 17 of 24 instead of 22.
- **Crossing roads.** A STOP or yield on the road to the left no longer gives the learner priority over an unsigned road on the right (art. 57.1). A priority-road sign on the crossing road, with no sign for the learner, is "not sure". No curated scene has either, so no number moved.
- **Order and paths.** Hidden signage now outranks a pedestrian on the crossing, and the crossing must be in the learner's path.
- **Scoring.** "Wrong answers marked checked" counts every kind of scene, and a decision rejected for its shape counts as invalid output. Neither changed a number.

## Known limits

- SAM 3.1 confirms where a sign, light or vehicle is, not its colour or type. A red light read as green, or a yield sign read as a STOP, would still be confirmed. Colour- and type-specific checks need a new live evaluation.

- A still photo cannot show whether an amber light is flashing. Amber is read as steady, and no scene claims a flashing light.
- The scenes are generated: real dashcam and phone photos are messier.
- 33 scenes is a small set: one scene moves a percentage by 3 to 4 points.
- At a roundabout entry, or when coming from an unpaved road, the answer is "give way" even with nobody in sight (`RULES.md`, "Standing duties").

## Typed what-ifs

Learners can type their own "What if…?" question. Muse Spark reads it as one of five kinds of change (a person in front covers both pedestrian edits) or as "none" before anything is drawn. How well it reads 59 phrases in four languages, including typos and attempts to give it instructions (12 of them added after the prompt was written, and not tuned on), is in `eval-understand.md`. Text with markup or braces reads as "none" without a model call.
