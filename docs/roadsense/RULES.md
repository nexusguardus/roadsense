# RoadSense rule engine: what it decides and why

`lib/roadsense/engine.ts` decides what the learner (the camera) must do from the facts perception found. Only this decision can earn the "checked" badge. Every citation is a verbatim excerpt in `data/roadsense/corpus.json`, taken from the BOE consolidated text of the Reglamento General de Circulación (BOE-A-2003-23514) and checked against the live BOE by `scripts/roadsense/check-corpus.ts`.

The first rule that matches wins. "My" signs, lights and markings are only those that govern the learner's approach.

| # | When | Then | Cites |
|---|---|---|---|
| 1 | The scene is out of scope: another country, a traffic officer directing, or perception reports nothing to decide (no junction and no pedestrian crossing) | outside scope | none |
| 2 | An emergency vehicle has its lights on | let the emergency vehicle through: move aside or stop if needed, never run a red | arts. 67.1, 69 |
| 3 | The junction itself is unclear | not sure | none |
| 4 | A light's state is unclear | not sure | none |
| 5 | My light is steady red | stop at the light | Anexo I 4.2.a), art. 133.1 (+ art. 56.3 at a junction) |
| 6 | My light is steady amber | stop at the light, unless too close to stop safely (the excerpt says so) | Anexo I 4.2.c), art. 133.1 (+ art. 56.3 at a junction) |
| 7 | My light is green and a pedestrian is on the crossing in my path | not sure: art. 65.1 gives pedestrians priority "con independencia de otros supuestos" while green gives priority (4.2.e), so the corpus doesn't settle which wins | none |
| 8 | My light is green | go, without blocking the junction | Anexo I 4.2.e), arts. 133.1, 59.1 (+ art. 56.3 at a junction) |
| 9 | A pedestrian is on the crossing in my path, but no zebra or crossing sign is visible | not sure: art. 65.1.a) covers marked crossings only | none |
| 10 | A pedestrian is on a marked crossing in my path and I have a STOP (sign or marking) | stop, then give way | arts. 56.1, 56.5, 65.1.a), plus 133.1 (sign) or marking M-6.3, and M-4.3 when the zebra is visible |
| 11 | A pedestrian is on a marked crossing in my path | give way to the pedestrians | art. 65.1.a), plus marking M-4.3 when the zebra is visible |
| 12 | Signage on my approach is hidden (checked before rows 10 and 11) | not sure: what's hidden could be a higher-ranked light or sign | none |
| 13 | There is no junction (a light or a pedestrian crossing ahead would have decided above) | outside scope | none |
| 14 | I have a STOP sign | stop, then give way | arts. 56.1, 56.5, 133.1 (+ 133.2 if a yield sign or marking contradicts it) |
| 15 | I have a yield sign | give way | arts. 56.1, 56.5, 133.1 (+ 133.2 if a STOP marking contradicts it: the sign outranks the marking) |
| 16 | I have a priority-road sign | go | arts. 56.1, 56.4 (+ 133.1 and 133.2 if a STOP or yield marking contradicts it) |
| 17 | STOP is painted on my lane | stop, then give way | arts. 56.1, 56.5, marking M-6.3/M-6.4 (+ M-4.1 when the stop line is visible) |
| 18 | A yield triangle is painted on my lane | give way | arts. 56.1, 56.5, marking M-6.5 (+ M-4.2 when the yield line is visible) |
| 19 | Only a stop line is visible | not sure: the line only marks where to stop for a sign or light I can't see | none |
| 20 | It's a roundabout and I'm approaching the entry | give way to traffic already on it | art. 57.1.c) |
| 21 | The road crossing mine (left or right) has a STOP or yield of its own, as a sign or painted, and I have none | go: its drivers must give way to me. It binds only them: a vehicle from an unsigned road on my right still has priority (row 27), and with only the left road signed, a hidden right approach is not sure. A priority-road sign for the crossing road, with no sign of my own, is not sure: the corpus has no rule for my duty then | arts. 56.1, 56.5 |
| 22 | A tram is crossing or approaching | give way to the tram | art. 57.1.b) |
| 23 | The road surface is unclear | not sure | none |
| 24 | My road is unpaved and the other is paved | give way | art. 57.1.a) |
| 25 | My road is paved and the other is unpaved | go | art. 57.1.a) |
| 26 | The approach on my right is hidden | not sure | none |
| 27 | A vehicle is coming from my right | give way | art. 57.1 |
| 28 | Otherwise | go: no duty to give way, because art. 57.1 binds only towards vehicles on the right | art. 57.1 |

## Notes

- **Flashing amber and switched-off lights** don't regulate the junction: the decision falls through to the signs and general rules. With a flashing amber light the decision also cites Anexo I 4.2.d), which says it means extra care and doesn't cancel other signs. A flashing red light (4.2.b) is not in v1.
- **A yield line on its own** falls back to the general rules (Anexo I M-4.2: "cuando no haya ninguna señal de prioridad, por aplicación de las normas que rigen esta"). That holds on the crossing road too: a dashed line across the road on my right leaves its traffic with priority to the right (found on a curated scene, 2026-10-26).
- **Standing duties** (rows 20 and 24): "give way" holds even when nobody is visible on the ring or on the paved road. The learner's approach is the one that gives way there, and the far side of a ring is rarely all in view. Priority to the right (row 27) is different: it binds only towards a vehicle actually coming from the right, so an empty unsigned crossroads is "go" (row 28).
- **Signals for the crossing road** (row 21) count only as STOP or yield signs, a painted STOP or a painted yield triangle that perception says govern the road on my left or right. A sign for the road ahead doesn't settle priority between crossing roads, and at a roundabout every entry gives way, so other entries' signs change nothing (row 20 comes first).
- **Signs cited through art. 56:** since RD 465/2025 the BOE publishes the vertical-sign catalogue as images. STOP, yield and priority-road signs are therefore cited through the text of art. 56.5 and 56.4, which name them.
- **Facts perception must report correctly** (see the perception prompt):
  - "roundabout" means the learner is approaching the entry; a learner already on the ring is out of scope;
  - a null paved/unpaved value means no difference, so perception reports `surface_unclear` whenever it can't tell;
  - "on the crossing ahead" means on a crossing in the learner's path.
- **Retrieval** (`lib/roadsense/retrieve.ts`) lets the model also cite:
  - art. 58.1 (how to give way) and art. 59.1 (don't block the junction) whenever the learner must give way;
  - art. 57.1 whenever a sign, marking or light decided, so the model can explain why priority to the right is the tempting wrong answer.
- **Reviewed 2026-10-26** by an independent reviewer against the excerpts. Its findings and the calls made on them are in the build ledger.
