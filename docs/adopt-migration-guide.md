# Adopt Command Migration Guide

**From Interactive Mode (v1.8.x) to Smart Mode (v1.9.0+)**

This guide helps users transition from the old interactive adoption mode to the new zero-interaction smart adoption system.

---

## Table of Contents

- [What Changed](#what-changed)
- [Why the Change](#why-the-change)
- [Behavior Comparison](#behavior-comparison)
- [Migration Steps](#migration-steps)
- [Using Legacy Mode](#using-legacy-mode)
- [FAQ](#faq)

---

## What Changed

### Old Behavior (v1.8.x and earlier)

The `kse adopt` command was **interactive** and required user input:

```bash
$ kse adopt

📦 Analyzing project structure...

⚠️  Conflicts detected:
    - .kiro/steering/CORE_PRINCIPLES.md
    - .kiro/steering/ENVIRONMENT.md

? How to handle conflicts?
  > Skip all
    Overwrite all
    Review each

? Overwrite .kiro/steering/CORE_PRINCIPLES.md? (y/N)
? Overwrite .kiro/steering/ENVIRONMENT.md? (y/N)
...
```

**Characteristics**:
- ❓ Asked multiple questions
- 👤 Required user decisions
- 🤔 Manual conflict resolution
- ⚠️ Optional backup
- 🐌 Slow (waited for user input)

### New Behavior (v1.9.0+)

The `kse adopt` command is now **smart and automatic**:

```bash
$ kse adopt

🔥 Kiro Spec Engine - Project Adoption

📦 Analyzing project structure... ✅
📋 Creating adoption plan... ✅

Adoption Plan:
  Mode: Smart Update
  Files to update: 5
  Files to preserve: 8
  Backup required: Yes

🚀 Starting adoption...
📦 Creating backup... ✅ backup-20260128-143022
✓ Validating backup... ✅ 5 files verified
📝 Updating files...
  ✅ .kiro/steering/CORE_PRINCIPLES.md
  ✅ .kiro/steering/ENVIRONMENT.md
  ⏭️  .kiro/specs/ (preserved)
✅ Adoption completed successfully!

📊 Summary:
  Backup: backup-20260128-143022
  Updated: 5 files
  Preserved: 3 specs, 2 custom files
  
💡 Your original files are safely backed up.
   To restore: kse rollback backup-20260128-143022
```

**Characteristics**:
- ✅ Zero questions
- 🤖 Automatic decisions
- 🧠 Smart conflict resolution
- 🔒 Mandatory backup
- ⚡ Fast (no waiting)

---

## Why the Change

### User Feedback

From user research and feedback:

1. **"I don't know what to choose"**
   - New users felt anxious about making wrong decisions
   - Technical terminology was confusing

2. **"It takes too long"**
   - Multiple prompts slowed down the process
   - Especially painful for multiple projects

3. **"I'm worried about breaking things"**
   - Users were unsure if their choices were safe
   - Backup was optional, leading to data loss concerns

### Design Goals

The new system addresses these issues:

1. **Eliminate Anxiety**: No questions = no wrong answers
2. **Maximize Safety**: Mandatory backups = always safe
3. **Improve Speed**: Automatic = instant completion
4. **Ensure Consistency**: Smart rules = predictable results

---

## Behavior Comparison

### Side-by-Side Comparison

| Aspect | Old (Interactive) | New (Smart) |
|--------|------------------|-------------|
| **User Input** | Multiple prompts | None |
| **Conflict Resolution** | Manual selection | Automatic (smart rules) |
| **Backup** | Optional (--backup flag) | Mandatory (always) |
| **Speed** | Slow (waits for input) | Fast (automatic) |
| **Safety** | Depends on user choices | Always safe |
| **Learning Curve** | High (need to understand options) | None (just run it) |
| **Predictability** | Varies by user choices | Consistent |
| **Rollback** | Available if backup created | Always available |

### Conflict Resolution Changes

**Old Behavior**:
```
? How to handle conflicts?
  > Skip all          # User chooses
    Overwrite all     # User chooses
    Review each       # User chooses
```

**New Behavior**:
```
Automatic resolution based on file type:
  - Template files → Backup + Update
  - User content → Always preserve
  - Config files → Backup + Update
  - CURRENT_CONTEXT.md → Always preserve
```

### Backup Changes

**Old Behavior**:
```bash
# Backup was optional
kse adopt              # No backup
kse adopt --backup     # With backup
```

**New Behavior**:
```bash
# Backup is mandatory
kse adopt              # Always creates backup
kse adopt --no-backup  # Requires confirmation (dangerous)
```

---

## Migration Steps

### For Individual Users

**Step 1**: Upgrade KSE
```bash
npm install -g kiro-spec-engine@latest
```

**Step 2**: Test with dry-run (optional)
```bash
cd your-project
kse adopt --dry-run
```

**Step 3**: Run adoption
```bash
kse adopt
```

**Step 4**: Verify results
```bash
kse status
kse version-info
```

### For Teams

**Step 1**: Communicate the change
- Share this migration guide with team
- Explain the benefits
- Address concerns

**Step 2**: Test on non-critical project
```bash
cd test-project
kse adopt --dry-run
kse adopt
```

**Step 3**: Roll out gradually
```bash
# Week 1: Test projects
# Week 2: Development projects
# Week 3: Production projects
```

**Step 4**: Update documentation
- Update internal guides
- Update CI/CD scripts
- Update onboarding docs

### For CI/CD Pipelines

**Old Script**:
```bash
# Old: Required --auto flag
kse adopt --auto
```

**New Script**:
```bash
# New: No flag needed (already automatic)
kse adopt

# Or with verbose logging
kse adopt --verbose
```

---

## Using Legacy Mode

### When to Use Interactive Mode

You might prefer interactive mode if:
- You want manual control over every decision
- You have complex custom configurations
- You're migrating from very old versions
- You want to review each change

### How to Enable

Simply add the `--interactive` flag:

```bash
kse adopt --interactive
```

This enables the old behavior:
- All prompts return
- Manual conflict resolution
- Step-by-step confirmation

### Example

```bash
$ kse adopt --interactive

📦 Analyzing project structure...

⚠️  Conflicts detected:
    - .kiro/steering/CORE_PRINCIPLES.md

? How to handle conflicts?
  > Skip all
    Overwrite all
    Review each

# ... (old interactive flow)
```

---

## FAQ

### Q: Will my existing projects still work?

**A**: Yes! The new system is fully backward compatible. Your existing `.kiro/` directories will be detected and handled correctly.

---

### Q: What if I prefer the old interactive mode?

**A**: Use the `--interactive` flag:
```bash
kse adopt --interactive
```

---

### Q: Is the automatic mode safe?

**A**: Yes! It's actually safer than the old mode because:
- Backups are mandatory (not optional)
- Smart rules prevent data loss
- User content is always preserved
- Easy rollback is always available

---

### Q: What if the automatic decision is wrong?

**A**: You can easily rollback:
```bash
kse rollback backup-20260128-143022
```

Then use interactive mode:
```bash
kse adopt --interactive
```

---

### Q: How do I preview changes without applying them?

**A**: Use dry-run mode:
```bash
kse adopt --dry-run
```

---

### Q: Can I force overwrite specific files?

**A**: Yes, use the `--force` flag:
```bash
kse adopt --force
```

This will:
- Create backup first
- Overwrite template files
- Preserve user content
- Show what was changed

---

### Q: What happens to my specs and custom files?

**A**: They are **always preserved**. The smart system never overwrites:
- `.kiro/specs/` directory
- `.kiro/steering/CURRENT_CONTEXT.md`
- Any custom files you created

---

### Q: How do I know what changed?

**A**: The summary shows everything:
```
📊 Summary:
  Backup: backup-20260128-143022
  Updated: 5 files
  Preserved: 3 specs, 2 custom files
```

For more details, use verbose mode:
```bash
kse adopt --verbose
```

---

### Q: Can I skip the backup?

**A**: Not recommended, but possible:
```bash
kse adopt --no-backup
```

⚠️ **Warning**: This is dangerous and requires confirmation.

---

### Q: What if I have custom steering files?

**A**: The system detects and preserves them automatically. Template files are updated, but your custom files remain untouched.

---

### Q: How do I update my CI/CD scripts?

**A**: Remove the `--auto` flag (it's now the default):

**Old**:
```bash
kse adopt --auto
```

**New**:
```bash
kse adopt
```

---

### Q: What if I encounter an error?

**A**: The system aborts safely:
- No changes are made
- Original files remain intact
- Clear error message is shown
- Solutions are suggested

Example:
```
❌ Error: Backup Creation Failed

Problem: Unable to create backup

Solutions:
  1. Free up disk space
  2. Check permissions
  3. Run kse doctor
```

---

### Q: Can I adopt multiple projects at once?

**A**: Yes! The automatic mode makes this easy:

```bash
for dir in project1 project2 project3; do
  cd $dir
  kse adopt
  cd ..
done
```

---

### Q: How do I report issues?

**A**: 
1. Run with verbose mode: `kse adopt --verbose`
2. Check the logs
3. Report at: https://github.com/heguangyong/kiro-spec-engine/issues

---

## Troubleshooting

### Issue: "I don't like the automatic decisions"

**Solution**: Use interactive mode:
```bash
kse adopt --interactive
```

---

### Issue: "I want to see what's happening"

**Solution**: Use verbose mode:
```bash
kse adopt --verbose
```

---

### Issue: "I want to undo the adoption"

**Solution**: Use rollback:
```bash
kse rollback backup-20260128-143022
```

---

### Issue: "My custom file was overwritten"

**This shouldn't happen!** The system preserves user content. If it did:

1. Rollback immediately:
   ```bash
   kse rollback backup-20260128-143022
   ```

2. Report the issue:
   - Include file path
   - Include verbose logs
   - Report at GitHub issues

---

## Best Practices

### 1. Test First

Always test on a non-critical project first:
```bash
cd test-project
kse adopt --dry-run
kse adopt
```

### 2. Use Version Control

Commit before adopting:
```bash
git add -A
git commit -m "Before KSE v1.9.0 adoption"
kse adopt
```

### 3. Keep Backups

Don't delete automatic backups immediately:
```bash
# Keep for at least a week
ls .kiro/backups/
```

### 4. Verify Results

After adoption, verify:
```bash
kse status
kse version-info
npm test  # If you have tests
```

### 5. Document Changes

If you customize files, document it:
```markdown
# In .kiro/steering/CUSTOM_RULES.md
## Customizations
- Modified CORE_PRINCIPLES.md on 2026-01-28
- Reason: Project-specific requirements
```

---

## Summary

### Key Takeaways

1. **New default is automatic** - No questions asked
2. **Backups are mandatory** - Always safe
3. **User content is preserved** - Never overwritten
4. **Easy rollback** - Always available
5. **Legacy mode available** - Use `--interactive` if needed

### Recommended Approach

For most users:
```bash
# Just run it!
kse adopt
```

For cautious users:
```bash
# Preview first
kse adopt --dry-run

# Then apply
kse adopt
```

For advanced users:
```bash
# Use interactive mode
kse adopt --interactive
```

---

## Getting Help

- **Documentation**: [Adoption Guide](adoption-guide.md)
- **System Check**: `kse doctor`
- **Version Info**: `kse version-info`
- **Issues**: https://github.com/heguangyong/kiro-spec-engine/issues

---

**Welcome to the new smart adoption system! 🚀**
