# Design Document: Scene Template Instantiation

## Overview

This design implements the "last mile" closed-loop for the scene template engine: a single `scene instantiate` command that orchestrates the full pipeline from package resolution through rendering to manifest generation. It builds directly on the Spec 75 foundation functions (`resolveTemplateInheritance`, `validateTemplateVariables`, `renderTemplateFiles`) and the existing package registry infrastructure (`runScenePackageRegistryCommand`).

The core orchestration function `runSceneInstantiateCommand` follows the established normalize → validate → execute → print pattern. Additional modes (interactive, dry-run, list, JSON) are handled as branches within the same command runner. All new code is added to `lib/commands/scene.js` with tests in `tests/unit/commands/scene.test.js`.

Key design decisions:
1. **Single command, multiple modes** — `scene instantiate` handles `--list`, `--dry-run`, `--interactive`, and normal execution as mode branches rather than separate subcommands, keeping the CLI surface minimal.
2. **Reuse over reimplementation** — The pipeline calls existing functions directly rather than duplicating logic. The registry is built internally using the same scanning logic as `runScenePackageRegistryCommand`.
3. **Manifest as audit trail** — `instantiation-manifest.json` in the output directory provides per-instantiation traceability; `instantiation-log.json` provides cumulative history.
4. **Post-hooks are best-effort** — Hook failures produce warnings, not errors, since the rendering itself succeeded.

## Architecture

```mermaid
graph TD
    subgraph CLI Layer
        SI[scene instantiate]
    end

    subgraph Mode Branches
        LIST[--list mode]
        DRY[--dry-run mode]
        INT[--interactive mode]
        EXEC[normal execution]
    end

    subgraph Instantiation Pipeline
        BR[buildRegistryFromTemplateDir]
        RI[resolveTemplateInheritance]
        PV[promptMissingVariables]
        VV[validateTemplateVariables]
        RF[renderTemplateFiles]
        WM[writeInstantiationManifest]
        WL[writeInstantiationLog]
        EH[executePostHook]
    end

    subgraph Existing Infrastructure
        PR[Package Registry scanning]
        IR[Inheritance Resolver]
        SV[Schema Validator]
        TR[Template Renderer]
        FS[File System]
    end

    SI --> LIST
    SI --> DRY
    SI --> INT
    SI --> EXEC

    LIST --> BR
    DRY --> BR
    INT --> BR
    EXEC --> BR

    BR --> PR
    DRY --> RI
    INT --> RI
    EXEC --> RI

    INT --> PV
    DRY --> VV
    INT --> VV
    EXEC --> VV

    EXEC --> RF
    EXEC --> WM
    EXEC --> WL
    EXEC --> EH

    RI --> IR
    VV --> SV
    RF --> TR
end
```

The pipeline flow for normal execution:
1. **Normalize** options → **Validate** options
2. **Build registry** from template directory (reuse scanning logic)
3. **Find package** by name in registry
4. **Resolve inheritance** chain via `resolveTemplateInheritance`
5. **Parse values** from `--values` (file path or inline JSON)
6. **(Interactive only)** Prompt for missing required variables via inquirer
7. **Validate variables** via `validateTemplateVariables` against merged schema
8. **Render files** via `renderTemplateFiles` to output directory
9. **Write manifest** (`instantiation-manifest.json`) to output directory
10. **Write log entry** (append to `instantiation-log.json` in output directory)
11. **Execute post-hook** if defined in scene-package.json
12. **Print summary** (human-readable or JSON)

## Components and Interfaces

### 1. CLI Option Normalization and Validation

**`normalizeSceneInstantiateOptions(options)`**
- Input: raw CLI options object
- Normalizes: `package` (string), `values` (string), `out` (string), `templateDir` (string), `list` (boolean), `dryRun` (boolean), `interactive` (boolean), `json` (boolean)
- Returns normalized options object

**`validateSceneInstantiateOptions(options)`**
- Input: normalized options object
- Validates:
  - If `--list` is set, no other required options needed
  - Otherwise, `--package` and `--out` are required
  - `--values` is required unless `--interactive` is set
- Returns error string or `null`

### 2. Registry Building (Internal Helper)

**`buildInstantiateRegistry(templateDir, fileSystem)`**
- Input: template library directory path, file system dependency
- Scans the template directory using the same logic as `runScenePackageRegistryCommand`
- Returns array of template entries with `name`, `contract`, `variables`, `files`, `extends`, `layer`, `template_dir`, `valid`, `issues`
- This is a lightweight internal function that builds the registry data structure without the full CLI overhead

### 3. Interactive Variable Prompting

**`promptMissingVariables(schema, currentValues)`**
- Input: merged variable schema array, current values object
- Identifies required variables not present in `currentValues` and without defaults
- Uses `inquirer.prompt()` to ask for each missing variable, showing name, type, description, default
- Returns merged values object with prompted values added
- Only called when `--interactive` is active

### 4. Instantiation Manifest Builder

**`buildInstantiationManifest(packageName, chain, resolvedValues, renderedFiles, outputDir)`**
- Input: package name, inheritance chain array, resolved variable values, rendered file list, output directory
- Returns manifest object:
```javascript
{
  package_name: 'scene-erp-inventory',
  inheritance_chain: ['scene-erp-inventory', 'scene-erp', 'scene-base'],
  variables_used: { entity_name: 'Order', ... },
  files_generated: [{ path: 'requirements.md', size: 1234 }, ...],
  generated_at: '2026-02-10T12:00:00.000Z',
  output_directory: './output'
}
```

### 5. Instantiation Log Writer

**`appendInstantiationLog(logPath, entry, fileSystem)`**
- Input: path to `instantiation-log.json`, log entry object, file system dependency
- Reads existing log array (or creates empty array if file doesn't exist)
- Appends new entry and writes back
- Entry contains: `package_name`, `inheritance_chain`, `variables_used`, `files_generated_count`, `generated_at`, `output_directory`

### 6. Post-Hook Executor

**`executePostInstantiateHook(hookCommand, workingDir)`**
- Input: shell command string, working directory (output dir)
- Executes the command using `child_process.execSync` in the specified directory
- Returns `{ executed: true, exit_code: 0 }` on success
- Returns `{ executed: true, exit_code: N, warning: '...' }` on non-zero exit
- Returns `{ executed: false }` if no hook command provided

### 7. Command Runner

**`runSceneInstantiateCommand(rawOptions, dependencies)`**
- Main orchestration function following normalize → validate → execute → print
- Dependencies: `projectRoot`, `fileSystem`, `prompter` (for inquirer injection in tests)
- Mode branches:
  - `--list`: build registry → print package list → return
  - `--dry-run`: build registry → resolve → validate → compute plan → print plan → return (no file writes)
  - Normal: full pipeline as described in architecture
  - `--interactive`: same as normal but with `promptMissingVariables` step before validation

### 8. Print Function

**`printSceneInstantiateSummary(options, payload, projectRoot)`**
- Human-readable output with chalk formatting for normal mode
- JSON output when `--json` is set
- Handles all mode variants (list, dry-run, normal)

## Data Models

### Instantiation Manifest (`instantiation-manifest.json`)

```json
{
  "package_name": "scene-erp-inventory",
  "inheritance_chain": ["scene-erp-inventory", "scene-erp", "scene-base"],
  "variables_used": {
    "entity_name": "Order",
    "field_count": 5,
    "db_type": "postgres"
  },
  "files_generated": [
    { "path": "requirements.md", "size": 2048 },
    { "path": "design.md", "size": 3072 },
    { "path": "scripts/init.sh", "size": 512 }
  ],
  "generated_at": "2026-02-10T12:00:00.000Z",
  "output_directory": "./output/scene-erp-inventory"
}
```

### Instantiation Log Entry (`instantiation-log.json`)

```json
[
  {
    "package_name": "scene-erp-inventory",
    "inheritance_chain": ["scene-erp-inventory", "scene-erp", "scene-base"],
    "variables_used": { "entity_name": "Order" },
    "files_generated_count": 3,
    "generated_at": "2026-02-10T12:00:00.000Z",
    "output_directory": "./output/scene-erp-inventory"
  }
]
```

### Post-Hook Configuration (in scene-package.json)

```json
{
  "contract": {
    "post_instantiate_hook": "npm install"
  }
}
```

### Instantiation Result Payload

```javascript
{
  instantiated: true,
  mode: 'normal', // 'list' | 'dry-run' | 'normal'
  package_name: 'scene-erp-inventory',
  inheritance_chain: ['scene-erp-inventory', 'scene-erp', 'scene-base'],
  variables: { entity_name: 'Order', field_count: 5 },
  files: [{ source: 'requirements.md', target: 'requirements.md', size: 2048 }],
  manifest_path: 'output/instantiation-manifest.json',
  log_path: 'output/instantiation-log.json',
  hook: { executed: true, exit_code: 0 },
  errors: [],
  summary: {
    total_files: 3,
    total_bytes: 5632,
    variables_used: 3
  }
}
```

### Dry-Run Plan Payload

```javascript
{
  instantiated: false,
  mode: 'dry-run',
  package_name: 'scene-erp-inventory',
  inheritance_chain: ['scene-erp-inventory', 'scene-erp', 'scene-base'],
  variables: { entity_name: 'Order', field_count: 5 },
  files_planned: ['requirements.md', 'design.md', 'scripts/init.sh'],
  hook_command: 'npm install',
  errors: []
}
```

### List Mode Payload

```javascript
{
  mode: 'list',
  templates: [
    {
      name: 'scene-base',
      layer: 'l1-capability',
      coordinate: 'scene/base/1.0.0',
      valid: true
    }
  ],
  summary: {
    total_templates: 5,
    valid_templates: 4,
    invalid_templates: 1
  }
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Manifest completeness and validity

*For any* successful instantiation (valid package, valid values, valid schema), the `instantiation-manifest.json` written to the output directory SHALL be valid JSON containing the fields `package_name`, `inheritance_chain`, `variables_used`, `files_generated`, `generated_at`, and `output_directory`, where `files_generated` lists every rendered file with its relative path and byte size.

**Validates: Requirements 1.5, 2.1, 2.2, 2.3**

### Property 2: Dry-run writes no files

*For any* invocation with `--dry-run` and valid inputs (resolvable package, valid values), zero files SHALL be written to the output directory — no rendered files, no `instantiation-manifest.json`, and no `instantiation-log.json`.

**Validates: Requirements 4.1, 4.3, 8.5**

### Property 3: Dry-run plan contains required information

*For any* invocation with `--dry-run` and valid inputs, the returned payload SHALL contain `files_planned` (list of files that would be generated), `variables` (resolved variable values), and `inheritance_chain` (package chain from target to root).

**Validates: Requirements 4.2**

### Property 4: Interactive prompting merges missing variables

*For any* variable schema with N missing required variables (no default, no supplied value) and `--interactive` mode, the engine SHALL issue N prompts and merge all prompted values into the final values map before validation.

**Validates: Requirements 3.1, 3.3**

### Property 5: Non-interactive missing variables produce errors

*For any* variable schema with missing required variables (no default, no supplied value) and `--interactive` NOT set, the engine SHALL return validation errors without issuing any prompts and without writing any output files.

**Validates: Requirements 3.4, 1.7**

### Property 6: Missing package produces error

*For any* package name not present in the registry, the engine SHALL return an error identifying the missing package name and set a non-zero exit code, without writing any output files.

**Validates: Requirements 1.6**

### Property 7: Instantiation log accumulation

*For any* sequence of N successful instantiations to the same output directory, the `instantiation-log.json` SHALL contain exactly N entries, each with the fields `package_name`, `inheritance_chain`, `variables_used`, `files_generated_count`, `generated_at`, and `output_directory`.

**Validates: Requirements 8.1, 8.3, 8.4**

### Property 8: Values parsing dispatch

*For any* `--values` argument ending with `.json`, the engine SHALL read from the file path; for any `--values` argument not ending with `.json`, the engine SHALL parse the argument as inline JSON. In both cases, the resulting parsed object SHALL be equivalent.

**Validates: Requirements 9.1, 9.2**

### Property 9: List mode shows all registry packages

*For any* template registry containing N valid packages, `--list` mode SHALL return a payload listing all N packages with their `name`, `layer`, and `coordinate` fields.

**Validates: Requirements 6.1**

### Property 10: Post-hook execution after rendering

*For any* package with a `post_instantiate_hook` defined in its contract, the engine SHALL execute the hook command in the output directory after successful rendering.

**Validates: Requirements 7.1**

### Property 11: Post-hook failure does not fail instantiation

*For any* post-hook command that exits with a non-zero code, the instantiation result SHALL still be marked as successful (`instantiated: true`) with a warning message about the hook failure.

**Validates: Requirements 7.2**

### Property 12: JSON output mode produces valid JSON

*For any* invocation with `--json` set (in any mode: normal, dry-run, or list), the stdout output SHALL be a valid JSON payload representing the full result.

**Validates: Requirements 5.1**

### Property 13: Backward compatibility for existing contracts

*For any* existing valid scene-package.json contract that does not contain the `post_instantiate_hook` field, the existing contract validation SHALL continue to return `valid: true`.

**Validates: Requirements 10.5**

## Error Handling

| Error Condition | Handler | Behavior |
|---|---|---|
| Package not found in registry | `runSceneInstantiateCommand` | Print error with package name, set `process.exitCode = 1` |
| Variable validation fails | `runSceneInstantiateCommand` | Print all validation errors, set exit code 1, write no files |
| Values file not found | `runSceneInstantiateCommand` | Print error with file path, set exit code 1 |
| Values JSON parse failure | `runSceneInstantiateCommand` | Print parse error, set exit code 1 |
| Inheritance resolution fails (cycle/missing parent) | `runSceneInstantiateCommand` | Print inheritance error, set exit code 1 |
| Template directory not found | `runSceneInstantiateCommand` | Print error with directory path, set exit code 1 |
| File write failure during rendering | `renderTemplateFiles` | Collect error, return `rendered: false` |
| Manifest write failure | `runSceneInstantiateCommand` | Print warning, instantiation still considered successful |
| Log write failure | `appendInstantiationLog` | Print warning, instantiation still considered successful |
| Post-hook non-zero exit | `executePostInstantiateHook` | Print warning, instantiation still considered successful |
| Post-hook execution error (command not found) | `executePostInstantiateHook` | Print warning, instantiation still considered successful |
| Empty registry (--list mode) | `runSceneInstantiateCommand` | Print "no templates found" message |

All error paths follow the existing pattern: structured error objects for pure functions, `console.error(chalk.red(...))` + `process.exitCode = 1` for CLI commands.

## Testing Strategy

### Property-Based Testing

Library: **fast-check** (already in devDependencies)

Each correctness property maps to a single property-based test with minimum 100 iterations. Tests are tagged with:
```
Feature: scene-template-instantiation, Property N: <property_text>
```

Key generators needed:
- `arbitraryRegistryWithPackage()` — generates a registry array with at least one valid package entry, including contract with variables, files, and optional extends
- `arbitraryValidValuesForSchema(schema)` — generates a values object that satisfies all required variables and validation rules for a given schema
- `arbitraryInvalidValuesForSchema(schema)` — generates a values object that violates at least one validation rule
- `arbitraryPackageName()` — generates valid package name strings
- `arbitraryHookCommand()` — generates simple shell command strings

### Unit Testing

Unit tests cover:
- CLI option normalization and validation (`normalizeSceneInstantiateOptions`, `validateSceneInstantiateOptions`)
- `buildInstantiationManifest` — specific examples with known inputs
- `appendInstantiationLog` — create new log, append to existing log, handle corrupt log file
- `executePostInstantiateHook` — mock `child_process.execSync`, test success/failure/missing hook
- `promptMissingVariables` — mock inquirer, test prompt generation for various schema shapes
- `buildInstantiateRegistry` — test scanning with valid/invalid/empty template directories
- `runSceneInstantiateCommand` — integration tests for each mode (normal, list, dry-run, interactive, JSON)
- Edge cases: empty registry, empty values, package with no variables, deeply nested inheritance

### Test Organization

All tests in `tests/unit/commands/scene.test.js` following existing patterns:
- `describe('normalizeSceneInstantiateOptions', ...)`
- `describe('validateSceneInstantiateOptions', ...)`
- `describe('buildInstantiationManifest', ...)`
- `describe('appendInstantiationLog', ...)`
- `describe('executePostInstantiateHook', ...)`
- `describe('promptMissingVariables', ...)`
- `describe('buildInstantiateRegistry', ...)`
- `describe('scene instantiate command', ...)`

### Testing Configuration

- Property tests: minimum 100 iterations per property
- Each property test references its design document property number
- Tag format: `Feature: scene-template-instantiation, Property N: <title>`
- Each correctness property is implemented by a single property-based test
- Unit tests focus on specific examples, edge cases, and error conditions
- Property tests focus on universal properties across all valid inputs
