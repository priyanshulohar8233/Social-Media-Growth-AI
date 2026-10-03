# Brain Benchmarks — Memory Flywheel Proof

> Claim nahi, numbers. All figures below were measured, not estimated.
> Methodology, date, and sample sizes are stated with every number so anyone
> can reproduce them (`node scripts/eval-brain.mjs`, `npm run test:unit`).

## How to reproduce

1. `npm run test:unit` — Vitest unit + golden sets (`tests/unit/`, `eval/golden/*.json`).
2. `node scripts/eval-brain.mjs` — DB metrics from real rows (no server needed).
3. Scratch run (temporary workspace via public APIs, deleted afterwards) —
   register → company → seed → 3× `content_performance` on one topic +
   1× `user_feedback` → `/brain/learn` reconcile → verify 1 insight, reject 1 →
   3 approvals decided (2 approve, 1 reject) → eval → full cleanup.

## Measured run — 2026-10-03 (scratch workspace, n small, cleaned up after)

| Metric | Value | n |
|--------|-------|---|
| Insight precision (validated+active / decided) | **0.50** | 2 decided of 8 total |
| Calibration 0.0–0.1 decile verify-rate | 0.00 | 1 (rejected) |
| Calibration 0.9–1.0 decile verify-rate | 1.00 | 1 (verified) |
| Promoted LEARNED_* memories | 0 total | — (no insight reached ACTIVE in a fresh workspace) |
| Approval learning coverage (decided approvals with decision memory) | **0.67** (2/3) | 3 decided |

Reading, honestly stated:

- **Calibration direction is correct** (high-confidence verified, low-confidence rejected),
  but n=2 is a smoke signal, not proof. Re-run `eval-brain.mjs` on a production-aged
  database for a real curve.
- **Approval coverage 2/3**: the 2 approved decisions each recorded a VERIFIED decision
  memory; the rejected one did not produce a linked memory — a known gap to close
  (rejections should also teach).
- **Promotion needs volume**: `promoteToMemories()` only fires on ACTIVE FACT/OBSERVATION
  (confidence ≥ 0.82, evidence ≥ 2). Fresh workspaces legitimately promote nothing.
  Do not tune thresholds down to manufacture promotions.

## Golden sets (deterministic, CI-runnable)

`eval/golden/` — `sentiment.json`, `intent.json`, `threat.json`,
`confidence-ordering.json`, evaluated by `tests/unit/golden.test.ts`:

- sentiment: 5/5, intent: 6/6, threat labels: 8/8, confidence ordering: 3/3.

## Unit suite

`npm run test:unit` — 45/45 (confidence formula, threat boundaries, classifiers,
golden sets). E2E suites remain the behavioral gate: auth 29/29, onboarding 34/34,
dashboard 46/46, ops 43/43, brain 48/48.
