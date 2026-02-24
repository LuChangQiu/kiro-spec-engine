# Template Usage Example

## Template: spec-template-library

Template for Spec Template Library

## How to Use This Template

### 1. List Available Templates

```bash
kse templates list
```

### 2. View Template Details

```bash
kse templates show other/spec-template-library
```

### 3. Create a New Spec from This Template

```bash
kse spec create my-new-feature --template other/spec-template-library
```

This will create a new Spec at `.sce/specs/XX-00-my-new-feature/` with:
- `requirements.md` - Requirements document
- `design.md` - Design document
- `tasks.md` - Implementation tasks

### 4. Customize the Generated Spec

The template uses the following variables that will be replaced:

- `{{SPEC_NAME}}` - Your Spec name in kebab-case (e.g., `my-new-feature`)
- `{{SPEC_NAME_TITLE}}` - Your Spec name in Title Case (e.g., `My New Feature`)
- `{{DATE}}` - Current date in ISO format (e.g., `2025-01-31`)
- `{{AUTHOR}}` - Your name from git config
- `{{VERSION}}` - Version number (default: `1.0.0`)

## What This Template Provides

This template helps you create a Spec for:

Template for Spec Template Library

## Prerequisites

- kse version 1.16.0 or higher
- Basic understanding of Spec-driven development

## Tags



## Example Output

After applying this template, you'll have a complete Spec structure ready to customize for your specific needs.

## Questions?

If you have questions about using this template:
- Check the kse documentation
- Review the generated Spec files
- Open an issue in the kse-spec-templates repository
