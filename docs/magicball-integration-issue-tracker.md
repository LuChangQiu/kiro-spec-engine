# MagicBall Integration Issue Tracker

> This file is the narrow coordination document between MagicBall and SCE.
> It is used to record only the minimum integration facts that require cross-project synchronization: active issues, contract gaps, decisions, and verification results.
> When SCE completes a relevant change that MagicBall needs to know about, the update should be synced here.
> Once an item is verified and no longer needs cross-project coordination, it should be removed or compacted to avoid the file becoming too large, too noisy, or too hard to maintain.

## Usage Rule

- Keep this file narrow.
- Add only cross-project integration facts.
- Prefer short status-oriented records over long design discussion.
- Move completed items to `Resolved` or remove them once both sides no longer need them.

## Current Contract

### Current SCE capabilities ready for MagicBall integration

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

### Current recommended MagicBall consumption order
1. consume `mode * home` as the top-level source for the three modes
2. consume `pm`, `ontology`, and `assurance` table payloads
3. wire runtime install/activate and engineering attach/hydrate/activate actions
4. use demo app: `customer-order-demo`

### Related SCE docs
- `docs/magicball-sce-adaptation-guide.md`
- `docs/magicball-write-auth-adaptation-guide.md`
- `docs/magicball-adaptation-task-checklist-v1.md`

## Open Items

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

MagicBall action taken:
- Changed mode-home loading from parallel to sequential in local store.
- MagicBall now serializes:
  1. application home
  2. ontology home
  3. engineering home
  4. engineering show

SCE action taken:
- Added short read retry handling for retryable sqlite lock errors on app/mode/pm/ontology/assurance read paths.
- Goal: reduce transient `database is locked` failures for read-heavy MagicBall integration flows.

Current cross-project decision:
- Keep sequential frontend loading as the current safe default.
- Treat SCE read retry as mitigation, not as permission to switch back to parallel loading immediately.

Status:
- MagicBall workaround applied
- SCE mitigation applied
- still needs wider real-world verification before considering this fully closed

## Resolved

### SCE Update 001: Current capabilities ready for MagicBall integration

Status:
- ready for MagicBall integration
- moved into `Current Contract`
