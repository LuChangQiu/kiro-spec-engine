# Kiro IDE Agent Hooks

This directory contains Agent Hooks configurations for Kiro IDE. These hooks automate common development tasks by triggering actions when specific events occur.

## Available Hooks

### 1. Run Tests on Save
**File**: `run-tests-on-save.json`  
**Trigger**: When JavaScript files in `lib/` or `tests/` are saved  
**Action**: Asks agent to run tests and analyze failures

### 2. Lint on Prompt Submit
**File**: `lint-on-prompt.json`  
**Trigger**: When submitting a prompt to the agent  
**Action**: Runs `npm run lint` to check code quality

### 3. Sync Tasks on Edit
**File**: `sync-tasks-on-edit.json`  
**Trigger**: When `tasks.md` is edited  
**Action**: Asks agent to review changes and sync workspace

### 4. Check Spec on Create
**File**: `check-spec-on-create.json`  
**Trigger**: When new spec documents are created  
**Action**: Asks agent to validate spec structure and completeness

### 5. Test Coverage Check
**File**: `test-coverage-check.json`  
**Trigger**: When agent stops working  
**Action**: Runs tests with coverage report

### 6. Update Changelog Reminder
**File**: `update-changelog.json`  
**Trigger**: When `tasks.md` is edited  
**Action**: Reminds agent to update CHANGELOG.md if tasks completed

## Hook Configuration Format

Each hook is a JSON file with the following structure:

```json
{
  "name": "Hook Name",
  "version": "1.0.0",
  "description": "What this hook does",
  "when": {
    "type": "eventType",
    "patterns": ["file/patterns"]
  },
  "then": {
    "type": "actionType",
    "prompt": "For askAgent",
    "command": "For runCommand"
  }
}
```

### Event Types

- `fileEdited` - When a file is saved
- `fileCreated` - When a new file is created
- `fileDeleted` - When a file is deleted
- `promptSubmit` - When a message is sent to the agent
- `agentStop` - When agent execution completes
- `userTriggered` - Manual trigger by user

### Action Types

- `askAgent` - Send a message to the agent
- `runCommand` - Execute a shell command (only valid with `promptSubmit` and `agentStop`)

## Managing Hooks

### View Hooks
Use the Kiro IDE "Agent Hooks" section in the explorer view to see all hooks.

### Enable/Disable Hooks
You can enable or disable hooks through the Kiro IDE UI or by editing the JSON files.

### Create New Hooks
1. Create a new JSON file in this directory
2. Follow the configuration format above
3. Reload Kiro IDE or use "Refresh Hooks" command

### Edit Hooks
Edit the JSON files directly or use the Kiro IDE hook editor.

## Best Practices

1. **Keep hooks focused** - Each hook should do one thing well
2. **Use descriptive names** - Make it clear what the hook does
3. **Add debouncing** - For file events, consider adding delays to avoid too many triggers
4. **Test hooks** - Verify hooks work as expected before relying on them
5. **Document changes** - Update this README when adding new hooks

## Troubleshooting

### Hook not triggering
- Check the event type matches your use case
- Verify file patterns are correct
- Check Kiro IDE logs for errors

### Command fails
- Ensure the command is valid for your system
- Check that required tools are installed
- Verify command syntax is correct

### Too many triggers
- Add debouncing to file events
- Use more specific file patterns
- Consider combining related hooks

## Version History

- **1.0.0** (2026-01-23) - Initial hooks setup for kiro-spec-engine project
  - Run tests on save
  - Lint on prompt submit
  - Sync tasks on edit
  - Check spec on create
  - Test coverage check
  - Update changelog reminder

