# Moqui Binding Rules and Compatibility Matrix v0.1

## Primary Sources

- `backend/framework/xsd/common-types-3.xsd`
- `backend/framework/xsd/entity-definition-3.xsd`
- `backend/framework/src/main/resources/MoquiDefaultConf.xml`
- `backend/framework/src/main/java/org/moqui/impl/entity/EntityDefinition.java`

## Naming Rules

- Moqui field name follows lowerCamel style (`name-field` pattern).
- Scene/DataContract references must use canonical `EntityName.fieldName`.
- Do not redefine business field names in control metadata.

## Type Compatibility (Contract -> Moqui)

| Contract Type | Moqui field-type options (preferred) | Notes |
| --- | --- | --- |
| `id` | `id`, `id-long` | Keep semantic ids in business model; avoid overloading control ids |
| `string.short` | `text-short` | User-facing short labels and codes |
| `string.medium` | `text-medium` | Generic descriptions |
| `string.long` | `text-intermediate`, `text-long`, `text-very-long` | Pick by payload size and query needs |
| `boolean` | `text-indicator` | Use model-level conventions for Y/N style fields |
| `integer` | `number-integer` | Counters and version fields |
| `decimal` | `number-decimal`, `currency-amount`, `currency-precise` | Financial fields should use currency types |
| `float` | `number-float` | Avoid for money calculations |
| `date` | `date` | Date-only business semantics |
| `time` | `time` | Time-only semantics |
| `datetime` | `date-time` | Timeline, events, audit timestamps |
| `binary` | `binary-very-long` | Blob-like payloads |

## Managed Fields and Reserved Semantics

- `lastUpdatedStamp` is framework-managed and auto-added unless `no-update-stamp=true`.
- Scene/DataContract should treat `lastUpdatedStamp` as read-only unless there is an explicit override reason.
- DB-specific SQL type choices stay in Moqui dictionary profile, not in Scene contract.

## Collision Prevention Rules

High-collision business names:

- `id`
- `statusId`
- `userId`
- `partyId`
- `fromDate`
- `thruDate`

Control-plane replacement keys:

- `obj_id`
- `obj_state`
- `owner_principal`
- `policy_ref`
- `eval_ref`

## Validation Checklist for Scene/DataContract

- Every field reference is resolvable to existing `EntityName.fieldName`.
- Field type mapping exists in Moqui dictionary semantics.
- Write-set excludes framework-managed fields by default.
- State transition guards reference business fields, not control metadata.
- Contract does not include DB vendor SQL details.

## Enforcement Recommendation

- Add a static checker step before commit mode:
  - Name pattern check
  - Entity/field existence check
  - Type compatibility check
  - Reserved field policy check