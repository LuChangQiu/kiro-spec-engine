# MagicBall Integration Issue Tracker

> This file is the narrow coordination document between MagicBall and SCE.
> It is used to record only the minimum integration facts that require cross-project synchronization: active issues, contract gaps, decisions, and verification results.
> When SCE completes a relevant change that MagicBall needs to know about, the update should be synced here.
> Once an item is verified and no longer needs cross-project coordination, it should be removed or compacted to avoid the file becoming too large, too noisy, or too hard to maintain.

## 2026-03-08

### SCE Update 001: Current capabilities ready for MagicBall integration

SCE changes completed and now available for MagicBall:
- `app bundle` registry local state and CLI
- `mode application home --app ... --json`
- `mode ontology home --app ... --json`
- `mode engineering home --app ... --json`
- `app registry status/configure/sync*`
- `app runtime show/releases/install/activate`
- `app engineering show/attach/hydrate/activate`
- `pm requirement/tracking/planning/change/issue` data plane
- `ontology er/br/dl` + `ontology triad summary`
- `assurance resource/logs/backup/config`
- MagicBall-facing docs updated under `docs/`

MagicBall recommended consumption order:
1. consume `mode * home` as the top-level source for the three modes
2. consume `pm`, `ontology`, and `assurance` table payloads
3. wire runtime install/activate and engineering attach/hydrate/activate actions
4. use demo app: `customer-order-demo`

Related SCE docs:
- `docs/magicball-sce-adaptation-guide.md`
- `docs/magicball-write-auth-adaptation-guide.md`
- `docs/magicball-adaptation-task-checklist-v1.md`

Status:
- ready for MagicBall integration

### Issue 001: SQLite lock when frontend triggers multiple SCE projection commands concurrently

Context:
- Project: `E:\workspace\331-poc`
- Upstream docs referenced from: `E:\workspace\kiro-spec-engine\docs`
- SCE local source version observed: `3.6.34`

Observed behavior:
- When multiple `sce mode ... home --json` commands are triggered concurrently, frontend occasionally receives:
  - `database is locked`

Concrete command involved:
- `sce mode application home --app customer-order-demo --json`

Related commands that were being loaded together:
- `sce mode application home --app customer-order-demo --json`
- `sce mode ontology home --app customer-order-demo --json`
- `sce mode engineering home --app customer-order-demo --json`
- `sce app engineering show --app customer-order-demo --json`

Frontend mitigation applied in MagicBall:
- Changed mode-home loading from parallel to sequential in local store.
- MagicBall now serializes:
  1. application home
  2. ontology home
  3. engineering home
  4. engineering show

Assessment:
- This mitigation makes frontend behavior more stable.
- However, from SCE side it would still be better if repeated mode-home reads were more concurrency-tolerant, or if read-only mode projections could avoid transient sqlite lock failures.

Suggested SCE follow-up:
1. Evaluate whether read-only projection commands can tolerate short lock contention with retry.
2. Consider central helper for sqlite retry/backoff on read-only mode-home queries.
3. Document whether frontend should assume all projection reads must be serialized.

Status:
- Frontend workaround applied
- SCE follow-up recommended
