# Release Checklist

> Minimal, repeatable checklist before publishing a new kse version.

---

## 1. Functional Verification

```bash
# Core CI suite
npm run test:ci

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

Then proceed with your release workflow (tag, push, npm publish, GitHub release).
