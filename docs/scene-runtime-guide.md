# Scene Runtime Guide

> Complete guide to kse Scene features: Template Engine, Quality Pipeline, Ontology, and Moqui ERP Integration

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

---

## Overview

The kse Scene Runtime is a suite of features for building, validating, scoring, and analyzing reusable scene template packages. Scene packages describe business capabilities (e.g., ERP inventory management) as structured templates that AI agents can understand and instantiate.

### Feature Timeline

| Version | Feature | Description |
|---------|---------|-------------|
| v1.25.0 | Scene Template Engine | Variable schema, multi-file rendering, three-layer inheritance |
| v1.39.0 | Moqui ERP Adapter | Connect to Moqui ERP instances, entity CRUD, service invocation |
| v1.40.0 | Moqui Template Extractor | Analyze Moqui resources, generate scene templates |
| v1.41.0 | Quality Pipeline | Lint engine, quality scoring, contribute pipeline |
| v1.42.0 | Ontology Enhancement | Semantic graph, action abstraction, data lineage, agent hints |

---

## Scene Template Engine (v1.25.0)

### Variable Schema

Define typed variables in `scene-package.json`:

```json
{
  "variables": {
    "entity_name": {
      "type": "string",
      "required": true,
      "description": "Primary entity name"
    },
    "enable_audit": {
      "type": "boolean",
      "default": false
    },
    "db_type": {
      "type": "enum",
      "values": ["mysql", "postgres", "moqui"],
      "default": "postgres"
    }
  }
}
```

Supported types: `string`, `number`, `boolean`, `enum`, `array`.

### Multi-File Rendering

Templates support Handlebars-style syntax:

- `{{variable}}` — Variable substitution
- `{{#if condition}}...{{/if}}` — Conditional blocks
- `{{#each items}}...{{/each}}` — Loop blocks

### Three-Layer Inheritance

```
L1-Capability (base)     → e.g., scene-crud-base
  └─ L2-Domain (domain)  → e.g., scene-erp-inventory
       └─ L3-Instance    → e.g., scene-erp-inventory-order
```

Each layer can extend the parent's variable schema and template files. The `template-resolve` command shows the merged result.

### CLI Commands

```bash
# Validate variable schema
kse scene template-validate --package <path>
kse scene template-validate --package ./my-package --json

# Resolve inheritance chain
kse scene template-resolve --package <name>
kse scene template-resolve --package scene-erp-inventory --json

# Render templates with variable values
kse scene template-render --package <name> --values <json-or-path> --out <dir>
kse scene template-render --package scene-erp --values '{"entity_name":"Order"}' --out ./output --json
```

---

## Moqui ERP Integration (v1.39.0 ~ v1.40.0)

### Architecture

```
MoquiClient (HTTP + JWT auth)
    └─ MoquiAdapter (binding handler for spec.erp.* / moqui.* refs)
         └─ MoquiExtractor (analyze resources → generate templates)
```

### MoquiClient

HTTP client with JWT authentication lifecycle:
- Login / refresh / re-login / logout
- Automatic token refresh on expiry
- Configurable retry logic

### MoquiAdapter

Binding handler that resolves `spec.erp.*` and `moqui.*` references:
- Entity CRUD operations
- Service invocation
- Screen discovery

### MoquiExtractor (v1.40.0)

Analyzes Moqui ERP resources and generates reusable scene templates:
- Entity grouping by Header/Item suffix patterns (e.g., `OrderHeader` + `OrderItem` → composite)
- Pattern-based manifest generation with governance contracts
- Dry-run mode for preview

### CLI Commands

```bash
# Test connectivity
kse scene connect --config <path>
kse scene connect --config ./moqui-config.json --json

# Discover entities, services, screens
kse scene discover --config <path>
kse scene discover --config ./moqui-config.json --type entities --json

# Extract scene templates
kse scene extract --config <path> --out <dir>
kse scene extract --config ./moqui-config.json --type entities --pattern crud --out ./templates --json
kse scene extract --config ./moqui-config.json --dry-run --json
```

### Configuration File

```json
{
  "baseUrl": "https://moqui.example.com",
  "username": "admin",
  "password": "secret",
  "tenant": "DEFAULT"
}
```

---

## Quality Pipeline (v1.41.0 ~ v1.42.0)

### Lint Engine

10-category quality checks:

| # | Category | Description |
|---|----------|-------------|
| 1 | Manifest Completeness | Required fields in scene-package.json and scene.yaml |
| 2 | Binding Refs | Valid ref prefixes and format |
| 3 | Governance Contract | Risk levels, approval rules, audit requirements |
| 4 | Consistency | Cross-file consistency between package and manifest |
| 5 | Variables | Variable schema validity and usage |
| 6 | Documentation | README, descriptions, examples |
| 7 | Naming Conventions | kebab-case names, semver versions |
| 8 | Action Abstraction | Intent, preconditions, postconditions per binding (v1.42.0) |
| 9 | Data Lineage | Source → transform → sink tracking (v1.42.0) |
| 10 | Agent Hints | Agent-ready metadata completeness (v1.42.0) |

### Quality Score

4 base dimensions + 1 bonus dimension:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Contract Validity | 30 | scene-package.json and scene.yaml structure |
| Lint Pass Rate | 30 | Percentage of lint checks passed |
| Documentation Quality | 20 | README, descriptions, examples |
| Governance Completeness | 20 | Risk levels, approval, audit |
| Agent Readiness (bonus) | +10 max | Action abstraction + data lineage + agent hints |

Total possible score: 110 (100 base + 10 bonus).

### Contribute Pipeline

One-stop workflow: validate → lint → score → preview → publish.

```bash
# Full pipeline
kse scene contribute --package <path>

# With registry target
kse scene contribute --package ./my-package --registry ./registry --json

# Dry-run (preview only)
kse scene contribute --package ./my-package --dry-run

# Skip lint step
kse scene contribute --package ./my-package --skip-lint --json
```

### CLI Commands

```bash
# Lint
kse scene lint --package <path>
kse scene lint --package ./my-package --json
kse scene lint --package ./my-package --strict

# Score
kse scene score --package <path>
kse scene score --package ./my-package --json
kse scene score --package ./my-package --strict
```

---

## Ontology Enhancement (v1.42.0)

### OntologyGraph

A semantic relationship graph built from scene manifest bindings:

```
Node: binding ref (e.g., "entity:Order", "service:createOrder")
Edge: relationship (depends_on, composes, extends, produces)
```

### Relationship Types

| Type | Meaning | Example |
|------|---------|---------|
| `depends_on` | Requires another node | service:createOrder → entity:Order |
| `composes` | Contains/aggregates | entity:OrderHeader → entity:OrderItem |
| `extends` | Inherits from | entity:PurchaseOrder → entity:Order |
| `produces` | Outputs/creates | service:processOrder → entity:Invoice |

### Action Abstraction

Each binding can declare:
- `intent` — What the action does
- `preconditions` — What must be true before execution
- `postconditions` — What will be true after execution

This enables AI agents to reason about operations before executing them.

### Data Lineage

Track data flow through the system:

```
source → transform → sink
```

Defined in `governance_contract.data_lineage`:
```json
{
  "data_lineage": [
    {
      "source": "entity:OrderHeader",
      "transform": "service:calculateTotal",
      "sink": "entity:OrderSummary"
    }
  ]
}
```

### Impact & Path Queries

Use ontology as an operational graph, not just static visualization:
- `impact`: reverse-traverse matching relations to estimate blast radius from one changed ref
- `path`: find the shortest relation path between two refs for dependency explainability

### Agent Hints

The `agent_hints` field provides metadata for autonomous AI operation:

```json
{
  "agent_hints": {
    "summary": "CRUD operations for Order entity",
    "complexity": "medium",
    "estimated_duration": "5min",
    "required_permissions": ["entity:Order:read", "entity:Order:write"],
    "recommended_sequence": ["createOrder", "addItems", "calculateTotal"]
  }
}
```

### Agent Readiness Score

Quality scoring bonus dimension (max +10 points) based on:
- Action abstraction completeness
- Data lineage coverage
- Agent hints presence and quality

### CLI Commands

```bash
# Show ontology graph
kse scene ontology show --package <path>
kse scene ontology show --package ./my-package --json

# Query dependency chain
kse scene ontology deps --package <path> --ref <node-ref>
kse scene ontology deps --package ./my-package --ref entity:Order --json

# Query reverse impact radius
kse scene ontology impact --package <path> --ref <node-ref>
kse scene ontology impact --package ./my-package --ref service:createOrder --relation depends_on,composes --max-depth 2 --json

# Query shortest relation path between two refs
kse scene ontology path --package <path> --from <source-ref> --to <target-ref>
kse scene ontology path --package ./my-package --from service:createOrder --to entity:Order --undirected --json

# Validate graph (dangling edges, cycles)
kse scene ontology validate --package <path>
kse scene ontology validate --package ./my-package --json

# Show action abstraction
kse scene ontology actions --package <path>
kse scene ontology actions --package ./my-package --ref service:createOrder --json

# Show data lineage
kse scene ontology lineage --package <path>
kse scene ontology lineage --package ./my-package --ref entity:Order --json

# Show agent hints
kse scene ontology agent-info --package <path>
kse scene ontology agent-info --package ./my-package --json
```

---

## See Also

- [Command Reference](command-reference.md) — Complete CLI command documentation
- [Architecture](architecture.md) — System architecture overview
- [Developer Guide](developer-guide.md) — Contributing and extending kse

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11
