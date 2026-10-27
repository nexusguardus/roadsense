# RoadSense evaluation

Live run, 2026-10-27. Models: muse-spark-1.3 (reasoning effort low), sam-3.1.

| Measure | Result | Target | Status |
|---|---|---|---|
| Answerable scenes answered right and checked | 6/7 (86%) | ≥ 90% | **MISSED** |
| Wrong answers marked checked | 0 | 0 | met |
| Answerable scenes left not sure | 1/7 | reported |  |
| Abstain scenes answered not sure | 1/1 (100%) | ≥ 80% | met |
| Out-of-scope scenes caught | 0/0 | reported |  |
| Valid citations | 15/15 (100%) | 100% | met |
| Valid structured output | 8/8 (100%) | 100% | met |
| Latency p50 / p95 | 7.4 s / 9.8 s | p95 ≤ 20 s | met |
| Cost | $0.126 ($0.0158 a scene) | reported |  |

## By rule (answerable scenes)

| Rule | Scenes | Answered right and checked |
|---|---|---|
| anexo-i-light-green | 1 | 1 |
| anexo-i-light-red | 1 | 1 |
| anexo-i-m-4-3 | 1 | 1 |
| rgc-133-1 | 4 | 4 |
| rgc-56-1 | 2 | 2 |
| rgc-56-3 | 2 | 2 |
| rgc-56-5 | 2 | 2 |
| rgc-57-1 | 1 | 0 |
| rgc-57-1-c | 1 | 1 |
| rgc-59-1 | 1 | 1 |
| rgc-65-1-a | 1 | 1 |

## Scenes not answered as expected

- unsigned-1: expected checked (yield), got not_sure
