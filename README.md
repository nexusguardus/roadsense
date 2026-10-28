# RoadSense

**Who goes first at this junction?** Show RoadSense a photo taken from the driver's seat in Spain. It tells you what to do, cites the exact article of Spain's traffic rules (the Reglamento General de Circulación, word for word from the BOE), and outlines on the photo the signs, lights and vehicles the answer depends on.

It marks an answer **checked** only when an independent rule engine and the AI reach the same answer on evidence that SAM 3.1 found in the photo. When that evidence isn't there, it says **not sure**, and when the photo isn't a Spanish junction, **out of scope**.

RoadSense is part of DriveIQ, a theory-exam app for the Spanish driving test (permiso B): **https://www.driveiq.es/roadsense** (es, en, fr, ar).

## How it uses Meta's models

- **Muse Spark 1.3** reads the photo into structured facts: the junction, its signs, lights and road markings and whom they govern, the road users and where they come from, and what is hidden. It then explains the decision in the learner's language, citing only the BOE excerpts it was given, with the tempting wrong answer and why it is wrong.
- **SAM 3.1** takes a second, independent look. It segments each object the decision depends on ("traffic sign", "traffic light", "person", "ambulance"…) and confirms a fact only when its box overlaps Muse Spark's: at least 0.4 of the smaller box, at a comparable size. The confirmed boxes are the outlines learners see.
- **Muse Image** makes the what-if edits (swap a STOP sign for a yield sign, turn the light red, bring in an ambulance…). The edited photo is read again and analysed only if the intended change took and nothing else the rule engine reads moved. Learners can also type a what-if in their own words, such as "what if a person comes in front": Muse Spark reads it as one of those edits, or answers that RoadSense can't test it yet. Muse Image also generated the 33 curated scenes.
- A **rule engine** in TypeScript decides the learner's obligation from the facts on its own: the order of preference between signals (art. 133), intersections and priority to the right (arts. 56–59), pedestrians (art. 65, and art. 46.1.a for someone stepping into the road) and emergency vehicles (arts. 67–69) and the light and marking definitions of Anexo I. The certainty comes from comparing the two answers.

`docs/roadsense/ARCHITECTURE.md` walks through the pipeline; `docs/roadsense/RULES.md` lists every rule the engine applies.

## Run it without a key

Node.js 22.15 or later:

```
npm install
npm test
npx tsx scripts/roadsense/eval.ts --mode replay --effort low
npx tsx scripts/roadsense/eval-understand.ts
npx tsx scripts/roadsense/analyze.ts public/roadsense/scenes/lights-2.webp --replay
```

Replay mode answers every model call from the recordings in `data/roadsense/recordings`, so the evaluation repeats exactly, at no cost, and rewrites `docs/roadsense/EVAL.md` with the same numbers (`--effort low` only labels the run as it was recorded). A live run needs a Meta Model API key, read from the `MODEL_API_KEY` environment variable or from `.env.local`: `npx tsx scripts/roadsense/analyze.ts <photo> --locale es` analyses your own photo in Standard mode.

## Evaluation

33 curated scenes generated with Muse Image: 24 with a right-of-way answer, 5 where the honest answer is "not sure" (a sign behind a lorry, a hidden approach, a light washed out by the sun…) and 4 outside the scope (the UK, the US, a motorway, a police officer directing traffic). Ground truth was written by looking at each image and checked by an independent reviewer.

| Measure | Result | Target |
|---|---|---|
| Answerable scenes answered right and checked | 17/24 (71%) | ≥ 90% (missed) |
| Wrong answers marked checked | 0 | 0 |
| Abstain scenes answered not sure | 5/5 | ≥ 80% |
| Out-of-scope scenes caught | 4/4 | |
| Valid citations | 56/56 | 100% |
| Valid structured output | 33/33 | 100% |
| Latency p95, contributor mode | 38.9 s | ≤ 20 s (missed) |
| Latency p95, Standard mode (8 scenes) | 9.8 s | ≤ 20 s |

The numbers are in-sample: the prompts and thresholds were tuned on these same scenes. An answer that rests on nothing the photo can confirm (nobody coming, an empty roundabout, a dirt road) is "not sure" by design, because the badge promises evidence. Six answerable scenes are not sure for that reason alone. `docs/roadsense/EVAL.md` has the full report, by rule, and what the evaluation changed.

## What is here

- `lib/roadsense`: the engine (perception, rule engine, SAM evidence, retrieval, decision, what-ifs, evaluation, recording and replay).
- `components/roadsense`: the React components of the RoadSense page. They use DriveIQ's Tailwind design tokens, so they render unstyled on their own.
- `data/roadsense`: the rule corpus (verbatim BOE excerpts with their hashes and version dates), BOE snapshots, the curated scenes with their ground truth and precomputed answers, and the evaluation recordings.
- `public/roadsense`: the scene, what-if and thumbnail images, all AI-generated.
- `scripts/roadsense`: the evaluation, the BOE corpus check and the command-line demo.
- `tests`: `node:test` suites, including a boundary test that keeps the engine and components free of DriveIQ imports.

## Built during the hackathon

Everything in this repository was written for the Meta Global AI Developer Hackathon, from 26 October 2026, on top of DriveIQ at the parent of commit 76098b1b, the hackathon's first commit (the approved design). The export checks that none of these files existed in DriveIQ before that commit.

DriveIQ's host code stays in DriveIQ's private repository: the page and its API routes, with their quotas, spend caps, logging and privacy controls. `docs/roadsense/ARCHITECTURE.md` describes what it does.

## Licence

Copyright © 2026 DriveIQ. All rights reserved. Source available for review; no licence to use, copy or modify is granted.
