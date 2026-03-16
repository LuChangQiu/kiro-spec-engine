# Errorbook Registry Guide

This guide defines how to run a shared, cross-project `errorbook` registry as a dedicated GitHub repository.

## 1) Repository Scope

- Repository role: shared curated failure/remediation knowledge.
- Recommended repo name: `sce-errorbook-registry`.
- Keep this repository independent from scene/spec template repositories.

## 2) Recommended Repository Structure

```text
sce-errorbook-registry/
  registry/
    errorbook-registry.json
  README.md
```

`registry/errorbook-registry.json` should follow:

```json
{
  "api_version": "sce.errorbook.registry/v0.1",
  "generated_at": "2026-02-27T00:00:00.000Z",
  "source": {
    "project": "curation-pipeline",
    "statuses": ["promoted"],
    "min_quality": 75
  },
  "total_entries": 0,
  "entries": []
}
```

For large registries, add an index + shard layout:

```text
registry/
  errorbook-registry.index.json
  shards/
    order.json
    payment.json
    auth.json
```

Example `registry/errorbook-registry.index.json`:

```json
{
  "api_version": "sce.errorbook.registry-index/v0.1",
  "generated_at": "2026-02-27T00:00:00.000Z",
  "min_token_length": 2,
  "token_to_bucket": {
    "order": "order",
    "approve": "order",
    "payment": "payment"
  },
  "buckets": {
    "order": "https://raw.githubusercontent.com/heguangyong/sce-errorbook-registry/main/registry/shards/order.json",
    "payment": "https://raw.githubusercontent.com/heguangyong/sce-errorbook-registry/main/registry/shards/payment.json"
  }
}
```

## 3) Project-Side Configuration

Create `.sce/config/errorbook-registry.json`:

```json
{
  "enabled": true,
  "search_mode": "remote",
  "cache_file": ".sce/errorbook/registry-cache.json",
  "project_shared_projection": {
    "enabled": true,
    "file": ".sce/knowledge/errorbook/project-shared-registry.json",
    "statuses": ["verified", "promoted"],
    "min_quality": 75
  },
  "sources": [
    {
      "name": "central",
      "enabled": true,
      "url": "https://raw.githubusercontent.com/heguangyong/sce-errorbook-registry/main/registry/errorbook-registry.json",
      "index_url": "https://raw.githubusercontent.com/heguangyong/sce-errorbook-registry/main/registry/errorbook-registry.index.json"
    },
    {
      "name": "project-shared",
      "enabled": true,
      "file": ".sce/knowledge/errorbook/project-shared-registry.json"
    }
  ]
}
```

Notes:
- `url` must be a raw JSON URL (`raw.githubusercontent.com`) or use a local file path.
- `search_mode` supports `cache|remote|hybrid` (recommended: `remote` for very large registries).
- Local cache file is used by cache/hybrid mode.
- `project_shared_projection` is the Git-tracked same-project sharing path used for cross-computer co-work continuity.
- Since `v3.3.23`, `sce init` / `sce adopt` template baselines include registry config by default; current baseline also seeds the tracked project-shared projection file.

## 4) Daily Workflow

1. Keep project-shared same-project knowledge current:
```bash
# SCE refreshes this automatically after record/promote/deprecate/requalify
.sce/knowledge/errorbook/project-shared-registry.json
```

2. Export curated local entries for central cross-project publication:
```bash
sce errorbook export --status promoted --min-quality 75 --out .sce/errorbook/exports/registry.json --json
```

3. Merge approved entries into central repo `registry/errorbook-registry.json`.

4. Sync central registry into local cache:
```bash
sce errorbook sync-registry --source https://raw.githubusercontent.com/heguangyong/sce-errorbook-registry/main/registry/errorbook-registry.json --json
```

5. Search local + shared entries:
```bash
sce errorbook find --query "approve order timeout" --include-registry --json
sce errorbook find --query "approve order timeout" --include-registry --registry-mode remote --json

# Validate central registry health (config/source/index/shard)
sce errorbook health-registry --json
# Optional strict gate in CI/release
SCE_REGISTRY_HEALTH_STRICT=1 node scripts/errorbook-registry-health-gate.js --json
```

## 5) Governance Rules

- Same-project co-work should rely on the tracked project-shared projection instead of committing raw `.sce/errorbook/**`.
- Publish to central registry only curated entries (recommended: `status=promoted` and `quality>=75`).
- Do not publish sensitive tenant/customer data.
- Temporary mitigation entries must remain bounded and governed (exit criteria, cleanup task, deadline).
- Keep central registry append-only by PR review; deprecate low-value entries through normal curation.
- Recommended central repo gates:
  - `node scripts/validate-registry.js`
  - `node scripts/check-index-coverage.js --min-coverage 85`
- Recommended project-side release gates:
  - `npm run gate:errorbook-registry-health` (advisory default)
  - `SCE_REGISTRY_HEALTH_STRICT=1 npm run gate:errorbook-registry-health` (strict)
