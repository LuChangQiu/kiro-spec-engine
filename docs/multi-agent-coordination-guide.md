# Multi-Agent Parallel Coordination Guide

> Enable multiple AI agents to work on the same kse project simultaneously without conflicts.

**Version**: 1.43.0  
**Last Updated**: 2026-02-11

---

## Overview

When multiple AI agent instances (e.g., multiple Kiro IDE windows, Claude Code sessions, or Cursor instances) work on the same project, they can accidentally overwrite each other's changes, claim the same tasks, or corrupt shared files like `tasks.md`.

The Multi-Agent Parallel Coordination system solves this with six layers of protection:

1. **Agent Registry** — Who is working?
2. **Task Lock Manager** — Who owns which task?
3. **Task Status Store** — Safe concurrent updates to tasks.md
4. **Steering File Lock** — Safe concurrent updates to steering files
5. **Merge Coordinator** — Git branch isolation per agent
6. **Central Coordinator** — Intelligent task assignment (optional)

All components are **zero overhead in single-agent mode** — they become no-ops when multi-agent mode is not enabled.

---

## Quick Start

### 1. Enable Multi-Agent Mode

Create the configuration file `.kiro/config/multi-agent.json`:

```json
{
  "enabled": true,
  "coordinator": false,
  "heartbeatIntervalMs": 30000,
  "heartbeatTimeoutMs": 120000
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `enabled` | Enable multi-agent coordination | `false` |
| `coordinator` | Enable central task assignment | `false` |
| `heartbeatIntervalMs` | Heartbeat interval in ms | `30000` |
| `heartbeatTimeoutMs` | Agent considered inactive after this | `120000` |

### 2. Each Agent Registers Itself

When an agent starts working, it registers with the AgentRegistry:

```javascript
const { AgentRegistry } = require('kiro-spec-engine/lib/collab');

const registry = new AgentRegistry(workspaceRoot);
const { agentId } = await registry.register();
// agentId format: "{machineId}:{instanceIndex}"
// e.g., "a1b2c3d4:0", "a1b2c3d4:1"
```

### 3. Lock Tasks Before Working

```javascript
const { TaskLockManager } = require('kiro-spec-engine/lib/lock');

const lockManager = new TaskLockManager(workspaceRoot);
const result = await lockManager.acquireTaskLock('my-spec', '1.1', agentId);

if (result.success) {
  // Safe to work on task 1.1
  // ... do work ...
  await lockManager.releaseTaskLock('my-spec', '1.1', agentId);
} else {
  // Task is locked by another agent
  console.log(`Locked by: ${result.lockedBy}`);
}
```

### 4. Deregister When Done

```javascript
await registry.deregister(agentId);
// Automatically releases all locks held by this agent
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Coordinator (optional)             │
│         Ready task computation + assignment          │
├──────────┬──────────┬──────────┬────────────────────┤
│  Agent   │  Task    │  Task    │  Steering  │ Merge  │
│ Registry │  Lock    │  Status  │  File Lock │ Coord  │
│          │  Manager │  Store   │            │        │
├──────────┴──────────┴──────────┴────────────┴────────┤
│              MultiAgentConfig                        │
│         .kiro/config/multi-agent.json                │
└─────────────────────────────────────────────────────┘
```

---

## Components

### Agent Registry

Manages agent lifecycle with heartbeat-based health monitoring.

**File**: `lib/collab/agent-registry.js`  
**Storage**: `.kiro/config/agent-registry.json`

```javascript
const { AgentRegistry } = require('kiro-spec-engine/lib/collab');
const registry = new AgentRegistry(workspaceRoot);

// Register a new agent
const { agentId } = await registry.register();

// Send heartbeat (call periodically)
await registry.heartbeat(agentId);

// List active agents
const agents = await registry.getActiveAgents();

// Clean up inactive agents (heartbeat timeout)
const cleaned = await registry.cleanupInactive();
// Also releases all locks held by inactive agents

// Deregister when done
await registry.deregister(agentId);
```

**Agent ID format**: `{machineId}:{instanceIndex}`
- `machineId` is derived from MachineIdentifier (hardware-based)
- `instanceIndex` increments for multiple instances on the same machine
- Example: `a1b2c3d4e5f6:0`, `a1b2c3d4e5f6:1`

### Task Lock Manager

File-based mutual exclusion for task ownership.

**File**: `lib/lock/task-lock-manager.js`  
**Lock files**: `.kiro/specs/{specName}/locks/{taskId}.lock`

```javascript
const { TaskLockManager } = require('kiro-spec-engine/lib/lock');
const lockManager = new TaskLockManager(workspaceRoot);

// Acquire a task lock
const result = await lockManager.acquireTaskLock(specName, taskId, agentId);
// result: { success: true } or { success: false, lockedBy: "other-agent-id" }

// Release a task lock
await lockManager.releaseTaskLock(specName, taskId, agentId);

// Release ALL locks for an agent (used during cleanup)
await lockManager.releaseAllLocks(agentId);

// Check lock status
const status = await lockManager.getTaskLockStatus(specName, taskId);
// status: { locked: true, agentId: "...", timestamp: "..." } or { locked: false }

// List all locked tasks in a spec
const locked = await lockManager.listLockedTasks(specName);
```

**Lock file content** (JSON):
```json
{
  "agentId": "a1b2c3d4e5f6:0",
  "timestamp": "2026-02-11T10:30:00.000Z",
  "reason": "task-execution"
}
```

### Task Status Store

Concurrent-safe updates to `tasks.md` with conflict detection and retry.

**File**: `lib/task/task-status-store.js`

```javascript
const { TaskStatusStore } = require('kiro-spec-engine/lib/task');
const store = new TaskStatusStore(workspaceRoot);

// Update task status with file locking
await store.updateStatus(specName, taskId, 'in-progress');

// Claim a task (with lock + retry)
const result = await store.claimTask(specName, taskId, agentId, username);

// Unclaim a task
await store.unclaimTask(specName, taskId, agentId, username);
```

**Conflict resolution strategy**:
1. Acquire file lock on `tasks.md.lock`
2. Read current file content
3. Validate target line hasn't changed (line-content comparison)
4. Write updated content atomically
5. Release file lock
6. On conflict: exponential backoff retry (up to 5 attempts, starting at 100ms)
7. After retries exhausted: return conflict error, original file preserved

### Steering File Lock

Write serialization for steering files (`.kiro/steering/*.md`).

**File**: `lib/lock/steering-file-lock.js`

```javascript
const { SteeringFileLock } = require('kiro-spec-engine/lib/lock');
const steeringLock = new SteeringFileLock(workspaceRoot);

// Execute callback with lock held
await steeringLock.withLock('CURRENT_CONTEXT.md', async () => {
  // Safe to write to CURRENT_CONTEXT.md
  await fs.writeFile(contextPath, newContent);
});

// Manual lock management
const { lockId } = await steeringLock.acquireLock('CURRENT_CONTEXT.md');
// ... write file ...
await steeringLock.releaseLock('CURRENT_CONTEXT.md', lockId);

// Degraded write (when lock cannot be acquired)
await steeringLock.writePending('CURRENT_CONTEXT.md', content, agentId);
// Creates: .kiro/steering/CURRENT_CONTEXT.md.pending.{agentId}
```

### Merge Coordinator

Git branch isolation per agent for conflict-free parallel development.

**File**: `lib/collab/merge-coordinator.js`

```javascript
const { MergeCoordinator } = require('kiro-spec-engine/lib/collab');
const merger = new MergeCoordinator(workspaceRoot);

// Create agent-specific branch
const { branchName, created } = await merger.createAgentBranch(agentId, specName);
// branchName: "agent/a1b2c3d4e5f6:0/my-spec"

// Check for conflicts before merging
const { hasConflicts, files } = await merger.detectConflicts(branchName, 'main');

// Merge back to main
const result = await merger.merge(branchName, 'main');
// result.strategy: "fast-forward" | "merge-commit" | null (conflicts)

// Clean up merged branch
await merger.cleanupBranch(branchName);
```

**Branch naming**: `agent/{agentId}/{specName}`

### Central Coordinator (Optional)

When `coordinator: true` in config, provides intelligent task assignment based on dependency analysis.

**File**: `lib/collab/coordinator.js`  
**Log**: `.kiro/config/coordination-log.json`

```javascript
const { Coordinator } = require('kiro-spec-engine/lib/collab');
const coordinator = new Coordinator(workspaceRoot, depManager, registry, lockManager);

// Get tasks ready to execute (dependencies satisfied, not locked)
const readyTasks = await coordinator.getReadyTasks(specName);

// Request a task assignment
const assignment = await coordinator.assignTask(agentId);
// assignment: { specName, taskId, task } or null

// Mark task complete (releases lock, computes newly ready tasks)
const { newReadyTasks } = await coordinator.completeTask(specName, taskId, agentId);

// Get progress across all specs
const { specs, agents } = await coordinator.getProgress();
```

---

## Typical Workflow

```
Agent A                          Agent B
  │                                │
  ├─ register() → agentId:0       ├─ register() → agentId:1
  │                                │
  ├─ acquireTaskLock(1.1) ✅       ├─ acquireTaskLock(1.1) ❌ (locked)
  │                                ├─ acquireTaskLock(1.2) ✅
  │                                │
  ├─ work on task 1.1              ├─ work on task 1.2
  │                                │
  ├─ releaseTaskLock(1.1)          ├─ releaseTaskLock(1.2)
  │                                │
  ├─ acquireTaskLock(2.1) ✅       ├─ acquireTaskLock(2.2) ✅
  │  ...                           │  ...
  │                                │
  ├─ deregister()                  ├─ deregister()
```

---

## Failure Recovery

### Agent Crashes

When an agent crashes without deregistering:

1. Its heartbeat stops updating
2. Another agent (or periodic cleanup) calls `registry.cleanupInactive()`
3. All locks held by the crashed agent are automatically released
4. Other agents can now claim those tasks

### File Write Conflicts

When two agents try to update `tasks.md` simultaneously:

1. TaskStatusStore uses file-level locking (`tasks.md.lock`)
2. The second writer detects the lock and retries with exponential backoff
3. Line-content validation ensures no silent overwrites
4. After 5 retries, returns a conflict error (original file preserved)

### Steering File Conflicts

When two agents try to update a steering file:

1. SteeringFileLock serializes writes
2. If lock cannot be acquired after 3 retries, the agent writes to a `.pending` file
3. The pending file can be manually merged later

### Git Merge Conflicts

When agent branches have conflicting changes:

1. `detectConflicts()` performs a dry-run merge to check
2. If conflicts exist, `merge()` returns the list of conflicting files
3. Conflicts must be resolved manually before merging

---

## Single-Agent Backward Compatibility

All components check `MultiAgentConfig.isEnabled()` before doing anything:

| Component | Single-Agent Behavior |
|-----------|----------------------|
| AgentRegistry | Not used |
| TaskLockManager | Delegates to existing LockManager |
| TaskStatusStore | Delegates to existing TaskClaimer (no lock, no retry) |
| SteeringFileLock | Not used |
| MergeCoordinator | Returns current branch, no branch creation |
| Coordinator | All methods return empty results |

**Zero overhead**: No extra file I/O, no lock files, no registry files.

---

## Configuration Reference

### `.kiro/config/multi-agent.json`

```json
{
  "enabled": true,
  "coordinator": false,
  "heartbeatIntervalMs": 30000,
  "heartbeatTimeoutMs": 120000
}
```

### File Locations

| File | Purpose |
|------|---------|
| `.kiro/config/multi-agent.json` | Multi-agent configuration |
| `.kiro/config/agent-registry.json` | Active agent registry |
| `.kiro/config/coordination-log.json` | Coordinator assignment log |
| `.kiro/specs/{spec}/locks/{taskId}.lock` | Task lock files |
| `.kiro/specs/{spec}/tasks.md.lock` | tasks.md file lock |
| `.kiro/steering/{file}.lock` | Steering file locks |
| `.kiro/steering/{file}.pending.{agentId}` | Pending steering writes |

---

## API Reference

### Module Exports

```javascript
// Collaboration modules
const { AgentRegistry, Coordinator, MergeCoordinator, MultiAgentConfig } = require('kiro-spec-engine/lib/collab');

// Lock modules
const { TaskLockManager, SteeringFileLock } = require('kiro-spec-engine/lib/lock');

// Task modules
const { TaskStatusStore } = require('kiro-spec-engine/lib/task');
```

---

## Related Documentation

- [Spec-Level Collaboration Guide](spec-collaboration-guide.md) — Coordinate multiple Specs across AI instances
- [Spec Locking Guide](spec-locking-guide.md) — Single-agent Spec locking mechanism
- [Team Collaboration Guide](team-collaboration-guide.md) — Multi-user team workflows
