# SCE Business Mode Map

This guide defines how SCE should run as the default capability control plane after being integrated into an application system.

## 1. Scope

- Applies to integrated business systems that expose UI + AI assistant capabilities.
- SCE is the default orchestrator for all AI-driven tasks in the host system.
- Every request is routed by mode, risk, and authorization state before execution.

## 2. Three Operating Modes

| Mode | Primary Goal | Typical Actor | Default Execution | Mutating Change Policy | Required Evidence |
| --- | --- | --- | --- | --- | --- |
| `user-mode` | Complete business tasks safely | End user | `suggestion` | Block direct apply by default | intent, summary, guidance |
| `ops-mode` | Maintain system health and fix runtime issues | Operations / support | `suggestion` + guarded `apply` | Allow apply after runtime + authorization + approval gates | plan, work-order, ledger, gate signals |
| `dev-mode` | Deliver new features and structural changes | Developer / product engineer | `suggestion` + staged `apply` | Require branch-level review and release gates | spec deltas, test evidence, release evidence |

## 3. Default Takeover Principle

After SCE integration is enabled:

1. All AI intents must enter SCE first.
2. SCE decides route: answer only, generate patch, repair, or rollback.
3. Any mutating action must pass governance gates before apply.
4. Every apply/rollback must write auditable artifacts.

## 4. Runtime Flow (Default)

1. `intent intake`: capture goal + page/context payload.
2. `mode classification`: resolve `user-mode` / `ops-mode` / `dev-mode`.
3. `strategy routing`: choose answer-only, patch, repair loop, or rollback.
4. `symbol-level evidence`: locate affected files/symbols and build plan.
5. `gated execution`: runtime policy + authorization tier + approval gate.
6. `execution + audit`: execute or block, then emit summary and evidence.

## 5. Mode Playbooks

### 5.1 user-mode (business usage UI)

- UI profile: business-user.
- Default policy: advice and guided actions only.
- Apply behavior: denied unless elevated to ops/dev flow explicitly.
- Recommended command pattern:

```bash
sce scene interactive-flow \
  --goal "<business-goal>" \
  --ui-mode user-app \
  --dialogue-profile business-user \
  --execution-mode suggestion \
  --json
```

### 5.2 ops-mode (maintenance console)

- UI profile: system-maintainer.
- Default policy: allow guarded apply for low/medium risk fixes.
- Required gates: runtime policy, authorization tier, approval workflow.
- Recommended command pattern:

```bash
sce scene interactive-flow \
  --goal "<ops-goal>" \
  --ui-mode ops-console \
  --dialogue-profile system-maintainer \
  --execution-mode apply \
  --runtime-environment staging \
  --auto-execute-low-risk \
  --json
```

### 5.3 dev-mode (feature and restructuring)

- UI profile: system-maintainer or engineering profile.
- Default policy: spec-first planning + controlled implementation.
- Required gates: spec completeness, tests, release preflight evidence.
- Recommended command pattern:

```bash
sce auto close-loop-batch <manifest.json> \
  --format json \
  --batch-retry-until-complete \
  --json
```

## 6. Security and Authorization Baseline

- Password authorization is mandatory for mutating apply mode.
- Runtime `non-allow` decisions must block unattended apply.
- Weekly governance gates are mandatory before release.
- Legacy steering migration must be manually approved before non-migration commands can proceed.

See also: `docs/security-governance-default-baseline.md`

## 7. Integration Checklist

1. Map UI surfaces to one of the three modes.
2. Wire the AI assistant to call SCE as first-hop router.
3. Enable required gate artifacts and audit logs.
4. Run weekly governance and release gates.
5. Keep capability matrix and ontology mapping updated per release.

