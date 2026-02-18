# Command Reference

> Quick reference for all `sco` commands

**Version**: 2.0.0
**Last Updated**: 2026-02-18

---

## Command Naming

The CLI provides three command aliases:
- `sco` - **Recommended primary command** (use this in all documentation)
- `kse` - Legacy short alias (compatible)
- `kiro-spec-engine` - Legacy full alias (compatible)

**Always use `sco` in new examples and documentation.**

---

## Installation

```bash
npm install -g sco-engine
```

This creates the `sco` command globally. Legacy aliases `kse` and `kiro-spec-engine` are still available.

---

## Core Commands

### Project Setup

```bash
# Initialize new project
sco init [project-name]

# Adopt existing project
sco adopt

# Check project status
sco status

# Run system diagnostics
sco doctor
```

### Spec Management

```bash
# Legacy low-level: create spec directory only
sco create-spec 01-00-feature-name

# Bootstrap full Spec draft (requirements/design/tasks)
sco spec bootstrap --name 01-00-feature-name --non-interactive

# Run pipeline for one Spec
sco spec pipeline run --spec 01-00-feature-name

# Run gate for one Spec
sco spec gate run --spec 01-00-feature-name --json

# Multi-Spec mode defaults to orchestrate routing
sco spec bootstrap --specs "spec-a,spec-b" --max-parallel 3
sco spec pipeline run --specs "spec-a,spec-b" --max-parallel 3
sco spec gate run --specs "spec-a,spec-b" --max-parallel 3

# Show Spec progress
sco status --verbose
```

### Value Metrics

```bash
# Generate sample KPI input JSON
sco value metrics sample --out ./kpi-input.json --period 2026-W10 --json

# Generate weekly KPI snapshot + gate summary
sco value metrics snapshot \
  --input .kiro/specs/112-00-spec-value-realization-program/custom/weekly-metrics/2026-W09.sample.json \
  --period 2026-W09 \
  --checkpoint day-60 \
  --json

# Use custom metric contract and output paths
sco value metrics snapshot \
  --input ./metrics-input.json \
  --definitions .kiro/specs/112-00-spec-value-realization-program/custom/metric-definition.yaml \
  --history-dir .kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics \
  --out .kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics/2026-W10.json

# Generate baseline from earliest 3 history snapshots
sco value metrics baseline \
  --definitions .kiro/specs/112-00-spec-value-realization-program/custom/metric-definition.yaml \
  --history-dir .kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics \
  --from-history 3 \
  --period 2026-W10 \
  --json

# Generate trend report from latest 6 snapshots
sco value metrics trend \
  --definitions .kiro/specs/112-00-spec-value-realization-program/custom/metric-definition.yaml \
  --history-dir .kiro/specs/114-00-kpi-automation-and-observability/custom/weekly-metrics \
  --window 6 \
  --json
```

### Task Management

```bash
# Claim a task
sco task claim <spec-name> <task-id>

# Unclaim a task
sco task unclaim <spec-name> <task-id>

# Show task status
sco task status <spec-name>
```

### Context & Prompts

```bash
# Export spec context
sco context export <spec-name>

# Export with steering rules
sco context export <spec-name> --steering

# Generate task prompt
sco prompt generate <spec-name> <task-id>

# Generate for specific tool
sco prompt generate <spec-name> <task-id> --tool=claude-code
```

### Watch Mode

```bash
# Initialize watch configuration
sco watch init

# Start watch mode
sco watch start

# Stop watch mode
sco watch stop

# Check watch status
sco watch status

# View watch logs
sco watch logs

# Follow log stream in real time (tail -f behavior)
sco watch logs --follow

# Show last 100 entries, then continue following
sco watch logs --tail 100 --follow

# Show automation metrics
sco watch metrics

# List available presets
sco watch presets

# Install a preset
sco watch install <preset-name>
```

### Workflows

```bash
# List available workflows
sco workflows

# Show workflow details
sco workflows show <workflow-name>

# Open workflow guide
sco workflows guide

# Mark workflow as complete
sco workflows complete <workflow-name>
```

### Workspace Management

```bash
# Create a new workspace
sco workspace create <name> [path]

# List all workspaces
sco workspace list

# Switch active workspace
sco workspace switch <name>

# Show workspace info
sco workspace info [name]

# Remove a workspace
sco workspace remove <name> [--force]

# Legacy commands (still supported)
sco workspace sync
sco workspace team
```

### Environment Management

```bash
# List all environments
sco env list

# Switch to environment (with automatic backup)
sco env switch <name>

# Show active environment details
sco env info

# Register new environment from config file
sco env register <config-file>

# Remove environment (requires --force)
sco env unregister <name> --force

# Rollback to previous environment
sco env rollback

# Verify current environment (optional)
sco env verify

# Run command in environment context (optional)
sco env run "<command>"
```

### Multi-Repository Management

```bash
# Initialize repository configuration
sco repo init [--force] [--depth <n>]

# Show status of all repositories
sco repo status [--verbose] [--json]

# Execute command in all repositories
sco repo exec "<command>" [--dry-run]

# Check repository health
sco repo health [--json]
```

### Agent Orchestration (Codex)

```bash
# Start orchestration for multiple specs
sco orchestrate run --specs "spec-a,spec-b,spec-c" --max-parallel 3

# Show orchestration status
sco orchestrate status [--json]

# Stop all running sub-agents
sco orchestrate stop
```

When you pass `--specs` to `sco spec bootstrap|pipeline run|gate run`, sco now defaults to this orchestrate mode automatically.

### Autonomous Close-Loop Program

```bash
# One-command close-loop execution:
# goal -> auto master/sub decomposition -> collab metadata -> orchestration -> terminal result
sco auto close-loop "build autonomous close-loop and master/sub orchestration"
# default sub-spec count is auto-selected by goal complexity (typically 3-5)

# Preview decomposition only
sco auto close-loop "build autonomous close-loop and master/sub orchestration" --dry-run --json

# Generate plan but skip orchestration run
sco auto close-loop "build autonomous close-loop and master/sub orchestration" --no-run

# Run without live status stream output
sco auto close-loop "build autonomous close-loop and master/sub orchestration" --no-stream

# Add Definition-of-Done (DoD) test gate
sco auto close-loop "build autonomous close-loop and master/sub orchestration" \
  --dod-tests "npm run test:smoke"

# Strict DoD: require all tasks.md checklists are closed
sco auto close-loop "build autonomous close-loop and master/sub orchestration" \
  --dod-tasks-closed

# Write DoD evidence to custom report path
sco auto close-loop "build autonomous close-loop and master/sub orchestration" \
  --dod-report ".kiro/reports/close-loop-dod.json"

# Resume from the latest close-loop session snapshot
sco auto close-loop --resume latest

# Resume from the latest interrupted close-loop session snapshot
sco auto close-loop --resume interrupted

# Quick continue shorthand (maps to --resume interrupted)
sco auto close-loop continue
sco auto close-loop 继续
sco auto continue

# Resume from a specific session id
sco auto close-loop --resume 117-20260214230000

# Apply session retention automatically after close-loop execution
sco auto close-loop "build autonomous close-loop and master/sub orchestration" \
  --session-keep 50 \
  --session-older-than-days 14

# Allow up to 2 automatic replan cycles on orchestration failures
sco auto close-loop "build autonomous close-loop and master/sub orchestration" \
  --replan-attempts 2

# Use adaptive replan budget strategy (default) or fixed
sco auto close-loop "build autonomous close-loop and master/sub orchestration" \
  --replan-strategy adaptive

# Run multiple goals in one autonomous batch (one master/sub portfolio per goal)
sco auto close-loop-batch .kiro/goals.txt
sco auto close-loop-batch .kiro/goals.json --dry-run --json

# Generate batch goals from one broad program goal (no goals file needed)
sco auto close-loop-batch \
  --decompose-goal "build autonomous close-loop, master/sub decomposition, orchestration and quality rollout" \
  --program-goals 4 \
  --program-min-quality-score 85 \
  --json

# Program command: broad goal -> auto split -> autonomous batch closed-loop execution
sco auto close-loop-program \
  "build autonomous close-loop, master/sub decomposition, orchestration and quality rollout" \
  --program-goals 4 \
  --program-quality-gate \
  --program-recover-max-rounds 6 \
  --program-recover-max-minutes 30 \
  --program-gate-profile staging \
  --program-gate-fallback-chain staging,prod \
  --program-gate-fallback-profile prod \
  --program-min-success-rate 95 \
  --program-max-risk-level medium \
  --program-govern-until-stable \
  --program-govern-max-rounds 3 \
  --program-govern-use-action 1 \
  --program-kpi-out .kiro/reports/close-loop-program-kpi.json \
  --program-audit-out .kiro/reports/close-loop-program-audit.json \
  --json

# Controller command: drain queued broad goals with close-loop-program runtime
sco auto close-loop-controller .kiro/auto/program-queue.lines \
  --dequeue-limit 2 \
  --max-cycles 20 \
  --controller-done-file .kiro/auto/program-done.lines \
  --controller-failed-file .kiro/auto/program-failed.lines \
  --json

# Persistent controller mode: keep polling queue and execute new goals automatically
sco auto close-loop-controller .kiro/auto/program-queue.lines \
  --wait-on-empty \
  --poll-seconds 30 \
  --max-cycles 1000 \
  --max-minutes 240

# Resume from latest persisted controller session
sco auto close-loop-controller --controller-resume latest --json

# Recovery command: replay unresolved goals from summary using remediation action strategy
sco auto close-loop-recover latest --json
sco auto close-loop-recover .kiro/auto/close-loop-batch-summaries/batch-20260215090000.json \
  --use-action 2 \
  --recover-until-complete \
  --recover-max-rounds 3 \
  --recover-max-minutes 20 \
  --recovery-memory-ttl-days 30 \
  --recovery-memory-scope release-main \
  --program-audit-out .kiro/reports/close-loop-recover-audit.json \
  --dry-run --json

# Default autonomous batch run (continue-on-error + adaptive scheduling + retry-until-complete)
sco auto close-loop-batch .kiro/goals.json --json

# Run batch goals with concurrent close-loop workers
sco auto close-loop-batch .kiro/goals.json --batch-parallel 3 --json

# Apply global agent budget across all concurrent goals
sco auto close-loop-batch .kiro/goals.json \
  --batch-parallel 3 \
  --batch-agent-budget 6 \
  --json

# Prioritize complex goals first and enable anti-starvation aging
sco auto close-loop-batch .kiro/goals.json \
  --batch-priority critical-first \
  --batch-aging-factor 3 \
  --json

# Automatically retry failed/stopped goals for one extra round
sco auto close-loop-batch .kiro/goals.json \
  --batch-retry-rounds 1 \
  --batch-retry-strategy adaptive \
  --json

# Retry until all goals complete (bounded by max rounds)
sco auto close-loop-batch .kiro/goals.json \
  --batch-retry-until-complete \
  --batch-retry-max-rounds 10 \
  --json

# Disable autonomous batch policy explicitly (only when you need legacy/manual tuning)
sco auto close-loop-batch .kiro/goals.json \
  --no-batch-autonomous \
  --json

# Resume only pending goals from a previous batch summary
sco auto close-loop-batch --resume-from-summary .kiro/reports/close-loop-batch.json --json

# Resume pending goals from latest persisted batch session summary
sco auto close-loop-batch --resume-from-summary latest --json

# Resume only failed/error goals from summary (ignore unprocessed goals)
sco auto close-loop-batch --resume-from-summary .kiro/reports/close-loop-batch.json \
  --resume-strategy failed-only --json

# List persisted close-loop sessions
sco auto session list
sco auto session list --status completed,partial-failed
sco auto session list --limit 50 --json

# Aggregate close-loop session telemetry
sco auto session stats
sco auto session stats --days 14 --status completed --json

# Prune old close-loop sessions
sco auto session prune --keep 50
sco auto session prune --keep 20 --older-than-days 14 --dry-run

# List persisted spec directories
sco auto spec-session list
sco auto spec-session list --limit 100 --json

# Prune old spec directories
sco auto spec-session prune --keep 200
sco auto spec-session prune --keep 100 --older-than-days 30 --dry-run --json
sco auto spec-session prune --keep 100 --older-than-days 30 --show-protection-reasons --json

# List persisted close-loop-batch summary sessions
sco auto batch-session list
sco auto batch-session list --status failed
sco auto batch-session list --limit 50 --json

# Aggregate close-loop-batch summary telemetry
sco auto batch-session stats
sco auto batch-session stats --days 14 --status failed --json

# Prune old close-loop-batch summary sessions
sco auto batch-session prune --keep 50
sco auto batch-session prune --keep 20 --older-than-days 14 --dry-run

# List persisted close-loop-controller summary sessions
sco auto controller-session list
sco auto controller-session list --status partial-failed
sco auto controller-session list --limit 50 --json

# Aggregate close-loop-controller summary session telemetry
sco auto controller-session stats
sco auto controller-session stats --days 14 --status partial-failed --json

# Prune old close-loop-controller summary sessions
sco auto controller-session prune --keep 50
sco auto controller-session prune --keep 20 --older-than-days 14 --dry-run

# Aggregate cross-archive autonomous governance telemetry
sco auto governance stats
sco auto governance stats --days 14 --status completed,partial-failed --json
sco auto governance maintain --session-keep 50 --batch-session-keep 50 --controller-session-keep 50 --json
sco auto governance maintain --apply --session-keep 20 --batch-session-keep 20 --controller-session-keep 20 --recovery-memory-older-than-days 90 --json
sco auto governance close-loop --plan-only --max-rounds 3 --target-risk low --json
sco auto governance close-loop --max-rounds 3 --target-risk low --session-keep 20 --batch-session-keep 20 --controller-session-keep 20 --json
sco auto governance close-loop --max-rounds 3 --governance-session-keep 50 --governance-session-older-than-days 30 --json
sco auto governance close-loop --max-rounds 3 --target-risk low --execute-advisory --advisory-recover-max-rounds 3 --advisory-controller-max-cycles 20 --dry-run --json
sco auto governance close-loop --governance-resume latest --max-rounds 5 --json
sco auto governance close-loop --governance-resume latest --target-risk high --governance-resume-allow-drift --json
sco auto governance session list --limit 20 --status completed,failed --json
sco auto governance session list --resume-only --json
sco auto governance session stats --days 30 --json
sco auto governance session stats --resume-only --json
sco auto governance session prune --keep 50 --older-than-days 30 --dry-run --json

# Recovery memory maintenance
sco auto recovery-memory show --json
sco auto recovery-memory scopes --json
sco auto recovery-memory prune --older-than-days 30 --dry-run --json
sco auto recovery-memory clear --json

# Autonomous KPI trend (weekly/daily buckets + CSV export)
sco auto kpi trend --weeks 12 --period week --mode all --json
sco auto kpi trend --weeks 8 --period day --mode program --csv --out ./auto-kpi-trend.csv

# Unified observability snapshot (sessions + governance + KPI trend)
sco auto observability snapshot --days 14 --status completed,failed --json
sco auto observability snapshot --out .kiro/reports/auto-observability.json --json

# Agent-facing spec interfaces
sco auto spec status 121-00-master --json
sco auto spec instructions 121-02-sub-track --json

# Autonomous archive schema compatibility
sco auto schema check --json
sco auto schema migrate --json                           # dry-run by default
sco auto schema migrate --apply --json                  # apply schema_version migration
sco auto schema migrate --only close-loop-session,batch-session --apply --json

# Dual-track handoff integration (generic external project -> sco)
sco auto handoff plan --manifest docs/handoffs/handoff-manifest.json --json
sco auto handoff plan --manifest docs/handoffs/handoff-manifest.json --strict --out .kiro/reports/handoff-plan.json --json
sco auto handoff queue --manifest docs/handoffs/handoff-manifest.json --out .kiro/auto/handoff-goals.lines --json
sco auto handoff template-diff --manifest docs/handoffs/handoff-manifest.json --json
sco auto handoff capability-matrix --manifest docs/handoffs/handoff-manifest.json --json
sco auto handoff capability-matrix --manifest docs/handoffs/handoff-manifest.json --format markdown --out .kiro/reports/handoff-capability-matrix.md --fail-on-gap --json
sco auto handoff run --manifest docs/handoffs/handoff-manifest.json --json
sco auto handoff run --manifest docs/handoffs/handoff-manifest.json --min-spec-success-rate 95 --max-risk-level medium --json
sco auto handoff run --manifest docs/handoffs/handoff-manifest.json --continue-from latest --continue-strategy auto --json
sco auto handoff regression --session-id latest --json
sco auto handoff regression --session-id latest --window 5 --json
sco auto handoff regression --session-id latest --format markdown --out .kiro/reports/handoff-regression.md --json
sco auto handoff regression --session-id latest --window 5 --out .kiro/reports/handoff-regression.json --json
sco auto close-loop-batch .kiro/auto/handoff-goals.lines --format lines --json
``` 

DoD-related options:
- `--dod-tests <command>`: run a final shell command as a completion gate
- `--dod-tests-timeout <ms>`: timeout for `--dod-tests` (default `600000`)
- `--dod-max-risk-level <low|medium|high>`: fail DoD when derived run risk is above threshold
- `--dod-kpi-min-completion-rate <n>`: minimum close-loop completion rate percent (`0-100`)
- `--dod-max-success-rate-drop <n>`: max allowed completion-rate drop vs recent baseline (`0-100`)
- `--dod-baseline-window <n>`: number of recent sessions used for baseline comparison (`1-50`, default `5`)
- `--dod-tasks-closed`: require no unchecked `- [ ]` items in generated `tasks.md`
- `--no-dod-docs`: skip doc completeness gate
- `--no-dod-collab`: skip collaboration completion gate
- `--no-dod`: disable all DoD gates
- `--dod-report <path>`: write DoD evidence report JSON to custom path
- `--no-dod-report`: disable automatic DoD report archive
- `--resume <session-or-file>`: resume from prior session id, `latest`, `interrupted` (latest non-completed session), or JSON path
  - Shorthand: `sco auto close-loop continue` / `sco auto close-loop 继续` equals `--resume interrupted`.
- `sco auto continue`: shortcut command that resumes latest interrupted close-loop session.
- `--session-id <id>`: set explicit session id for persistence
- `--no-session`: disable close-loop session persistence
- `--session-keep <n>`: prune sessions after run and keep newest `n` snapshots
- `--session-older-than-days <n>`: when pruning, only delete sessions older than `n` days
- `--subs <n>`: override automatic decomposition count (`2-5`)
- `--replan-strategy <strategy>`: `adaptive` or `fixed` replan budget strategy
- `--replan-attempts <n>`: max automatic replan cycles after failed orchestration (`0-5`, default `1`)
- `--replan-no-progress-window <n>`: stop replan when no progress repeats for `n` failed cycles (`1-10`, default `3`)
- `--no-replan`: disable automatic replan cycle
- `--no-conflict-governance`: disable lease-conflict prediction and scheduling guard
- `--no-ontology-guidance`: disable scene ontology `agent_hints` scheduling guidance

Close-loop batch (`sco auto close-loop-batch <goals-file>`) options:
- supports shared close-loop execution options (for example: `--subs`, `--max-parallel`, `--dod*`, `--replan*`, `--dry-run`, `--json`)
- `--format <format>`: parse goals file as `auto`, `json`, or `lines` (default `auto`)
- `--decompose-goal <goal>`: auto-split one broad goal into multiple batch goals using semantic clauses/categories
- `--program-goals <n>`: target generated-goal count for `--decompose-goal` (`2-12`, default adaptive)
- `--program-min-quality-score <n>`: minimum decomposition quality score before auto-refinement (`0-100`, default `70`)
- `--program-quality-gate`: fail fast if final decomposition quality is still below `--program-min-quality-score`
- `--resume-from-summary <path>`: derive pending goals from an existing batch summary (reruns failed/error and previously unprocessed goals)
- `--resume-from-summary latest`: load the most recent persisted batch session summary automatically
- `--resume-strategy <strategy>`: `pending` (default) or `failed-only` for summary resume scope
- `--batch-parallel <n>`: run up to `n` goals concurrently (`1-20`, default adaptive under autonomous policy)
- `--batch-agent-budget <n>`: global agent parallel budget shared by all running goals (`1-500`)
- `--batch-priority <strategy>`: scheduling strategy `fifo`, `complex-first`, `complex-last`, or `critical-first` (default `complex-first` under autonomous policy)
- `--batch-aging-factor <n>`: waiting-goal aging boost per scheduling cycle (`0-100`, default `2` under autonomous policy)
- `--batch-retry-rounds <n>`: retry failed/stopped goals for `n` additional rounds (`0-5`, default `0`, or until-complete under autonomous policy)
- `--batch-retry-strategy <strategy>`: retry strategy `adaptive` (default) or `strict`
- `--batch-retry-until-complete`: keep retrying until no failed/stopped goals remain or max rounds reached
- `--batch-retry-max-rounds <n>`: max extra rounds for `--batch-retry-until-complete` (`1-20`, default `10`)
- `--no-batch-autonomous`: disable autonomous closed-loop defaults and rely on explicit batch flags
- `--batch-session-id <id>`: set explicit persisted batch session id
- `--batch-session-keep <n>`: keep newest `n` persisted batch summaries after each run (`0-1000`)
- `--batch-session-older-than-days <n>`: when pruning persisted batch summaries, only delete sessions older than `n` days (`0-36500`)
- `--spec-session-keep <n>`: keep newest `n` spec directories under `.kiro/specs` after run (`0-5000`)
- `--spec-session-older-than-days <n>`: when pruning specs, only delete directories older than `n` days (`0-36500`)
- `--no-spec-session-protect-active`: allow pruning active/recently referenced spec directories
- `--spec-session-protect-window-days <n>`: protection window (days) for recent session references during spec pruning (`0-36500`, default `7`)
- `--spec-session-max-total <n>`: spec directory budget ceiling under `.kiro/specs` (`1-500000`)
- `--spec-session-max-created <n>`: spec growth guard for maximum estimated created directories per run (`0-500000`)
- `--spec-session-max-created-per-goal <n>`: spec growth guard for estimated created directories per processed goal (`0-1000`)
- `--spec-session-max-duplicate-goals <n>`: goal-input duplicate guard for batch runs (`0-500000`)
- `--spec-session-budget-hard-fail`: fail run when spec count exceeds `--spec-session-max-total` before/after execution
- `--no-batch-session`: disable automatic persisted batch summary session archive
- `--continue-on-error`: continue remaining goals after a failed/error goal (enabled by default under autonomous policy)
- `--out <path>`: write batch summary JSON output file
- `--resume` and `--session-id` are not supported in batch mode (sessions are per-goal)
- `--program-goals` requires `--decompose-goal`
- `<goals-file>`, `--resume-from-summary`, and `--decompose-goal` are mutually exclusive goal sources
- Batch summary includes `resource_plan` (budget/effective parallel/per-goal maxParallel/scheduling strategy/aging/starvation wait metrics/criticality summary) and `metrics` (`success_rate_percent`, `status_breakdown`, `average_sub_specs_per_goal`, `average_replan_cycles_per_goal`, `total_rate_limit_signals`, `average_rate_limit_signals_per_goal`, `total_rate_limit_backoff_ms`)
  - Under budget mode, scheduler is complexity-weighted (`goal_weight`/`scheduling_weight`) so higher-complexity goals consume more shared slots and can reduce same-batch concurrency.
  - Batch summary includes `batch_retry` telemetry (strategy, until-complete mode, configured/max/performed rounds, exhausted flag, per-round history).
  - Under `--batch-retry-strategy adaptive`, retry history includes rate-limit pressure and next-round backpressure decisions (`applied_batch_parallel`, `next_batch_parallel`, `adaptive_backpressure_applied`).
  - Batch summary includes `batch_session` metadata when persisted (session id + file path).
  - When using `--decompose-goal`, summary includes `generated_from_goal` metadata (strategy, target count, produced count, clause/category diagnostics, decomposition `quality`, and refinement telemetry).

Close-loop program (`sco auto close-loop-program "<goal>"`) options:
- Automatically enables autonomous batch policy (hands-off closed-loop defaults) and uses semantic decomposition from one broad goal.
- `--program-goals <n>`: target generated-goal count (`2-12`, default adaptive)
- Supports batch execution controls (`--batch-parallel`, `--batch-agent-budget`, `--batch-priority`, `--batch-aging-factor`, `--batch-retry*`)
- Supports batch summary persistence controls (`--batch-session-id`, `--batch-session-keep`, `--batch-session-older-than-days`, `--no-batch-session`)
- Supports spec retention controls (`--spec-session-keep`, `--spec-session-older-than-days`, `--no-spec-session-protect-active`)
  - Includes `--spec-session-protect-window-days` to tune recent-reference protection window.
  - Includes `--spec-session-max-total` and optional `--spec-session-budget-hard-fail` for spec-count budget governance.
- `--no-program-auto-recover`: disable built-in recovery loop after non-completed program runs
- `--program-recover-use-action <n>`: pin remediation action for auto recovery (otherwise KSE uses learned memory or default action `1`)
- `--program-recover-resume-strategy <pending|failed-only>`: resume scope for built-in program recovery (default `pending`)
- `--program-recover-max-rounds <n>`: bounded recovery rounds for built-in program recovery (`1-20`, default `5`)
- `--program-recover-max-minutes <n>`: elapsed-time budget for built-in program recovery loop (minutes, default unlimited)
- `--program-gate-profile <profile>`: convergence gate profile (`default|dev|staging|prod`) to set baseline success/risk policy
- `--program-gate-fallback-profile <profile>`: fallback gate profile (`none|default|dev|staging|prod`, default `none`) used only when primary gate fails
- `--program-gate-fallback-chain <profiles>`: ordered fallback profiles (comma-separated) evaluated after primary gate failure
- `--program-min-success-rate <n>`: convergence gate minimum success rate percent (`0-100`, default `100`)
- `--program-max-risk-level <low|medium|high>`: convergence gate risk ceiling (default `high`)
- `--program-max-elapsed-minutes <n>`: convergence gate elapsed-time budget in minutes (`1-10080`, default unlimited)
- `--program-max-agent-budget <n>`: convergence gate max allowed agent budget/effective parallel budget (`1-500`)
- `--program-max-total-sub-specs <n>`: convergence gate max total sub-specs across program goals (`1-500000`)
- `--no-program-gate-auto-remediate`: disable automatic remediation hints/prune attempts after gate failure
- `--program-govern-until-stable`: enable post-run governance loop that keeps replaying/recovering until gate/anomaly stability
- `--program-govern-max-rounds <n>`: max governance rounds (`1-20`, default `3`)
- `--program-govern-max-minutes <n>`: elapsed-time budget for governance loop (`1-10080`, default `60`)
- `--program-govern-anomaly-weeks <n>`: KPI lookback weeks for anomaly-triggered governance (`1-260`, default `8`)
- `--program-govern-anomaly-period <week|day>`: KPI bucket period for anomaly governance checks (default `week`)
- `--no-program-govern-anomaly`: disable anomaly-triggered governance and only govern by gate/budget failures
- `--program-govern-use-action <n>`: pin remediation action index (`1-20`) used in governance rounds
- `--no-program-govern-auto-action`: disable automatic remediation action selection/execution in governance rounds
- `--program-min-quality-score <n>`: minimum semantic decomposition quality score before automatic refinement (`0-100`, default `70`)
- `--program-quality-gate`: fail run when final decomposition quality remains below `--program-min-quality-score`
- `--recovery-memory-scope <scope>`: scope key for recovery memory isolation (default auto: project + git branch)
- Supports shared close-loop options (`--subs`, `--max-parallel`, `--dod*`, `--replan*`, `--dry-run`, `--json`, `--out`)
- `--program-kpi-out <path>`: write a standalone program KPI snapshot JSON (`convergence_state`, `risk_level`, retry recovery, complexity ratio, wait profile)
- `--program-audit-out <path>`: write a program audit JSON (`program_coordination`, `recovery_cycle`, `program_gate`, and selected strategy metadata)
- Program summary includes `program_kpi`, `program_gate`, `program_gate_fallbacks`, `program_gate_effective`, and optional `program_kpi_file` / `program_audit_file` for portfolio-level observability pipelines.
  - `program_gate` now supports unified budget checks (success/risk + elapsed time + agent budget + total sub-spec ceiling).
  - On gate/budget failure, summary can include `program_gate_auto_remediation` with auto patch/prune actions.
- With `--program-govern-until-stable`, summary additionally includes:
  - `program_governance` (round history, stop reason, exhausted/converged state)
  - `program_governance` includes action-selection metadata (`auto_action_enabled`, `action_selection_enabled`, `pinned_action_index`, per-round `selected_action*`).
  - `program_kpi_trend` and `program_kpi_anomalies` (anomaly-aware governance context, including `rate-limit-spike` pressure that can auto-reduce `batchParallel`/`batchAgentBudget`).
- Program summary includes `program_diagnostics` with `failure_clusters` and `remediation_actions` (prioritized follow-up commands for convergence).
- Program summary includes `program_coordination` (master/sub topology, unresolved goal indexes, scheduler snapshot) and `auto_recovery` metadata.

Close-loop controller (`sco auto close-loop-controller [queue-file]`) options:
- `queue-file`: optional queue file path (default `.kiro/auto/close-loop-controller-goals.lines`)
- `--controller-resume <session-or-file>`: resume from persisted controller session (`latest`, session id, or file path)
- `--queue-format <auto|json|lines>`: queue parser mode (default `auto`)
- `--no-controller-dedupe`: disable duplicate broad-goal deduplication (default dedupe enabled)
- `--dequeue-limit <n>`: consume up to `n` goals per controller cycle (`1-100`, default `all` pending goals)
- `--wait-on-empty`: keep polling when queue is empty instead of stopping
- `--poll-seconds <n>`: polling interval for `--wait-on-empty` (`1-3600`, default `30`)
- `--max-cycles <n>`: max controller cycles (`1-100000`, default `1000`)
- `--max-minutes <n>`: elapsed-time budget in minutes (`1-10080`, default `120`)
- `--controller-lock-file <path>`: explicit lease lock file (default `<queue-file>.lock`)
- `--controller-lock-ttl-seconds <n>`: stale lock takeover threshold (`10-86400`, default `1800`)
- `--no-controller-lock`: disable controller lease lock (unsafe for concurrent controllers)
- `--stop-on-goal-failure`: stop immediately when one dequeued goal fails
- `--controller-session-id <id>`: set explicit persisted controller session id
- `--controller-session-keep <n>` / `--controller-session-older-than-days <n>`: retention policy for persisted controller sessions
- `--no-controller-session`: disable controller session persistence
- `--controller-out <path>`: write controller summary JSON
- `--controller-done-file <path>` / `--controller-failed-file <path>`: append completed/failed goals into line archives
- `--controller-print-program-summary`: print each nested `close-loop-program` summary during controller execution
- Supports program execution controls (`--program-*`, `--batch-*`, `--continue-on-error`, `--recovery-memory-scope`, `--dry-run`, `--json`) and runs each dequeued queue goal through full autonomous program flow.
- Summary includes controller telemetry (`history`, `results`, final `pending_goals`, `stop_reason`, `exhausted`, dedupe/lock/session metadata) plus optional done/failed archive file paths.

Close-loop recovery (`sco auto close-loop-recover [summary]`) options:
- `summary`: optional summary file path; defaults to `latest` persisted batch summary
- `--use-action <n>`: choose remediation action index from diagnostics (`1` by default)
- `--resume-strategy <pending|failed-only>`: control recovery goal scope from source summary
- `--recover-until-complete`: keep running recovery rounds until converged or max rounds reached
- `--recover-max-rounds <n>`: max recovery rounds for until-complete mode (`1-20`, default `5`)
- `--recover-max-minutes <n>`: elapsed-time budget for recovery loop (minutes, default unlimited)
- `--recovery-memory-ttl-days <n>`: prune stale recovery memory entries before auto action selection (`0-36500`)
- `--recovery-memory-scope <scope>`: scope key for recovery memory isolation (default auto: project + git branch)
- Supports batch controls (`--batch-parallel`, `--batch-agent-budget`, `--batch-priority`, `--batch-aging-factor`, `--batch-retry*`, `--no-batch-autonomous`)
- Supports spec retention controls (`--spec-session-keep`, `--spec-session-older-than-days`, `--no-spec-session-protect-active`)
  - Includes `--spec-session-protect-window-days` to tune recent-reference protection window.
  - Includes `--spec-session-max-total` and optional `--spec-session-budget-hard-fail` for spec-count budget governance.
- Supports program gate controls (`--program-gate-profile`, `--program-gate-fallback-*`, `--program-min-success-rate`, `--program-max-risk-level`, `--program-max-elapsed-minutes`, `--program-max-agent-budget`, `--program-max-total-sub-specs`)
  - Includes `--no-program-gate-auto-remediate` to disable automatic remediation hints/prune attempts.
- Supports quality/session controls (`--dod*`, `--replan*`, `--batch-session*`, `--program-kpi-out`, `--program-audit-out`, `--out`, `--dry-run`, `--json`)
- If `--use-action` is omitted, KSE automatically selects remediation action from learned recovery memory when available.
- Output includes `recovered_from_summary`, `recovery_plan` (`applied_patch`, available remediation actions, `selection_source`, `selection_explain`), `recovery_cycle` (round history, convergence/exhausted state, elapsed/budget metadata), and `recovery_memory` (signature, scope, action stats, selection explanation).

Close-loop session maintenance:
- `sco auto session list [--limit <n>] [--status <csv>] [--json]`: list persisted close-loop sessions (`--status` supports comma-separated, case-insensitive filters)
- `sco auto session stats [--days <n>] [--status <csv>] [--json]`: aggregate persisted close-loop session telemetry within an optional recent-day window
- `sco auto session prune [--keep <n>] [--older-than-days <n>] [--dry-run] [--json]`: prune old session snapshots
  - List JSON output includes `status_filter` and `status_counts` over filtered sessions.
  - Stats JSON output includes `criteria`, completion/failure rates, `sub_spec_count_sum`, `master_spec_counts`, and `latest_sessions`.

Spec directory maintenance:
- `sco auto spec-session list [--limit <n>] [--json]`: list persisted spec directories under `.kiro/specs`
- `sco auto spec-session prune [--keep <n>] [--older-than-days <n>] [--no-protect-active] [--protect-window-days <n>] [--show-protection-reasons] [--dry-run] [--json]`: prune old spec directories by retention policy (default protects active/recent specs)
  - Protection sources include collaboration state, close-loop sessions, batch summaries, and controller sessions (via nested batch summary references).
  - JSON output always includes `protection_ranking_top` (top protected specs by reason count); `--show-protection-reasons` additionally includes per-spec `reasons` and full `protection_ranking`.
- Batch/program/recover summaries can include `spec_session_budget` telemetry when `--spec-session-max-total` is configured.

Close-loop batch session maintenance:
- `sco auto batch-session list [--limit <n>] [--status <csv>] [--json]`: list persisted close-loop-batch summary sessions (`--status` supports comma-separated, case-insensitive filters)
- `sco auto batch-session stats [--days <n>] [--status <csv>] [--json]`: aggregate persisted close-loop-batch summary telemetry within an optional recent-day window
- `sco auto batch-session prune [--keep <n>] [--older-than-days <n>] [--dry-run] [--json]`: prune old persisted batch summaries
  - List JSON output includes `status_filter` and `status_counts` over filtered sessions.
  - Stats JSON output includes `criteria`, completion/failure rates, goal-volume sums, processed ratio, and `latest_sessions`.

Close-loop controller session maintenance:
- `sco auto controller-session list [--limit <n>] [--status <csv>] [--json]`: list persisted close-loop-controller summary sessions (`--status` supports comma-separated, case-insensitive filters)
- `sco auto controller-session stats [--days <n>] [--status <csv>] [--json]`: aggregate persisted close-loop-controller status/throughput telemetry within an optional recent-day window
- `sco auto controller-session prune [--keep <n>] [--older-than-days <n>] [--dry-run] [--json]`: prune old persisted controller summaries
  - List JSON output includes `status_filter` and `status_counts` over filtered sessions.
  - Stats JSON output includes `criteria`, `status_counts`, `queue_format_counts`, completion/failure rates, goal-volume sums, and `latest_sessions`.

Cross-archive autonomous governance maintenance:
- `sco auto governance stats [--days <n>] [--status <csv>] [--json]`: aggregate a unified governance snapshot from session/batch-session/controller-session archives plus recovery memory state.
  - JSON output includes `totals`, `throughput`, `health` (`risk_level`, `concerns`, `recommendations`, `release_gate`), `top_master_specs`, `recovery_memory`, and full per-archive stats under `archives`.
- `sco auto governance maintain [--days <n>] [--status <csv>] [--session-keep <n>] [--batch-session-keep <n>] [--controller-session-keep <n>] [--recovery-memory-older-than-days <n>] [--apply] [--dry-run] [--json]`: run governance-maintenance planning and optional execution in one command.
  - Plan-only mode is default; add `--apply` to execute maintenance actions (`session prune`, `batch-session prune`, `controller-session prune`, `recovery-memory prune`).
  - When release gate is blocked, plan output prioritizes release remediation advisories (`release-gate-evidence-review`, `release-gate-scene-batch-remediate`) before routine cleanup actions.
  - JSON output includes `assessment` (pre-maintenance governance snapshot), `plan`, `executed_actions`, `summary`, and `after_assessment` (only when `--apply` without `--dry-run`).
- `sco auto governance close-loop [--days <n>] [--status <csv>] [--session-keep <n>] [--batch-session-keep <n>] [--controller-session-keep <n>] [--recovery-memory-older-than-days <n>] [--max-rounds <n>] [--target-risk <low|medium|high>] [--governance-resume <session|latest|file>] [--governance-resume-allow-drift] [--governance-session-id <id>] [--no-governance-session] [--governance-session-keep <n>] [--governance-session-older-than-days <n>] [--execute-advisory] [--advisory-recover-max-rounds <n>] [--advisory-controller-max-cycles <n>] [--plan-only] [--dry-run] [--json]`: run governance rounds until stop condition (target risk reached, release gate blocked, no actionable maintenance/advisory, non-mutating mode, maintenance/advisory failures, or max rounds).
  - `--plan-only` runs a single non-mutating planning round.
  - Governance close-loop sessions are persisted by default at `.kiro/auto/governance-close-loop-sessions/*.json`; use `--governance-resume` to continue interrupted governance loops.
  - On resume, KSE reuses persisted policy defaults (`target_risk`, `execute_advisory`, `advisory_policy`) unless explicitly overridden. Explicit policy drift is blocked by default; add `--governance-resume-allow-drift` to force override.
  - `--governance-session-keep` (with optional `--governance-session-older-than-days`) enables post-run governance session retention pruning while protecting the current session snapshot.
  - `--execute-advisory` enables automatic advisory action execution (`recover-latest`, `controller-resume-latest`) when governance assessment detects failed sessions or controller pending goals; KSE auto-selects the latest actionable advisory source and reports `skipped` (not `failed`) when no actionable source exists.
  - JSON output includes round-by-round risk/action telemetry (`rounds`, with `risk_before/risk_after` and `release_gate_before/release_gate_after`), advisory telemetry (`execute_advisory`, `advisory_policy`, `advisory_summary`, `rounds[*].advisory_actions`), `stop_detail` + `recommendations` for explicit blocking reasons, plus `initial_assessment`, `final_assessment`, and convergence metadata.
- `sco auto governance session list [--limit <n>] [--status <csv>] [--resume-only] [--json]`: list persisted governance close-loop sessions (`--resume-only` filters to resumed-chain sessions only).
- `sco auto governance session stats [--days <n>] [--status <csv>] [--resume-only] [--json]`: aggregate governance close-loop session telemetry (completion/failure/convergence, rounds, risk/stop composition, resumed-chain ratios/source counts, and aggregated `release_gate` round telemetry trends).
- `sco auto governance session prune [--keep <n>] [--older-than-days <n>] [--dry-run] [--json]`: prune governance close-loop session archive by retention policy.

Close-loop recovery memory maintenance:
- `sco auto recovery-memory show [--scope <scope>] [--json]`: inspect persisted recovery signatures/actions and aggregate stats (optionally scoped)
- `sco auto recovery-memory scopes [--json]`: inspect aggregated recovery-memory statistics grouped by scope
- `sco auto recovery-memory prune [--older-than-days <n>] [--scope <scope>] [--dry-run] [--json]`: prune stale recovery memory entries (optionally scoped)
- `sco auto recovery-memory clear [--json]`: clear persisted recovery memory state

Autonomous KPI trend:
- `sco auto kpi trend [--weeks <n>] [--mode <all|batch|program|recover|controller>] [--period <week|day>] [--csv] [--out <path>] [--json]`: aggregate periodic KPI trend from persisted autonomous summary sessions.
  - `--period <week|day>` selects weekly (default) or daily buckets.
  - `--csv` prints CSV rows to stdout and writes CSV when used with `--out` (JSON remains default).
  - JSON output includes `mode_breakdown` (batch/program/recover/controller/other run distribution), `anomaly_detection`, and flattened `anomalies` (latest-period regression checks against historical baseline, including rate-limit pressure via `average_rate_limit_signals` / `average_rate_limit_backoff_ms`).

Unified observability snapshot:
- `sco auto observability snapshot [--days <n>] [--status <csv>] [--weeks <n>] [--trend-mode <mode>] [--trend-period <period>] [--out <path>] [--json]`: generate one unified observability snapshot that combines close-loop session stats, batch stats, controller stats, governance session stats, governance health, and KPI trend.
- JSON output includes top-level `highlights` plus detailed archive/trend payloads under `snapshots`.

Agent-facing spec interfaces:
- `sco auto spec status <spec-name> [--json]`: structured status for one spec (`docs`, `task_progress`, `collaboration`, `health`).
- `sco auto spec instructions <spec-name> [--json]`: machine-readable execution instructions for one spec (`next_actions`, `priority_open_tasks`, recommended commands, document excerpts).

Autonomous archive schema compatibility:
- `sco auto schema check [--only <scopes>] [--json]`: scan archive schema compatibility (`schema_version`) for `close-loop-session`, `batch-session`, `controller-session`, and `governance-session`.
- `sco auto schema migrate [--only <scopes>] [--target-version <version>] [--apply] [--json]`: migrate/backfill `schema_version` across autonomous archives.
  - Default mode is dry-run; use `--apply` to persist changes.

Dual-track handoff integration:
- `sco auto handoff plan --manifest <path> [--out <path>] [--strict] [--strict-warnings] [--json]`: parse handoff manifest (source project, specs, templates, known gaps) and generate an executable KSE integration phase plan.
- `sco auto handoff queue --manifest <path> [--out <path>] [--append] [--no-include-known-gaps] [--dry-run] [--json]`: generate close-loop batch goal queue from handoff manifest and optionally persist line-based queue file (default `.kiro/auto/handoff-goals.lines`).
- `sco auto handoff template-diff --manifest <path> [--json]`: compare manifest templates against local template exports/registry and report `missing_in_local` and `extra_in_local`.
- `sco auto handoff capability-matrix --manifest <path> [--strict] [--strict-warnings] [--min-capability-coverage <n>] [--min-capability-semantic <n>] [--no-require-capability-semantic] [--format <json|markdown>] [--out <path>] [--remediation-queue-out <path>] [--fail-on-gap] [--json]`: generate a fast Moqui capability matrix (`template-diff + baseline + capability coverage + semantic completeness`) and optionally fail fast on gaps.
- `sco auto handoff run --manifest <path> [--out <path>] [--queue-out <path>] [--append] [--no-include-known-gaps] [--continue-from <session|latest|file>] [--continue-strategy <auto|pending|failed-only>] [--dry-run] [--strict] [--strict-warnings] [--no-dependency-batching] [--min-spec-success-rate <n>] [--max-risk-level <level>] [--no-require-ontology-validation] [--no-require-moqui-baseline] [--min-capability-coverage <n>] [--no-require-capability-coverage] [--require-release-gate-preflight] [--release-evidence-window <n>] [--json]`: execute handoff end-to-end (`plan -> queue -> close-loop-batch -> observability`) with automatic report archive to `.kiro/reports/handoff-runs/<session>.json`.
  - Default mode is dependency-aware: spec integration goals are grouped into dependency batches and executed in topological order.
  - `--continue-from` resumes pending goals from an existing handoff run report (`latest`, session id, or JSON file path). For safety, KSE enforces manifest-path consistency between the previous report and current run.
  - `--continue-strategy auto|pending|failed-only` controls resumed scope. `auto` (default) derives the best strategy from prior run state (`pending` when unprocessed/planned goals exist, otherwise `failed-only` for pure failure replay).
  - Non-dry runs auto-merge release evidence into `.kiro/reports/release-evidence/handoff-runs.json` with session-level gate/ontology/regression/moqui-baseline/capability-coverage snapshots. Merge failures are recorded as warnings without aborting the run.
  - `--release-evidence-window` controls trend snapshot window size (2-50, default `5`) used in merged release evidence (`latest_trend_window` and per-session `trend_window`).
  - Run output includes `moqui_baseline` snapshot by default, with artifacts at `.kiro/reports/release-evidence/moqui-template-baseline.json` and `.kiro/reports/release-evidence/moqui-template-baseline.md`.
  - Run output includes `moqui_capability_coverage` snapshot by default (when manifest `capabilities` is declared), with artifacts at `.kiro/reports/release-evidence/moqui-capability-coverage.json` and `.kiro/reports/release-evidence/moqui-capability-coverage.md`.
  - Run output includes `release_gate_preflight` (latest release gate history signal snapshot + blocked reasons) and carries this context into `warnings`.
  - `release_gate_preflight` is advisory by default; use `--require-release-gate-preflight` to hard-fail when preflight is unavailable/blocked.
  - When Moqui baseline/capability gates fail, KSE auto-generates remediation queue lines at `.kiro/auto/moqui-remediation.lines`.
  - Run result includes `failure_summary` (failed phase/gate/release-gate preflight highlights) and `recommendations` with executable follow-up commands (for example, auto-generated `--continue-from <session>` on failed/incomplete batches).
  - Gate defaults: `--min-spec-success-rate` defaults to `100`, `--max-risk-level` defaults to `high`, ontology validation requirement is enabled by default, Moqui baseline requirement is enabled by default, and capability coverage minimum defaults to `100` when manifest `capabilities` is declared.
  - Use `--no-require-ontology-validation`, `--no-require-moqui-baseline`, or `--no-require-capability-coverage` only for emergency bypass.
- `sco auto handoff regression [--session-id <id|latest>] [--window <n>] [--format <json|markdown>] [--out <path>] [--json]`: compare one handoff run report with its previous run and output trend deltas (success-rate/risk/failed-goals/elapsed time).
  - `--window` (2-50, default `2`) returns multi-run `series`, `window_trend`, and `aggregates` for broader regression visibility.
  - Regression JSON now includes `risk_layers` (low/medium/high/unknown buckets with per-layer session list and quality aggregates).
  - `--format` supports `json` (default) and `markdown` for human-readable report rendering.
  - Markdown report includes `Trend Series` (ASCII success/ontology bars per session) and `Risk Layer View`.
  - `--out` writes the generated regression report using the selected format.
  - Output includes `recommendations` to guide next action when trend degrades or risk escalates.
- `sco auto handoff evidence [--file <path>] [--session-id <id|latest>] [--window <n>] [--format <json|markdown>] [--out <path>] [--json]`: quick-review merged release evidence and render current-batch gate/ontology/regression/moqui-baseline/capability-coverage/risk-layer overview.
  - Default evidence file is `.kiro/reports/release-evidence/handoff-runs.json`.
  - `--window` (1-50, default `5`) controls how many recent sessions are aggregated in review.
  - JSON output includes `current_overview` (with `release_gate_preflight`, `failure_summary`, and preflight policy flags), `aggregates.status_counts`, `aggregates.gate_pass_rate_percent`, and `risk_layers`.
  - Markdown output includes `Current Gate`, `Current Release Gate Preflight`, `Current Failure Summary`, `Current Ontology`, `Current Regression`, `Current Moqui Baseline`, `Current Capability Coverage`, `Trend Series`, and `Risk Layer View`.
  - Add `--release-draft <path>` to auto-generate a release notes draft and evidence review markdown in one run.
  - `--release-version` sets draft version tag (defaults to `v<package.json version>`), and `--release-date` accepts `YYYY-MM-DD` (default: current UTC date).
  - Use `--review-out <path>` to override the generated evidence review markdown path (default `.kiro/reports/release-evidence/handoff-evidence-review.md`).
- `sco auto handoff gate-index [--dir <path>] [--history-file <path>] [--keep <n>] [--out <path>] [--json]`: aggregate `release-gate-*.json` audits into a cross-version history index.
  - Default scan dir is `.kiro/reports/release-evidence`, default output file is `.kiro/reports/release-evidence/release-gate-history.json`.
  - `--history-file` merges an existing index (for example, previous release asset) before dedup/refresh.
  - `--keep` retains latest N entries (`1-5000`, default `200`).
  - Aggregates include scene package batch, drift, and release-preflight/hard-gate signals (`scene_package_batch_*`, `drift_alert_*`, `drift_block_*`, `release_gate_preflight_*`) when present in gate reports.
  - `--markdown-out <path>` writes a human-readable trend card markdown for PR/Issue handoff.

Recommended `.kiro/config/orchestrator.json`:

```json
{
  "agentBackend": "codex",
  "maxParallel": 3,
  "timeoutSeconds": 900,
  "maxRetries": 2,
  "rateLimitMaxRetries": 6,
  "rateLimitBackoffBaseMs": 1000,
  "rateLimitBackoffMaxMs": 30000,
  "rateLimitAdaptiveParallel": true,
  "rateLimitParallelFloor": 1,
  "rateLimitCooldownMs": 30000,
  "apiKeyEnvVar": "CODEX_API_KEY",
  "codexArgs": ["--skip-git-repo-check"],
  "codexCommand": "npx @openai/codex"
}
```

`rateLimit*` settings provide dedicated retry/backoff and adaptive parallel throttling when providers return 429 / too-many-requests errors. Engine retry now also honors `Retry-After` / `try again in ...` hints from provider error messages when present, and pauses launching new pending specs during the active backoff window to reduce request bursts (launch hold remains active even if adaptive parallel throttling is disabled).

### Scene Template Engine

```bash
# Validate template variable schema in a scene package
sco scene template-validate --package <path>
sco scene template-validate --package ./my-package --json

# Resolve inheritance chain and display merged variable schema
sco scene template-resolve --package <name>
sco scene template-resolve --package scene-erp-inventory --json

# Render template package with variable substitution
sco scene template-render --package <name> --values <json-or-path> --out <dir>
sco scene template-render --package scene-erp --values '{"entity_name":"Order"}' --out ./output --json
```

### Scene Package Batch Publish

```bash
# Publish scene package templates from a handoff manifest
# Defaults: completed specs only + ontology validation required + ontology batch gate (avg>=70, valid-rate>=100%)
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --json

# Optional convenience preset for 331-style path conventions (manifest/docs fallback paths)
sco scene package-publish-batch --from-331 --json

# Preview batch publish plan without writing template files
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --dry-run --json

# Publish selected specs only
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --include 62-00-moqui-full-capability-closure-program,62-01-moqui-capability-itemized-parity-matrix --json

# Disable status filter and use docs/* fallback paths for manifest entries missing scene paths
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --status all --fallback-spec-package docs/scene-package.json --fallback-scene-manifest docs/scene.yaml --force --json

# Read specs from non-standard manifest path
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --manifest-spec-path handoff.spec_items --json

# Tighten per-spec ontology semantic quality threshold before publish
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --ontology-min-score 70 --json

# Persist ontology/publish batch report for governance tracking
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --dry-run --ontology-report-out .kiro/reports/scene-package-ontology-batch.json --json

# Enforce batch-level ontology portfolio gate (average score + valid-rate)
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --dry-run --ontology-min-average-score 60 --ontology-min-valid-rate 90 --json

# Emergency bypass (not recommended): disable ontology validation requirement
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --no-require-ontology-validation --json

# Export ontology remediation task draft markdown
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --dry-run --ontology-task-out .kiro/reports/scene-package-ontology-task-draft.md --json

# Export ontology remediation queue lines (directly consumable by close-loop-batch)
sco scene package-publish-batch --manifest docs/handoffs/handoff-manifest.json --dry-run --ontology-task-queue-out .kiro/auto/ontology-remediation.lines --json
```

### Scene Package Ontology Backfill Batch

```bash
# Backfill ontology_model from a handoff manifest (commit mode)
sco scene package-ontology-backfill-batch --manifest docs/handoffs/handoff-manifest.json --spec-package-path docs/scene-package.json --json

# Use 331-poc preset defaults in dry-run mode
sco scene package-ontology-backfill-batch --from-331 --dry-run --json

# Backfill selected specs only
sco scene package-ontology-backfill-batch --from-331 --include 62-00-moqui-full-capability-closure-program,62-01-moqui-capability-itemized-parity-matrix --dry-run --json

# Export detailed backfill report for governance review
sco scene package-ontology-backfill-batch --from-331 --dry-run --out-report .kiro/reports/scene-package-ontology-backfill-report.json --json
```

### Moqui Template Baseline Scorecard

```bash
# Preferred CLI entry: score Moqui/ERP templates in the local template library (default filter: moqui|erp)
sco scene moqui-baseline --json

# Script alias (same behavior)
npm run report:moqui-baseline

# Score all scene templates instead of Moqui/ERP subset
sco scene moqui-baseline --include-all --json

# Customize score thresholds and output paths
sco scene moqui-baseline \
  --min-score 75 \
  --min-valid-rate 100 \
  --out .kiro/reports/moqui-template-baseline.json \
  --markdown-out .kiro/reports/moqui-template-baseline.md \
  --json

# Compare with a previous baseline and fail CI on portfolio gate fail
sco scene moqui-baseline \
  --compare-with .kiro/reports/release-evidence/moqui-template-baseline-prev.json \
  --fail-on-portfolio-fail \
  --json
```

Release workflow default:
- Publishes `moqui-template-baseline.json` + `moqui-template-baseline.md` as release assets.
- Enforces baseline portfolio gate by default (`KSE_MOQUI_BASELINE_ENFORCE` defaults to `true` when unset).

### Moqui ERP Integration

```bash
# Test connectivity and authentication to Moqui ERP instance
sco scene connect --config <path>
sco scene connect --config ./moqui-config.json --json

# Discover available entities, services, and screens from Moqui ERP
sco scene discover --config <path>
sco scene discover --config ./moqui-config.json --type entities --json

# Extract scene templates from Moqui ERP instance
sco scene extract --config <path> --out <dir>
sco scene extract --config ./moqui-config.json --type entities --pattern crud --out ./templates --json
sco scene extract --config ./moqui-config.json --dry-run --json
```

### Scene Template Quality Pipeline

```bash
# Lint scene package for quality issues (10-category checks)
sco scene lint --package <path>
sco scene lint --package ./my-scene-package --json
sco scene lint --package ./my-scene-package --strict

# Calculate quality score (0-100, 5-dimension scoring with agent_readiness)
sco scene score --package <path>
sco scene score --package ./my-scene-package --json
sco scene score --package ./my-scene-package --strict

# One-stop contribute pipeline: validate → lint → score → preview → publish
sco scene contribute --package <path>
sco scene contribute --package ./my-scene-package --registry ./registry --json
sco scene contribute --package ./my-scene-package --dry-run
sco scene contribute --package ./my-scene-package --skip-lint --json
```

### Scene Ontology Enhancement

```bash
# Show ontology graph (nodes and edges) from scene manifest
sco scene ontology show --package <path>
sco scene ontology show --package ./my-scene-package --json

# Query dependency chain for a specific node reference
sco scene ontology deps --package <path> --ref <node-ref>
sco scene ontology deps --package ./my-scene-package --ref entity:Order --json

# Analyze reverse dependency impact radius (what will be affected)
sco scene ontology impact --package <path> --ref <node-ref>
sco scene ontology impact --package ./my-scene-package --ref service:createOrder --relation depends_on,composes --max-depth 2 --json

# Find shortest ontology relation path between two refs
sco scene ontology path --package <path> --from <source-ref> --to <target-ref>
sco scene ontology path --package ./my-scene-package --from service:createOrder --to entity:Order --undirected --json

# Validate ontology graph (detect dangling edges, cycles)
sco scene ontology validate --package <path>
sco scene ontology validate --package ./my-scene-package --json

# Show action abstraction info (inputs, outputs, side-effects)
sco scene ontology actions --package <path>
sco scene ontology actions --package ./my-scene-package --ref service:createOrder --json

# Parse and display data lineage (source → transform → sink)
sco scene ontology lineage --package <path>
sco scene ontology lineage --package ./my-scene-package --ref entity:Order --json

# Show agent hints (autonomous operation guidance)
sco scene ontology agent-info --package <path>
sco scene ontology agent-info --package ./my-scene-package --json
```

### Version & Upgrade

```bash
# Show version info
sco version-info

# Check for upgrades
sco upgrade check

# Perform upgrade
sco upgrade
```

---

## Global Options

```bash
# Set language
sco --lang zh <command>
sco --lang en <command>

# Show help
sco --help
sco <command> --help

# Show version
sco --version
```

---

## Common Workflows

### Starting a New Feature

```bash
# 1. Bootstrap spec draft
sco spec bootstrap --name 01-00-my-feature --non-interactive

# 2. Run spec pipeline
sco spec pipeline run --spec 01-00-my-feature

# 3. Export context
sco context export 01-00-my-feature

# 4. Work on tasks...

# 5. Sync progress
sco workspace sync
```

### Managing Multiple Projects

```bash
# 1. Register your projects as workspaces
sco workspace create project-a ~/projects/project-a
sco workspace create project-b ~/projects/project-b

# 2. List all workspaces
sco workspace list

# 3. Switch between projects
sco workspace switch project-a

# 4. Check current workspace
sco workspace info

# 5. Work on the active project...

# 6. Switch to another project
sco workspace switch project-b
```

### Setting Up Automation

```bash
# 1. Initialize watch mode
sco watch init

# 2. Install presets
sco watch install auto-sync
sco watch install test-runner

# 3. Start watching
sco watch start

# 4. Check status
sco watch status
```

### Working with Team

```bash
# 1. Check team status
sco workspace team

# 2. Claim a task
sco task claim 01-00-feature 1.1

# 3. Work on task...

# 4. Sync when done
sco workspace sync
```

### Managing Multiple Environments

```bash
# 1. Register your environments
sco env register config/dev.json
sco env register config/staging.json
sco env register config/prod.json

# 2. List all environments
sco env list

# 3. Switch to development environment
sco env switch development

# 4. Check current environment
sco env info

# 5. Verify environment is configured correctly
sco env verify

# 6. Run commands in environment context
sco env run "npm test"

# 7. Switch to staging for testing
sco env switch staging

# 8. Rollback if something goes wrong
sco env rollback
```

---

## Tips

1. **Use `sco` not legacy aliases** (`kse` / `kiro-spec-engine`) - Shorter and easier to type
2. **Add `--help` to any command** - Get detailed usage information
3. **Use tab completion** - Most shells support command completion
4. **Check `sco doctor`** - Diagnose issues quickly
5. **Use watch mode** - Automate repetitive tasks
6. **Use workspace management** - Easily switch between multiple sco projects
7. **Use environment management** - Manage dev, test, staging, prod configurations with automatic backup
8. **Use multi-repo management** - Coordinate operations across multiple Git repositories

---

## Detailed Command Documentation

### Multi-Repository Management Commands

#### `sco repo init`

Initialize repository configuration by scanning the project directory for Git repositories.

**Usage:**
```bash
sco repo init [options]
```

**Options:**
- `--force` - Overwrite existing configuration without confirmation
- `--depth <n>` - Maximum directory depth to scan (default: 3)

**Behavior:**
- Scans project directory recursively for Git repositories
- Excludes `.kiro` directory from scanning
- Extracts remote URL from `origin` remote (or first available remote)
- Detects current branch for each repository
- Prompts for confirmation if configuration already exists (unless `--force`)
- Creates `.kiro/project-repos.json` configuration file

**Example:**
```bash
# Initialize with default settings
sco repo init

# Force overwrite without confirmation
sco repo init --force

# Scan deeper directory structure
sco repo init --depth 5
```

**Output:**
```
Scanning for Git repositories...
Found 3 repositories:
  ✓ frontend (main) - https://github.com/user/frontend.git
  ✓ backend (develop) - https://github.com/user/backend.git
  ✓ shared (main) - https://github.com/user/shared.git

Configuration saved to .kiro/project-repos.json
```

---

#### `sco repo status`

Display the Git status of all configured repositories.

**Usage:**
```bash
sco repo status [options]
```

**Options:**
- `--verbose` - Show detailed file-level changes
- `--json` - Output in JSON format for scripting

**Output includes:**
- Current branch name
- Number of modified, added, and deleted files
- Commits ahead/behind remote
- Clean/dirty status indicator
- Error status for inaccessible repositories

**Example:**
```bash
# Basic status
sco repo status

# Detailed status with file changes
sco repo status --verbose

# JSON output for automation
sco repo status --json
```

**Output:**
```
┌──────────┬─────────┬────────┬──────────┬───────┬────────┐
│ Name     │ Branch  │ Status │ Modified │ Ahead │ Behind │
├──────────┼─────────┼────────┼──────────┼───────┼────────┤
│ frontend │ main    │ Clean  │ 0        │ 0     │ 0      │
│ backend  │ develop │ Dirty  │ 3        │ 2     │ 0      │
│ shared   │ main    │ Clean  │ 0        │ 0     │ 1      │
└──────────┴─────────┴────────┴──────────┴───────┴────────┘
```

---

#### `sco repo exec`

Execute a Git command in all configured repositories.

**Usage:**
```bash
sco repo exec "<command>" [options]
```

**Options:**
- `--dry-run` - Show commands without executing them
- `--continue-on-error` - Continue even if commands fail (default: true)

**Behavior:**
- Executes command sequentially in each repository
- Displays output for each repository with clear separators
- Continues with remaining repositories if one fails
- Shows summary of successes and failures at the end

**Example:**
```bash
# Pull latest changes
sco repo exec "git pull"

# Create and checkout new branch
sco repo exec "git checkout -b feature/new-feature"

# Preview without executing
sco repo exec "git push" --dry-run

# Fetch all remotes
sco repo exec "git fetch --all"

# Show commit history
sco repo exec "git log --oneline -5"
```

**Output:**
```
=== frontend ===
Already up to date.

=== backend ===
Updating abc123..def456
Fast-forward
 src/api.js | 10 +++++-----
 1 file changed, 5 insertions(+), 5 deletions(-)

=== shared ===
Already up to date.

Summary: 3 succeeded, 0 failed
```

---

#### `sco repo health`

Perform health checks on all configured repositories.

**Usage:**
```bash
sco repo health [options]
```

**Options:**
- `--json` - Output in JSON format for automation

**Checks performed:**
- Path exists and is accessible
- Directory is a valid Git repository
- Remote URL is reachable (network check)
- Default branch exists

**Example:**
```bash
# Run health check
sco repo health

# JSON output for CI/CD
sco repo health --json
```

**Output:**
```
┌──────────┬──────────────┬────────────┬──────────────────┬───────────────┐
│ Name     │ Path Exists  │ Git Repo   │ Remote Reachable │ Branch Exists │
├──────────┼──────────────┼────────────┼──────────────────┼───────────────┤
│ frontend │ ✓            │ ✓          │ ✓                │ ✓             │
│ backend  │ ✓            │ ✓          │ ✓                │ ✓             │
│ shared   │ ✓            │ ✓          │ ✗                │ ✓             │
└──────────┴──────────────┴────────────┴──────────────────┴───────────────┘

Overall Health: 2 healthy, 1 unhealthy
```

---

## See Also

- [Multi-Repository Management Guide](./multi-repo-management-guide.md)
- [Environment Management Guide](./environment-management-guide.md)
- [Manual Workflows Guide](./manual-workflows-guide.md)
- [Cross-Tool Guide](./cross-tool-guide.md)
- [Adoption Guide](./adoption-guide.md)
- [Developer Guide](./developer-guide.md)

---

**Need Help?**
- Run `sco --help` for command reference
- Check [GitHub Issues](https://github.com/heguangyong/kiro-spec-engine/issues)
- Review [Documentation](../README.md)


