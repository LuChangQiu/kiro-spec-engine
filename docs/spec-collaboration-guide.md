# Spec-Level Collaboration Guide

## Overview

The Spec-level collaboration system enables multiple AI instances (SCE) to work on different Specs in parallel within a large project. This guide explains how to use the collaboration features to coordinate parallel development efforts.

## Key Concepts

### Master Spec and Sub-Specs

- **Master Spec**: A high-level Spec that defines the overall feature and breaks it down into multiple Sub-Specs
- **Sub-Spec**: A child Spec that implements a specific module or component of the Master Spec

### Dependencies

Specs can depend on other Specs in three ways:

- **requires-completion**: The dependent Spec must be fully completed before this Spec can start
- **requires-interface**: The dependent Spec must have its interface defined (can be in-progress)
- **optional**: The dependency is optional and doesn't block progress

### Interface Contracts

Interface contracts formally define the APIs, data structures, and behaviors that a Spec provides or consumes. They ensure compatibility between independently developed Specs.

### SCE Instances

A SCE instance is an AI assistant working on a specific Spec. You can assign Specs to different instances to enable parallel development.

## Quick Start

### 1. Initialize a Master Spec

Create a Master Spec with Sub-Specs:

```bash
sce collab init user-management \
  --sub-specs user-service auth-service session-manager \
  --dependencies "auth-service:user-service" \
  --dependencies "session-manager:auth-service"
```

This creates:
- A Master Spec called `user-management`
- Three Sub-Specs: `user-service`, `auth-service`, `session-manager`
- Dependencies: `auth-service` depends on `user-service`, `session-manager` depends on `auth-service`

### 2. Check Status

View all Specs and their status:

```bash
sce collab status
```

View dependency graph:

```bash
sce collab status --graph
```

### 3. Assign Specs to SCE Instances

Assign Specs to different AI instances:

```bash
sce collab assign user-service SCE-1
sce collab assign auth-service SCE-2
sce collab assign session-manager SCE-3
```

### 4. Define Interface Contracts

Create an interface contract for a Spec (in `.sce/specs/{spec-name}/interfaces/`):

```json
{
  "version": "1.0.0",
  "spec": "user-service",
  "interfaces": [
    {
      "name": "UserService",
      "type": "class",
      "exports": [
        {
          "name": "createUser",
          "type": "function",
          "signature": "(userData: UserData) => Promise<User>",
          "required": true
        },
        {
          "name": "getUser",
          "type": "function",
          "signature": "(userId: string) => Promise<User>",
          "required": true
        }
      ]
    }
  ],
  "types": [
    {
      "name": "UserData",
      "definition": "{ name: string, email: string }"
    },
    {
      "name": "User",
      "definition": "{ id: string, name: string, email: string }"
    }
  ]
}
```

### 5. Verify Contracts

Verify that implementations match contracts:

```bash
sce collab verify user-service
```

### 6. Run Integration Tests

Run integration tests across multiple Specs:

```bash
sce collab integrate user-service auth-service session-manager
```

## Workflow Example

### Scenario: Building a User Management System

**Step 1: Architect creates Master Spec**

```bash
sce collab init user-management \
  --sub-specs database-layer user-service auth-service notification-service \
  --dependencies "user-service:database-layer" \
  --dependencies "auth-service:user-service" \
  --dependencies "notification-service:user-service"
```

**Step 2: Check which Specs are ready**

```bash
sce collab status
```

Output:
```
Total Specs: 5
Ready to Start: 1

✓ user-management (unassigned)
○ database-layer (unassigned)
○ user-service (unassigned)
○ auth-service (unassigned)
○ notification-service (unassigned)

Ready to start: database-layer
```

**Step 3: Assign and start development**

```bash
sce collab assign database-layer SCE-1
sce collab assign user-service SCE-2
sce collab assign auth-service SCE-3
```

**Step 4: Define interfaces**

Each SCE instance defines the interface contract for their Spec.

**Step 5: Verify and integrate**

```bash
sce collab verify database-layer
sce collab verify user-service
sce collab integrate database-layer user-service
```

## Commands Reference

### `sce collab init`

Initialize a Master Spec with Sub-Specs.

```bash
sce collab init <master-spec> [options]
```

Options:
- `-s, --sub-specs <specs...>`: Sub-spec names
- `-d, --dependencies <deps...>`: Dependencies in format "spec:dep1,dep2"

### `sce collab status`

Display collaboration status.

```bash
sce collab status [spec-name] [options]
```

Options:
- `-g, --graph`: Show dependency graph
- `--critical-path`: Highlight critical path in graph

### `sce collab assign`

Assign a Spec to a SCE instance.

```bash
sce collab assign <spec-name> <SCE-instance>
```

### `sce collab verify`

Verify interface contracts for a Spec.

```bash
sce collab verify <spec-name>
```

### `sce collab integrate`

Run integration tests across Specs.

```bash
sce collab integrate <spec-names...>
```

### `sce collab migrate`

Convert a standalone Spec to collaborative mode.

```bash
sce collab migrate <spec-name>
```

## Best Practices

### 1. Clear Interface Contracts

Define clear, complete interface contracts before starting implementation. This prevents integration issues later.

### 2. Minimal Dependencies

Keep dependencies minimal and well-justified. Too many dependencies create bottlenecks.

### 3. Regular Verification

Run `sce collab verify` frequently to catch interface mismatches early.

### 4. Integration Testing

Write integration tests that span multiple Specs to verify they work together correctly.

### 5. Status Updates

Update Spec status regularly so other SCE instances know when dependencies are ready.

### 6. Critical Path Awareness

Use `sce collab status --graph --critical-path` to identify bottlenecks and prioritize work.

## Troubleshooting

### Circular Dependency Detected

**Error**: `Circular dependency detected: spec-a → spec-b → spec-c → spec-a`

**Solution**: Remove one of the dependencies to break the cycle. Redesign the architecture if necessary.

### Interface Mismatch

**Error**: `Implementation does not match contract for 'UserService'`

**Solution**: Update either the implementation or the contract to match. Run `sce collab verify` to see specific mismatches.

### Spec Blocked

**Error**: `Cannot assign blocked spec (reason: API key missing)`

**Solution**: Resolve the blocking issue first, then reassign the Spec.

## Advanced Topics

### Hierarchical Structures

You can create nested structures with Sub-Sub-Specs:

```bash
sce collab init backend-system --sub-specs api-layer business-logic data-layer
sce collab init api-layer --sub-specs rest-api graphql-api
```

### Breaking Changes

When you need to make breaking changes to an interface:

1. Version the interface (e.g., `UserServiceV2.json`)
2. Update consumers to use the new version
3. Run `sce collab verify` to detect breaking changes
4. Coordinate with affected SCE instances

### Custom Integration Tests

Create integration tests in `.sce/specs/{master-spec}/integration-tests/`:

```javascript
module.exports = {
  name: 'User Authentication Flow',
  specs: ['user-service', 'auth-service'],
  async setup() {
    // Setup test environment
  },
  async test() {
    const userService = require('../../user-service/lib/user-service');
    const authService = require('../../auth-service/lib/auth-service');
    
    // Test cross-spec functionality
    const user = await userService.createUser({ name: 'Test', email: 'test@example.com' });
    const token = await authService.login(user.email, 'password');
    assert(token, 'Should receive auth token');
  },
  async teardown() {
    // Cleanup
  }
};
```

## Metadata File Format

Collaboration metadata is stored in `.sce/specs/{spec-name}/collaboration.json`:

```json
{
  "version": "1.0.0",
  "type": "master" | "sub",
  "masterSpec": "parent-spec-name",
  "subSpecs": ["child-1", "child-2"],
  "dependencies": [
    {
      "spec": "other-spec",
      "type": "requires-completion",
      "reason": "Needs database schema"
    }
  ],
  "assignment": {
    "kiroInstance": "SCE-1",
    "assignedAt": "2026-02-01T10:00:00Z"
  },
  "status": {
    "current": "in-progress",
    "updatedAt": "2026-02-01T10:00:00Z"
  },
  "interfaces": {
    "provides": ["UserService.json"],
    "consumes": ["other-spec/interfaces/DatabaseService.json"]
  }
}
```

## See Also

- [Spec Workflow Guide](../README.md)
- [Multi-Repository Management](multi-repo-management-guide.md)
- [Environment Management](environment-management-guide.md)
