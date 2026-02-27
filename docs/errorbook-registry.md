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

## 3) Project-Side Configuration

Create `.sce/config/errorbook-registry.json`:

```json
{
  "enabled": true,
  "cache_file": ".sce/errorbook/registry-cache.json",
  "sources": [
    {
      "name": "central",
      "enabled": true,
      "url": "https://raw.githubusercontent.com/<your-org>/sce-errorbook-registry/main/registry/errorbook-registry.json"
    }
  ]
}
```

Notes:
- `url` must be a raw JSON URL (`raw.githubusercontent.com`) or use a local file path.
- Local cache file is used by `sce errorbook find --include-registry`.

## 4) Daily Workflow

1. Export curated local entries:
```bash
sce errorbook export --status promoted --min-quality 75 --out .sce/errorbook/exports/registry.json --json
```

2. Merge approved entries into central repo `registry/errorbook-registry.json`.

3. Sync central registry into local cache:
```bash
sce errorbook sync-registry --source https://raw.githubusercontent.com/<your-org>/sce-errorbook-registry/main/registry/errorbook-registry.json --json
```

4. Search local + shared entries:
```bash
sce errorbook find --query "approve order timeout" --include-registry --json
```

## 5) Governance Rules

- Publish to central registry only curated entries (recommended: `status=promoted` and `quality>=75`).
- Do not publish sensitive tenant/customer data.
- Temporary mitigation entries must remain bounded and governed (exit criteria, cleanup task, deadline).
- Keep central registry append-only by PR review; deprecate low-value entries through normal curation.
