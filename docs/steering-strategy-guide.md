# Steering Strategy Guide

## Overview

When adopting kiro-spec-engine (kse) into a project that already has steering files in `.kiro/steering/`, you must choose a steering strategy. This is because Kiro IDE loads all files in the steering directory, and having both kse steering rules and your project's custom steering rules can cause conflicts.

## Why Steering Exclusivity?

Kiro IDE automatically loads all Markdown files in `.kiro/steering/` as AI behavior rules. If you have both kse steering files and your project's custom steering files, the AI will try to follow both sets of rules, which can lead to:

- Conflicting instructions
- Unpredictable AI behavior
- Confusion about which rules take precedence

Therefore, you must choose **one** set of steering rules to use.

## Steering Strategies

### Strategy 1: Use kse Steering (Recommended for New Users)

**When to choose:**
- You're new to kse and want to use the recommended steering rules
- You don't have critical custom steering rules
- You want the full kse experience with optimized AI behavior

**What happens:**
1. Your existing steering files are backed up to `.kiro/backups/steering-{timestamp}/`
2. kse steering template files are installed to `.kiro/steering/`
3. The backup ID is saved in `.kiro/adoption-config.json`
4. You can rollback if needed

**Files installed:**
- `CORE_PRINCIPLES.md` - Core development principles and Spec workflow
- `ENVIRONMENT.md` - Project environment configuration
- `CURRENT_CONTEXT.md` - Current Spec context (updated per Spec)
- `RULES_GUIDE.md` - Index of steering rules

### Strategy 2: Use Project Steering (Keep Existing)

**When to choose:**
- You have custom steering rules that are critical to your project
- You want to integrate kse without changing your AI behavior rules
- You're experienced with steering files and want full control

**What happens:**
1. Your existing steering files are preserved
2. kse steering files are **not** installed
3. The choice is documented in `.kiro/adoption-config.json`
4. You can manually integrate kse steering concepts if desired

**Trade-offs:**
- You won't get kse's optimized AI behavior out of the box
- You'll need to manually add kse-specific steering rules if needed
- Spec workflow may not work as smoothly without kse steering

## Adoption Flow

```
kse adopt
    ↓
Detect existing steering files
    ↓
    ├─ No steering files → Install kse steering (default)
    │
    └─ Steering files found → Prompt for strategy
           ↓
           ├─ use-kse → Backup existing → Install kse steering
           │
           └─ use-project → Keep existing → Skip kse steering
```

## Rollback

If you chose "use-kse" and want to restore your original steering files:

```bash
# List available backups
kse rollback --list

# Restore from backup
kse rollback {backup-id}
```

Or manually restore from `.kiro/backups/steering-{timestamp}/`.

## Manual Integration

If you chose "use-project" but want to incorporate kse steering concepts:

1. Review kse steering templates in `template/.kiro/steering/`
2. Identify useful concepts (Spec workflow, Ultrawork principles, etc.)
3. Manually merge relevant sections into your steering files
4. Test with a sample Spec to ensure compatibility

## Configuration File

Your steering strategy choice is saved in `.kiro/adoption-config.json`:

```json
{
  "version": "1.0.0",
  "adoptedAt": "2026-01-23T10:00:00.000Z",
  "steeringStrategy": "use-kse",
  "steeringBackupId": "steering-2026-01-23T10-00-00-000Z",
  "multiUserMode": false,
  "lastUpdated": "2026-01-23T10:00:00.000Z"
}
```

## Best Practices

### For New kse Users

1. **Choose "use-kse"** to get the full experience
2. Review the installed steering files to understand kse workflow
3. Customize `ENVIRONMENT.md` for your project specifics
4. Update `CURRENT_CONTEXT.md` as you work on different Specs

### For Experienced Users

1. **Choose "use-project"** if you have mature steering rules
2. Review kse steering templates for useful patterns
3. Consider creating a hybrid approach:
   - Keep your core steering rules
   - Add kse-specific rules in separate files
   - Use file naming to control load order (e.g., `00-core.md`, `10-kse.md`)

### For Teams

1. **Discuss strategy** with your team before adoption
2. **Document the choice** in your project README
3. **Version control** your steering files (if using custom rules)
4. **Share backups** if team members need to rollback

## Troubleshooting

### Problem: AI behavior is inconsistent after adoption

**Solution:**
- Check which steering strategy you chose: `cat .kiro/adoption-config.json`
- If "use-kse", verify kse steering files are present
- If "use-project", ensure your steering files are compatible with kse

### Problem: Want to switch strategies after adoption

**Solution:**
1. If currently "use-kse":
   ```bash
   kse rollback {steering-backup-id}
   ```

2. If currently "use-project":
   - Manually backup your steering files
   - Copy kse templates from `template/.kiro/steering/`
   - Update `.kiro/adoption-config.json`

### Problem: Lost steering backup

**Solution:**
- Check `.kiro/backups/` for steering backups
- Backups are named `steering-{timestamp}`
- If no backup exists, you'll need to recreate your steering files

## FAQ

**Q: Can I use both kse and project steering files?**

A: No, due to Kiro IDE's behavior. You must choose one set of rules.

**Q: Will my Specs work without kse steering?**

A: Yes, but the AI may not follow kse workflow conventions as closely.

**Q: Can I modify kse steering files after installation?**

A: Yes! kse steering files are templates. Customize them for your project.

**Q: What if I don't have any steering files?**

A: kse will automatically install its steering files (no choice needed).

**Q: Can I switch strategies later?**

A: Yes, but you'll need to manually manage the steering files and update the config.

## Related Documentation

- [Adoption Guide](./adoption-guide.md) - Complete adoption workflow
- [Spec Workflow Guide](../.kiro/specs/SPEC_WORKFLOW_GUIDE.md) - How to use Specs
- [Steering Files](../.kiro/steering/) - kse steering templates

---

**Version**: 1.0.0  
**Last Updated**: 2026-01-23  
**Spec**: 03-00-multi-user-and-cross-tool-support
