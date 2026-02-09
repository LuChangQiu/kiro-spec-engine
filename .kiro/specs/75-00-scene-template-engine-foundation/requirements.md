# Requirements Document: Scene Template Engine Foundation

## Introduction

This spec transitions the scene subsystem from "scene execution closed-loop" to "template-driven production closed-loop" by implementing the Phase A kernel of a three-layer template hierarchy (L1 Capability / L2 Domain / L3 Instance). It introduces template variable schema validation, a multi-file template rendering engine with control-flow directives, three-layer inheritance resolution, and three new CLI subcommands integrated with the existing package ecosystem.

## Glossary

- **Template_Engine**: The rendering subsystem that processes template files by substituting variables and evaluating control-flow directives
- **Variable_Schema**: A JSON structure within `scene-package.json` contract that declares template variables with type, validation, and default value metadata
- **Schema_Validator**: The component that validates user-supplied variable values against a Variable_Schema definition
- **Template_Renderer**: The component that processes template file content, performing variable substitution and evaluating conditional/loop directives
- **Inheritance_Resolver**: The component that traverses the three-layer template hierarchy and merges Variable_Schema definitions and template files from ancestor packages
- **L1_Capability_Layer**: The base layer providing foundational variables and file structures (e.g., scene-base)
- **L2_Domain_Layer**: The middle layer inheriting from L1, adding domain-specific variables and files (e.g., scene-erp)
- **L3_Instance_Layer**: The concrete layer inheriting from L2, filling in specific values (e.g., scene-erp-inventory)
- **Template_Package**: A scene package that contains template files and a Variable_Schema for rendering
- **Package_Registry**: The existing registry subsystem that indexes and resolves scene packages from the template library directory

## Requirements

### Requirement 1: Template Variable Schema Definition

**User Story:** As a template author, I want to define typed variables with validation rules in my scene package contract, so that template consumers provide correct and complete variable values.

#### Acceptance Criteria

1. WHEN a scene package contract contains a `variables` field in its contract section, THE Schema_Validator SHALL recognize each variable entry with the fields: name, type, required, default, description, and validation
2. WHEN a variable declares type as one of string, number, boolean, enum, or array, THE Schema_Validator SHALL accept the type declaration as valid
3. WHEN a variable declares a type not in the supported set, THE Schema_Validator SHALL reject the declaration and return a structured error identifying the invalid type and variable name
4. WHEN a variable declares a validation object with regex, enum_values, min, or max fields, THE Schema_Validator SHALL use those rules during value validation
5. WHEN a variable is marked as required and no value or default is provided, THE Schema_Validator SHALL return a structured error identifying the missing variable

### Requirement 2: Template Variable Value Validation

**User Story:** As a template consumer, I want my variable values validated against the schema before rendering, so that I receive clear error messages for invalid inputs.

#### Acceptance Criteria

1. WHEN `validateTemplateVariables(schema, values)` is called with a valid schema and complete values, THE Schema_Validator SHALL return a success result with no errors
2. WHEN a required variable has no supplied value, THE Schema_Validator SHALL fill in the default value if one is declared in the schema
3. WHEN a required variable has no supplied value and no default is declared, THE Schema_Validator SHALL return a structured error listing the missing variable name
4. WHEN a supplied value does not match the declared type, THE Schema_Validator SHALL return a structured error identifying the variable name and expected type
5. WHEN a string variable declares a regex validation rule, THE Schema_Validator SHALL test the supplied value against the regex and return a structured error on mismatch
6. WHEN an enum variable declares enum_values, THE Schema_Validator SHALL verify the supplied value is a member of the declared set and return a structured error on mismatch
7. WHEN a number variable declares min or max validation rules, THE Schema_Validator SHALL verify the supplied value falls within the declared range and return a structured error on violation
8. WHEN multiple validation errors exist, THE Schema_Validator SHALL return all errors in a single structured error list rather than stopping at the first error

### Requirement 3: Multi-File Template Rendering

**User Story:** As a template consumer, I want to render multiple template files from a template package into an output directory, so that I can generate complete spec artifacts from a single command.

#### Acceptance Criteria

1. WHEN `renderTemplateFiles(templateDir, variables, outputDir)` is called, THE Template_Renderer SHALL process all template files found in the template directory recursively
2. WHEN a template file contains `{{variable_name}}` placeholders, THE Template_Renderer SHALL replace each placeholder with the corresponding variable value
3. WHEN a template file contains `{{#if variable}}...{{/if}}` blocks, THE Template_Renderer SHALL include the block content only when the variable is truthy
4. WHEN a template file contains `{{#each items}}...{{/each}}` blocks, THE Template_Renderer SHALL repeat the block content once for each element in the items array, substituting `{{this}}` with the current element
5. WHEN `renderTemplateFiles` is called, THE Template_Renderer SHALL invoke `validateTemplateVariables` before rendering and return validation errors without writing any output files if validation fails
6. THE Template_Renderer SHALL preserve the relative directory structure from the template directory in the output directory
7. WHEN a placeholder references a variable not present in the values, THE Template_Renderer SHALL leave the placeholder unchanged in the output

### Requirement 4: Template Rendering Round-Trip Consistency

**User Story:** As a developer, I want template rendering to be deterministic and consistent, so that the same inputs always produce the same outputs.

#### Acceptance Criteria

1. FOR ALL valid Variable_Schema definitions and valid value sets, rendering template content then re-rendering the output with the same values SHALL produce identical output (idempotence)
2. FOR ALL template files containing only `{{variable_name}}` placeholders with all variables supplied, THE Template_Renderer SHALL produce output containing none of the original placeholder markers

### Requirement 5: Three-Layer Template Package Structure

**User Story:** As a template architect, I want to organize template packages into capability, domain, and instance layers with inheritance, so that I can maximize reuse and minimize duplication.

#### Acceptance Criteria

1. WHEN a scene package contract contains a `layer` field, THE Schema_Validator SHALL accept values of l1-capability, l2-domain, and l3-instance
2. WHEN a scene package contract contains an `extends` field referencing a parent package name, THE Inheritance_Resolver SHALL locate the parent package in the Package_Registry
3. WHEN `resolveTemplateInheritance(packageRegistry, packageName)` is called, THE Inheritance_Resolver SHALL traverse the inheritance chain from the named package up to the root ancestor
4. WHEN resolving inheritance, THE Inheritance_Resolver SHALL merge Variable_Schema definitions so that child variables override parent variables with the same name
5. WHEN resolving inheritance, THE Inheritance_Resolver SHALL merge template file sets so that child files override parent files at the same relative path
6. IF a circular inheritance reference is detected, THEN THE Inheritance_Resolver SHALL return a structured error identifying the cycle
7. IF an `extends` reference points to a package not found in the registry, THEN THE Inheritance_Resolver SHALL return a structured error identifying the missing package name

### Requirement 6: CLI template-render Subcommand

**User Story:** As a CLI user, I want a `scene template-render` command that renders a template package with supplied variable values into a target directory, so that I can generate spec artifacts from the command line.

#### Acceptance Criteria

1. WHEN `scene template-render --package <name> --values <json-or-path> --out <dir>` is invoked, THE CLI SHALL resolve the template package from the Package_Registry, validate variables, and render output files to the specified directory
2. WHEN the `--json` flag is provided, THE CLI SHALL output the render result as a JSON payload instead of human-readable summary
3. IF the specified package is not found in the registry, THEN THE CLI SHALL print an error message and set a non-zero exit code
4. IF variable validation fails, THEN THE CLI SHALL print all validation errors and set a non-zero exit code without writing output files

### Requirement 7: CLI template-validate Subcommand

**User Story:** As a template author, I want a `scene template-validate` command that checks my template package's variable schema for correctness, so that I can catch schema errors before publishing.

#### Acceptance Criteria

1. WHEN `scene template-validate --package <path>` is invoked, THE CLI SHALL load the scene-package.json from the specified path and validate the variables schema definition
2. WHEN validation succeeds, THE CLI SHALL print a success summary with variable count and type breakdown
3. WHEN validation fails, THE CLI SHALL print all schema errors and set a non-zero exit code
4. WHEN the `--json` flag is provided, THE CLI SHALL output the validation result as a JSON payload

### Requirement 8: CLI template-resolve Subcommand

**User Story:** As a template consumer, I want a `scene template-resolve` command that shows the fully merged schema after inheritance resolution, so that I can understand the complete variable set before rendering.

#### Acceptance Criteria

1. WHEN `scene template-resolve --package <name>` is invoked, THE CLI SHALL resolve the full inheritance chain and output the merged Variable_Schema
2. WHEN the `--json` flag is provided, THE CLI SHALL output the resolved schema as a JSON payload
3. IF inheritance resolution encounters an error (circular reference or missing package), THEN THE CLI SHALL print the error and set a non-zero exit code

### Requirement 9: Integration with Existing Package Ecosystem

**User Story:** As a system maintainer, I want the template engine to reuse existing package registry and validation infrastructure, so that the codebase remains cohesive and avoids duplication.

#### Acceptance Criteria

1. THE template-render command SHALL reuse the Package_Registry to locate template packages by name
2. THE template-validate command SHALL reuse the existing contract validation logic as a prerequisite before checking template-specific variable schema
3. THE Inheritance_Resolver SHALL reuse the Package_Registry index to resolve parent package references
4. WHEN new template-specific fields (variables, layer, extends) are added to scene-package.json, THE existing contract validation SHALL continue to pass for packages that do not use these fields
