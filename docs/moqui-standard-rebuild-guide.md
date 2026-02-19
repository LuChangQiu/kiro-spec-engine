# Moqui Standard Rebuild Guide

This guide bootstraps a standard Moqui recovery bundle using SCE templates and metadata.
It is designed to avoid direct interference with an in-progress `331-poc` repair stream.

## Goal

- Rebuild baseline business capability assets from metadata.
- Keep original Moqui technology stack unchanged.
- Add a page-level human/AI copilot dialog contract for contextual fixes.

## Recommended Workspace Strategy

1. Keep SCE in `E:/workspace/kiro-spec-engine` for reusable rebuild tooling.
2. Keep business rebuild target isolated (recommended): `E:/workspace/331-poc-rebuild`.
3. Do not write generated recovery files into live `331-poc` unless explicitly approved.

## Input Metadata (minimum)

Provide a JSON file with at least one of these arrays:

- `entities`
- `services`
- `screens`
- `forms`

Optional:

- `business_rules`
- `decisions`

## Run

```bash
node scripts/moqui-standard-rebuild.js \
  --metadata docs/moqui/metadata-catalog.json \
  --out .kiro/reports/recovery/moqui-standard-rebuild.json \
  --markdown-out .kiro/reports/recovery/moqui-standard-rebuild.md \
  --bundle-out .kiro/reports/recovery/moqui-standard-bundle \
  --json
```

## Generated Bundle

- `handoff/handoff-manifest.json`: seed manifest for SCE handoff gates.
- `ontology/moqui-ontology-seed.json`: initial ontology graph seed.
- `rebuild/recovery-spec-plan.json`: ordered recovery spec list.
- `copilot/page-context-contract.json`: page-context contract for copilot dialog.
- `copilot/conversation-playbook.md`: operational playbook for human/AI page fixes.

## Next Step for Business Project

Use generated assets as input to a dedicated rebuild project (for example `331-poc-rebuild`) and execute normal SCE handoff + gate flows there.
