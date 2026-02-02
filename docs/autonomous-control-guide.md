# Autonomous Control Guide

## Overview

The Autonomous Control feature transforms kse from an interactive assistant into an autonomous development partner. AI can independently manage entire development workflows - from understanding user goals to delivering production-ready features.

**Key Capabilities**:
- **Autonomous Spec Creation**: Generate requirements, design, and tasks without step-by-step confirmation
- **Continuous Task Execution**: Execute multiple tasks without interruption
- **Intelligent Error Recovery**: Automatically diagnose and fix errors (3 retry attempts)
- **Strategic Checkpoints**: Pause only at meaningful milestones for user review
- **Learning System**: Improve over time by learning from successes and failures
- **Safety Boundaries**: Respect workspace boundaries, require confirmation for sensitive operations

## Quick Start

### Create and Run a Feature Autonomously

```bash
# Create a new Spec and execute it autonomously
kse auto create "user authentication with JWT tokens"
```

This single command will:
1. Generate requirements.md with acceptance criteria
2. Generate design.md with architecture and components
3. Generate tasks.md with implementation plan
4. Execute all tasks continuously
5. Handle errors automatically
6. Create checkpoints at phase boundaries
7. Deliver the complete feature

### Run an Existing Spec

```bash
# Run an existing Spec autonomously
kse auto run 33-00-ai-autonomous-control
```

### Check Status

```bash
# View current execution status
kse auto status
```

### Resume After Pause

```bash
# Resume from last checkpoint
kse auto resume
```

### Stop Execution

```bash
# Gracefully stop and save state
kse auto stop
```

## Execution Modes

### Conservative Mode (Default)

**Best for**: Production features, critical systems, first-time users

**Behavior**:
- Creates checkpoints after each major phase
- Requests user approval at phase boundaries
- More cautious error recovery
- Detailed logging

**Configuration**:
```json
{
  "mode": "conservative",
  "checkpoints": {
    "requirementsReview": true,
    "designReview": true,
    "phaseCompletion": true,
    "finalReview": true
  }
}
```

### Balanced Mode

**Best for**: Most development scenarios

**Behavior**:
- Creates checkpoints at phase completions
- Requests approval for major decisions
- Standard error recovery
- Balanced logging

**Configuration**:
```json
{
  "mode": "balanced",
  "checkpoints": {
    "requirementsReview": false,
    "designReview": false,
    "phaseCompletion": true,
    "finalReview": true
  }
}
```

### Aggressive Mode

**Best for**: Rapid prototyping, experimental features, experienced users

**Behavior**:
- Minimal checkpoints (only on fatal errors)
- No approval requests
- Aggressive error recovery
- Minimal logging

**Configuration**:
```json
{
  "mode": "aggressive",
  "checkpoints": {
    "requirementsReview": false,
    "designReview": false,
    "phaseCompletion": false,
    "finalReview": false
  }
}
```

## Configuration

### Global Configuration

Location: `.kiro/auto/config.json`

```json
{
  "version": "1.0.0",
  "mode": "balanced",
  "checkpoints": {
    "requirementsReview": false,
    "designReview": false,
    "tasksReview": false,
    "phaseCompletion": true,
    "finalReview": true,
    "errorThreshold": 3
  },
  "errorRecovery": {
    "enabled": true,
    "maxAttempts": 3,
    "strategies": ["syntax-fix", "import-resolution", "type-correction", "null-check", "error-handling"],
    "learningEnabled": true
  },
  "safety": {
    "requireProductionConfirmation": true,
    "requireExternalResourceConfirmation": true,
    "requireDestructiveOperationConfirmation": true,
    "allowedOperations": [],
    "blockedOperations": []
  },
  "performance": {
    "maxConcurrentTasks": 1,
    "taskTimeout": 300000,
    "checkpointInterval": 600000
  }
}
```

### Per-Spec Configuration

Location: `.kiro/specs/{spec-name}/auto-config.json`

Per-spec configuration overrides global settings.

### Manage Configuration

```bash
# View current configuration
kse auto config

# Set mode
kse auto config --mode aggressive

# Enable/disable checkpoints
kse auto config --checkpoint phaseCompletion=false

# Set error recovery attempts
kse auto config --error-recovery maxAttempts=5
```

## Error Recovery

### Automatic Recovery Strategies

1. **Syntax Fix**: Parse error messages and fix syntax issues
2. **Import Resolution**: Add missing imports, fix module paths
3. **Type Correction**: Fix type mismatches and add type annotations
4. **Null Check**: Add null/undefined checks
5. **Error Handling**: Wrap code in try-catch blocks

### Recovery Process

1. **Error Detection**: Error encountered during task execution
2. **Error Analysis**: Classify error type and severity
3. **Strategy Selection**: Choose best recovery strategy (learned from history)
4. **Apply Fix**: Implement the fix
5. **Validation**: Re-run tests to verify fix
6. **Retry or Pause**: If successful, continue; if failed after 3 attempts, pause

### Learning System

The error recovery system learns from experience:
- **Success History**: Tracks which strategies work for each error type
- **Failure History**: Tracks which strategies fail
- **Strategy Prioritization**: Prioritizes strategies with higher success rates
- **Continuous Improvement**: Gets better over time

## Checkpoints and Rollback

### Checkpoint Types

- **Requirements Complete**: After requirements.md generated
- **Design Complete**: After design.md generated
- **Tasks Complete**: After tasks.md generated
- **Phase Complete**: After each major phase (implementation, QA)
- **Fatal Error**: When unrecoverable error occurs
- **External Resource Needed**: When API keys or credentials required
- **Final Review**: Before marking Spec complete

### Rollback

```bash
# List available checkpoints
kse auto checkpoints

# Rollback to specific checkpoint
kse auto rollback <checkpoint-id>

# Rollback to last checkpoint
kse auto rollback --last
```

**What Gets Rolled Back**:
- File modifications
- Task queue state
- Progress tracking
- Execution log (preserved for audit)

## Safety Boundaries

### Automatic Safety Checks

1. **Production Environment**: Requires confirmation before modifying production
2. **Workspace Boundary**: Blocks operations outside workspace directory
3. **External Access**: Requires confirmation for API calls and network requests
4. **Destructive Operations**: Requires confirmation for file deletion, database drops

### Override Safety Checks

```bash
# Allow specific operation
kse auto config --safety allowedOperations=api-call,network-request

# Block specific operation
kse auto config --safety blockedOperations=delete-file,drop-database
```

## Progress Tracking

### Real-Time Status

```bash
kse auto status
```

**Output**:
```
Autonomous Execution Status
===========================

Spec: 33-00-ai-autonomous-control
Mode: balanced
Status: Running

Progress: 65%
Phase: implementation
Current Task: 9.6 Implement continuous task execution

Tasks: 12/18 completed (6 remaining)
Errors: 2 encountered, 2 resolved (100% recovery rate)

Started: 2026-02-02T10:30:00Z
Estimated Completion: 2026-02-02T11:45:00Z

Recent Actions:
  ✅ 10:45:23 - Task 9.5 completed
  ✅ 10:44:15 - Error recovered (strategy: import-resolution)
  ❌ 10:44:10 - Error encountered: Cannot find module 'fs-extra'
  ✅ 10:42:30 - Task 9.4 completed
  ✅ 10:40:15 - Task 9.3 completed
```

### Detailed Report

```bash
# Generate detailed report
kse auto report --format markdown --output report.md
kse auto report --format json --output report.json
```

## Best Practices

### When to Use Autonomous Mode

**✅ Good Use Cases**:
- Implementing well-defined features
- Creating new Specs from clear requirements
- Repetitive implementation tasks
- Prototyping and experimentation
- Batch processing multiple similar tasks

**❌ Not Recommended**:
- Unclear or ambiguous requirements
- Complex architectural decisions requiring human judgment
- Features requiring external resources you don't have
- Critical production changes without review

### Optimizing Autonomous Execution

1. **Clear Feature Descriptions**: Provide detailed, specific feature descriptions
2. **Choose Right Mode**: Use conservative for critical features, aggressive for prototypes
3. **Monitor Progress**: Check status periodically
4. **Review Checkpoints**: Review and approve at checkpoint boundaries
5. **Learn from History**: Let the system learn from multiple executions

### Handling Interruptions

**Graceful Stop**:
```bash
# Stop and save state
kse auto stop
```

**Emergency Stop** (Ctrl+C):
- State automatically saved
- Can resume from last checkpoint
- No data loss

**Resume**:
```bash
# Resume from where you left off
kse auto resume
```

## Troubleshooting

### Execution Stuck

**Symptom**: Progress not advancing

**Solutions**:
1. Check status: `kse auto status`
2. Review recent actions for errors
3. Check if waiting for user input
4. Stop and resume: `kse auto stop && kse auto resume`

### Repeated Errors

**Symptom**: Same error occurring multiple times

**Solutions**:
1. Review error in execution log
2. Check if error is environmental (missing dependencies, permissions)
3. Manually fix the issue
4. Resume execution

### Checkpoint Not Created

**Symptom**: Expected checkpoint not appearing

**Solutions**:
1. Check mode configuration
2. Verify checkpoint settings: `kse auto config`
3. Ensure phase actually completed

### Rollback Failed

**Symptom**: Cannot rollback to checkpoint

**Solutions**:
1. Check if checkpoint exists: `kse auto checkpoints`
2. Verify no external file modifications
3. Try earlier checkpoint
4. Manual recovery if needed

## Advanced Usage

### Custom Recovery Strategies

```javascript
// In your project's .kiro/auto/custom-strategies.js
module.exports = {
  'custom-fix': async (error, context) => {
    // Your custom recovery logic
    return {
      success: true,
      action: 'custom-action',
      details: 'Applied custom fix'
    };
  }
};
```

### Integration with CI/CD

```yaml
# .github/workflows/autonomous-feature.yml
name: Autonomous Feature Development

on:
  issues:
    types: [labeled]

jobs:
  develop:
    if: github.event.label.name == 'auto-implement'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install kse
        run: npm install -g kiro-spec-engine
      - name: Create feature autonomously
        run: kse auto create "${{ github.event.issue.title }}"
      - name: Create pull request
        uses: peter-evans/create-pull-request@v4
```

### Monitoring and Alerts

```bash
# Enable notifications
kse auto config --notifications enabled=true onError=true onCompletion=true

# Export logs for monitoring
kse auto report --format json | jq '.errors'
```

## FAQ

**Q: How long does autonomous execution take?**
A: Depends on feature complexity. Simple features: 5-15 minutes. Complex features: 30-60 minutes. The system provides real-time estimates.

**Q: Can I interrupt autonomous execution?**
A: Yes, use `kse auto stop` or Ctrl+C. State is saved and you can resume later.

**Q: What happens if my computer crashes during execution?**
A: State is saved periodically. Resume from last checkpoint with `kse auto resume`.

**Q: How accurate is error recovery?**
A: Improves over time. Initial success rate ~60-70%, improves to ~85-90% with learning.

**Q: Can I review changes before they're applied?**
A: Yes, use conservative mode with checkpoint reviews enabled.

**Q: Does autonomous mode work with existing Specs?**
A: Yes, use `kse auto run <spec-name>` to execute existing Specs autonomously.

**Q: How do I disable autonomous mode?**
A: Simply don't use `kse auto` commands. Use regular `kse` commands for interactive mode.

## See Also

- [Spec Workflow Guide](./spec-workflow.md)
- [Testing Strategy](./testing-strategy.md)
- [CORE_PRINCIPLES](./.kiro/steering/CORE_PRINCIPLES.md)
- [Command Reference](./command-reference.md)
