# Spec Locking Guide

This guide explains how to use the Spec locking mechanism for multi-user collaboration in sce projects.

## Overview

When multiple developers work on the same project, they may accidentally edit the same Spec simultaneously, leading to conflicts. The Spec locking mechanism prevents this by allowing developers to acquire exclusive locks on Specs before editing.

## Quick Start

```bash
# Before editing a Spec, acquire a lock
sce lock acquire my-feature --reason "Implementing user authentication"

# Check who has locks on which Specs
sce lock status

# When done editing, release the lock
sce unlock my-feature
```

## Commands

### Acquire a Lock

```bash
sce lock acquire <spec-name> [options]
```

Options:
- `--reason <reason>` - Document why you're locking the Spec
- `--timeout <hours>` - Lock timeout in hours (default: 24)

Example:
```bash
sce lock acquire 01-00-user-auth --reason "Adding OAuth support" --timeout 48
```

### Release a Lock

```bash
sce unlock <spec-name> [options]
# or
sce lock release <spec-name> [options]
```

Options:
- `--force` - Release lock even if owned by another machine

Example:
```bash
sce unlock 01-00-user-auth
sce unlock 01-00-user-auth --force  # Override someone else's lock
```

### Check Lock Status

```bash
# View all locked Specs
sce lock status

# View specific Spec lock status
sce lock status <spec-name>
```

Output includes:
- Lock owner name
- Machine hostname
- Lock duration
- Stale indicator (if lock exceeded timeout)
- "you" indicator (if you own the lock)

### Clean Up Stale Locks

```bash
sce lock cleanup
```

Removes all locks that have exceeded their timeout period. This is useful when:
- A developer forgot to release their lock
- A machine crashed while holding a lock
- Someone left for vacation with an active lock

### View Machine Identifier

```bash
sce lock whoami
```

Shows your machine's unique identifier, which is used to track lock ownership.

## Integration with Status Command

The `sce status` command now shows lock indicators for each Spec:

```
📁 Specs (5)

  01-00-user-auth 🔒 (you)
    Tasks: 3/10 completed (30%)

  02-00-api-gateway 🔒 (john)
    Tasks: 5/8 completed (62%)

  03-00-dashboard
    Tasks: 8/8 completed (100%)
```

Lock indicators:
- 🔒 (you) - You own this lock
- 🔒 (username) - Another user owns this lock
- 🔒 [STALE] - Lock has exceeded timeout

## Best Practices

### 1. Always Lock Before Major Edits

```bash
# Good practice
sce lock acquire my-feature --reason "Refactoring task structure"
# ... make your changes ...
sce unlock my-feature
```

### 2. Use Meaningful Reasons

```bash
# Good - explains what you're doing
sce lock acquire api-spec --reason "Adding pagination to list endpoints"

# Bad - no context
sce lock acquire api-spec
```

### 3. Release Locks Promptly

Don't hold locks longer than necessary. Release as soon as you're done editing.

### 4. Check Status Before Starting Work

```bash
# Check if anyone is working on the Spec
sce lock status my-feature

# If unlocked, acquire and start working
sce lock acquire my-feature
```

### 5. Communicate Before Force Unlocking

If you need to force unlock someone else's lock:
1. Try to contact them first
2. Check if the lock is stale
3. Use `--force` only when necessary

```bash
# Check if stale
sce lock status their-spec

# If stale or confirmed with owner
sce unlock their-spec --force
```

## Configuration

### Lock Timeout

Default timeout is 24 hours. You can customize per-lock:

```bash
sce lock acquire my-spec --timeout 48  # 48 hours
sce lock acquire quick-fix --timeout 2  # 2 hours
```

### Machine ID Storage

Machine IDs are stored in `.sce/config/machine-id.json` and are automatically generated on first use.

## Troubleshooting

### "Spec is already locked" Error

Someone else is editing this Spec. Options:
1. Wait for them to finish
2. Contact them to coordinate
3. Use `--force` if the lock is stale or abandoned

### "Lock owned by different machine" Error

You're trying to unlock a Spec locked by another machine. Options:
1. Use `--force` to override
2. Contact the lock owner

### Stale Locks Accumulating

Run periodic cleanup:
```bash
sce lock cleanup
```

Consider adding this to your CI/CD pipeline or team workflow.

## File Format

Lock files are stored as `.sce/specs/<spec-name>/.lock` with JSON format:

```json
{
  "owner": "John Doe",
  "machineId": "DESKTOP-ABC123-uuid-here",
  "hostname": "DESKTOP-ABC123",
  "timestamp": "2026-02-05T10:30:00.000Z",
  "reason": "Implementing feature X",
  "timeout": 24,
  "version": "1.0.0"
}
```

Lock files are excluded from version control via `.gitignore`.

## See Also

- [Team Collaboration Guide](team-collaboration-guide.md)
- [Spec Workflow](spec-workflow.md)
- [Command Reference](command-reference.md)
