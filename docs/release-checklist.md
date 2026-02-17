# Release Checklist

> Minimal, repeatable checklist before publishing a new kse version.

---

## 1. Functional Verification

```bash
# Fast CI smoke suite (integration-focused)
npm run test:smoke

# Full regression suite (unit + integration + properties)
npm run test:full

# Guardrail: fail on newly introduced .skip tests
npm run test:skip-audit

# Unit tests for value observability commands
npm test -- tests/unit/commands/value-metrics.test.js

# CLI smoke checks
node bin/kiro-spec-engine.js --help
node bin/kiro-spec-engine.js value metrics --help
```

---

## 2. Value Observability Smoke Flow

```bash
kse value metrics sample --out ./kpi-input.json --json
kse value metrics snapshot --input ./kpi-input.json --json
```

Expected:

- `sample` writes a valid JSON scaffold.
- `snapshot` returns machine-readable result with `snapshot_path` and risk metadata.

---

## 3. Packaging Hygiene

```bash
npm pack --dry-run
```

Verify:

- No transient artifacts (for example `__pycache__`, `*.pyc`) in tarball listing.
- Tarball size remains within expected range for current release.

---

## 4. Documentation Consistency

Check that key docs are aligned with current version and capabilities:

- `README.md`
- `README.zh.md`
- `docs/command-reference.md`
- `docs/quick-start.md`
- `docs/zh/quick-start.md`
- `CHANGELOG.md`

Optional sanity scan:

```bash
rg -n "yourusername|support@example.com" README.md README.zh.md docs docs/zh -S

# Canonical repository link check (should return no matches)
rg -n "github.com/kiro-spec-engine/kse" README.md README.zh.md docs START_HERE.txt INSTALL_OFFLINE.txt -S -g "!docs/release-checklist.md" -g "!docs/zh/release-checklist.md"
```

---

## 5. Git Readiness

```bash
git status -sb
git log --oneline -n 15
```

Verify:

- Working tree is clean.
- Commits are logically grouped and messages are release-ready.

---

## 6. Publish Readiness

Ensure:

- `package.json` version is correct.
- `CHANGELOG.md` includes release-relevant entries.
- Release notes draft exists (for example `docs/releases/vX.Y.Z.md`).
- Optional: configure release evidence gate with repository variables (`Settings -> Secrets and variables -> Actions -> Variables`):
  - `KSE_RELEASE_GATE_ENFORCE`: `true|false` (default advisory, non-blocking)
  - `KSE_RELEASE_GATE_REQUIRE_EVIDENCE`: require `handoff-runs.json` summary
  - `KSE_RELEASE_GATE_REQUIRE_GATE_PASS`: require evidence gate `passed=true` (default true when evidence exists)
  - `KSE_RELEASE_GATE_MIN_SPEC_SUCCESS_RATE`: minimum allowed success rate percent
  - `KSE_RELEASE_GATE_MAX_RISK_LEVEL`: `low|medium|high|unknown` (default `unknown`)
  - `KSE_RELEASE_GATE_MAX_UNMAPPED_RULES`: maximum allowed unmapped ontology business rules
  - `KSE_RELEASE_GATE_MAX_UNDECIDED_DECISIONS`: maximum allowed undecided ontology decisions
- Optional: tune release drift alerts in release notes:
  - `KSE_RELEASE_DRIFT_ENFORCE`: `true|false` (default `false`), block publish when drift alerts are triggered
  - `KSE_RELEASE_DRIFT_FAIL_STREAK_MIN`: minimum consecutive failed gates to trigger alert (default `2`)
  - `KSE_RELEASE_DRIFT_HIGH_RISK_SHARE_MIN_PERCENT`: minimum high-risk share in latest 5 versions (default `60`)
  - `KSE_RELEASE_DRIFT_HIGH_RISK_SHARE_DELTA_MIN_PERCENT`: minimum short-vs-long high-risk share delta (default `25`)
- Optional local dry-run for gate history index artifact:
  - `kse auto handoff gate-index --dir .kiro/reports/release-evidence --out .kiro/reports/release-evidence/release-gate-history.json --json`

Then proceed with your release workflow (tag, push, npm publish, GitHub release).
