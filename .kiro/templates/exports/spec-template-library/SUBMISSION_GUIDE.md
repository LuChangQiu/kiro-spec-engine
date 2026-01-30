# Template Submission Guide

## Template: spec-template-library

Congratulations! Your template has been generated successfully. Follow these steps to submit it to the kse-spec-templates repository.

## Next Steps

### 1. Review the Template

- Check `requirements.md`, `design.md`, and `tasks.md` for accuracy
- Verify that all project-specific content has been replaced with template variables
- Review `REVIEW_CHECKLIST.md` for a complete list of items to verify

### 2. Test the Template

Test your template locally before submitting:

```bash
# Apply the template to create a new Spec
kse spec create test-spec --template spec-template-library

# Verify the generated Spec is correct
cd .kiro/specs/test-spec
# Check that variables were replaced correctly
```

### 3. Submit to Repository

**Option A: Fork + Pull Request (Recommended)**

```bash
# 1. Fork the kse-spec-templates repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/kse-spec-templates.git
cd kse-spec-templates

# 3. Create a branch
git checkout -b add-spec-template-library

# 4. Copy your template to the appropriate category directory
mkdir -p other/spec-template-library
cp /path/to/this/template/* other/spec-template-library/

# 5. Update template-registry.json
# Add the entry from template-registry.json in this directory

# 6. Commit and push
git add .
git commit -m "feat: add spec-template-library template"
git push origin add-spec-template-library

# 7. Create Pull Request on GitHub
# Use the content from PR_DESCRIPTION.md
```

**Option B: Issue Submission (Simple)**

If you're not familiar with Git:

1. Go to https://github.com/heguangyong/kse-spec-templates/issues
2. Create a new issue with title: `[Template Submission] spec-template-library`
3. Attach the template files or paste their contents
4. A maintainer will review and add your template

## Files in This Package

- `requirements.md` - Template requirements document
- `design.md` - Template design document
- `tasks.md` - Template tasks document
- `template-registry.json` - Registry entry for your template
- `SUBMISSION_GUIDE.md` - This file
- `PR_DESCRIPTION.md` - Draft PR description
- `REVIEW_CHECKLIST.md` - Items to verify before submission
- `USAGE_EXAMPLE.md` - How to use your template
- `creation.log` - Creation log for debugging

## Questions?

If you have questions about the submission process, please:
- Check the kse-spec-templates repository README
- Open an issue in the repository
- Contact the maintainers

Thank you for contributing to the kse template library!
