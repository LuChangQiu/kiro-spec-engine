# Requirements Document: Scene Template Instantiation

## Introduction

This spec implements the "last mile" closed-loop for the scene template engine: a single `scene instantiate` command that takes a template package name, user-supplied variable values, and an output directory, then produces fully rendered output files with a manifest recording the instantiation. It builds on the Spec 75 foundation (template variable schema validation, multi-file rendering, three-layer inheritance resolution) and the existing package registry infrastructure. Additional capabilities include interactive variable prompting, dry-run preview, instantiation history tracking, post-instantiation hooks, and listing available template packages.

## Glossary

- **Instantiation_Engine**: The orchestration component that coordinates package resolution, inheritance merging, variable validation, template rendering, and manifest generation into a single end-to-end pipeline
- **Instantiation_Manifest**: A JSON file (`instantiation-manifest.json`) written to the output directory recording what was generated, with which variable values, from which package, and when
- **Instantiation_Log**: A JSON file (`instantiation-log.json`) stored under `.sce/specs/{spec-name}/` that accumulates a history of all instantiations performed for a given spec
- **Post_Hook**: An optional shell command defined in the scene-package.json contract that the Instantiation_Engine executes after successful rendering (e.g., `npm install`, `gradle build`)
- **Interactive_Mode**: A CLI mode activated by `--interactive` that prompts the user for each missing required variable value using inquirer
- **Dry_Run_Mode**: A CLI mode activated by `--dry-run` that computes and displays the full instantiation plan without writing any files to disk
- **Package_Registry**: The existing registry subsystem (from `runScenePackageRegistryCommand`) that indexes and resolves scene packages from the template library directory
- **Template_Package**: A scene package in the template library containing template files, a variable schema, and optionally inheritance metadata
- **Schema_Validator**: The existing `validateTemplateVariables` function that validates user-supplied values against a variable schema
- **Inheritance_Resolver**: The existing `resolveTemplateInheritance` function that traverses and merges the L1→L2→L3 hierarchy
- **Template_Renderer**: The existing `renderTemplateFiles` function that processes template files with variable substitution and control-flow directives

## Requirements

### Requirement 1: End-to-End Instantiation Pipeline

**User Story:** As a CLI user, I want a single `scene instantiate` command that resolves a template package, validates my variable values, renders all template files, and produces a manifest, so that I can generate complete output from a template in one step.

#### Acceptance Criteria

1. WHEN `scene instantiate --package <name> --values <json-or-path> --out <dir>` is invoked, THE Instantiation_Engine SHALL resolve the named Template_Package from the Package_Registry
2. WHEN the Template_Package is resolved, THE Instantiation_Engine SHALL call the Inheritance_Resolver to merge the full L1→L2→L3 inheritance chain into a single merged schema and file set
3. WHEN the inheritance chain is merged, THE Instantiation_Engine SHALL call the Schema_Validator to validate user-supplied values against the merged variable schema
4. WHEN variable validation succeeds, THE Instantiation_Engine SHALL call the Template_Renderer to render all merged template files into the specified output directory
5. WHEN rendering completes successfully, THE Instantiation_Engine SHALL write an `instantiation-manifest.json` file to the output directory
6. IF the specified package name is not found in the Package_Registry, THEN THE Instantiation_Engine SHALL print an error message identifying the missing package and set a non-zero exit code
7. IF variable validation fails, THEN THE Instantiation_Engine SHALL print all validation errors and set a non-zero exit code without writing any output files

### Requirement 2: Instantiation Manifest Generation

**User Story:** As a developer, I want each instantiation to produce a manifest file recording what was generated, so that I can trace output files back to their source template and variable values.

#### Acceptance Criteria

1. WHEN the Instantiation_Engine writes the manifest, THE Instantiation_Manifest SHALL contain the fields: package_name, inheritance_chain, variables_used, files_generated, generated_at (ISO 8601 timestamp), and output_directory
2. WHEN the Instantiation_Engine writes the manifest, THE Instantiation_Manifest SHALL list each generated file with its relative path and byte size
3. THE Instantiation_Manifest SHALL be written as valid JSON with 2-space indentation to `instantiation-manifest.json` in the output directory

### Requirement 3: Interactive Variable Prompting

**User Story:** As a CLI user, I want to be prompted for missing required variables when I use `--interactive` mode, so that I do not need to prepare a complete values file in advance.

#### Acceptance Criteria

1. WHEN `--interactive` is specified and required variables are missing from the supplied values, THE Instantiation_Engine SHALL prompt the user for each missing required variable using inquirer
2. WHEN prompting for a variable, THE Instantiation_Engine SHALL display the variable name, type, description, and default value (if any) in the prompt
3. WHEN the user provides a value for a prompted variable, THE Instantiation_Engine SHALL merge the prompted value into the values map before validation
4. WHEN `--interactive` is not specified and required variables are missing, THE Instantiation_Engine SHALL return validation errors without prompting

### Requirement 4: Dry-Run Preview Mode

**User Story:** As a CLI user, I want to preview what files would be generated without actually writing them, so that I can verify the instantiation plan before committing.

#### Acceptance Criteria

1. WHEN `--dry-run` is specified, THE Instantiation_Engine SHALL perform all steps (resolve, merge, validate, compute file list) except writing output files
2. WHEN `--dry-run` is specified, THE Instantiation_Engine SHALL display the list of files that would be generated, the resolved variable values, and the inheritance chain
3. WHEN `--dry-run` is specified, THE Instantiation_Engine SHALL not write any files to the output directory, including the Instantiation_Manifest

### Requirement 5: JSON Output Mode

**User Story:** As a tool author, I want to get the instantiation result as structured JSON, so that I can integrate the command into automated pipelines.

#### Acceptance Criteria

1. WHEN `--json` is specified, THE Instantiation_Engine SHALL output the full instantiation result as a JSON payload to stdout instead of human-readable summary
2. WHEN `--json` is combined with `--dry-run`, THE Instantiation_Engine SHALL output the dry-run plan as a JSON payload

### Requirement 6: List Available Template Packages

**User Story:** As a CLI user, I want to list available template packages from the registry, so that I can discover what templates are available for instantiation.

#### Acceptance Criteria

1. WHEN `scene instantiate --list` is invoked, THE Instantiation_Engine SHALL query the Package_Registry and display all available Template_Packages with their names, layers, and coordinate information
2. WHEN `--list` is combined with `--json`, THE Instantiation_Engine SHALL output the package list as a JSON payload
3. WHEN no template packages are found in the registry, THE Instantiation_Engine SHALL display a message indicating the registry is empty

### Requirement 7: Post-Instantiation Hooks

**User Story:** As a template author, I want to define a post-instantiation command in my scene-package.json, so that setup tasks like dependency installation run automatically after rendering.

#### Acceptance Criteria

1. WHEN the scene-package.json contract contains a `post_instantiate_hook` field with a shell command string, THE Instantiation_Engine SHALL execute that command in the output directory after successful rendering
2. WHEN the post-instantiation hook command exits with a non-zero code, THE Instantiation_Engine SHALL print a warning message but still consider the instantiation successful
3. WHEN `--dry-run` is specified, THE Instantiation_Engine SHALL display the hook command that would be executed without running the command
4. WHEN no `post_instantiate_hook` field is present, THE Instantiation_Engine SHALL skip hook execution without error

### Requirement 8: Instantiation History Tracking

**User Story:** As a developer, I want each instantiation to be recorded in a log file, so that I can review the history of what was instantiated and when.

#### Acceptance Criteria

1. WHEN an instantiation completes successfully, THE Instantiation_Engine SHALL append an entry to `instantiation-log.json` in the output directory
2. WHEN the Instantiation_Log file does not exist, THE Instantiation_Engine SHALL create the file with an array containing the first entry
3. WHEN the Instantiation_Log file already exists, THE Instantiation_Engine SHALL read the existing array and append the new entry
4. THE Instantiation_Log entry SHALL contain: package_name, inheritance_chain, variables_used, files_generated_count, generated_at (ISO 8601 timestamp), and output_directory
5. WHEN `--dry-run` is specified, THE Instantiation_Engine SHALL not write to the Instantiation_Log

### Requirement 9: Values Input Parsing

**User Story:** As a CLI user, I want to supply variable values either as inline JSON or as a path to a JSON file, so that I can choose the most convenient input method.

#### Acceptance Criteria

1. WHEN the `--values` argument ends with `.json`, THE Instantiation_Engine SHALL treat the argument as a file path and read the JSON object from that file
2. WHEN the `--values` argument does not end with `.json`, THE Instantiation_Engine SHALL treat the argument as an inline JSON string and parse the object directly
3. IF the values file does not exist or contains invalid JSON, THEN THE Instantiation_Engine SHALL print an error message and set a non-zero exit code
4. IF the inline JSON string is malformed, THEN THE Instantiation_Engine SHALL print a parse error message and set a non-zero exit code

### Requirement 10: Integration with Existing Infrastructure

**User Story:** As a system maintainer, I want the instantiation command to reuse existing package registry, inheritance resolution, variable validation, and template rendering functions, so that the codebase remains cohesive.

#### Acceptance Criteria

1. THE Instantiation_Engine SHALL reuse the Package_Registry (from `runScenePackageRegistryCommand` output) to locate template packages by name
2. THE Instantiation_Engine SHALL reuse `resolveTemplateInheritance` to merge the inheritance chain
3. THE Instantiation_Engine SHALL reuse `validateTemplateVariables` to validate user-supplied values against the merged schema
4. THE Instantiation_Engine SHALL reuse `renderTemplateFiles` to render template files to the output directory
5. WHEN new fields (`post_instantiate_hook`) are added to scene-package.json, THE existing contract validation SHALL continue to pass for packages that do not use the new field
