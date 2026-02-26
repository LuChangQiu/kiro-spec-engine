# SCE Agent Hooks

This directory contains optional SCE hook definitions (`*.sce.hook`) that can be consumed by compatible agent hosts.

## Available Hooks

- `run-tests-on-save.sce.hook`: manual trigger that asks the agent to run tests and summarize failures.
- `sync-tasks-on-edit.sce.hook`: triggers when `tasks.md` changes and asks the agent to sync workspace state.
- `check-spec-on-create.sce.hook`: triggers on new spec docs and asks the agent to validate structure/completeness.

## Hook Schema

Each hook file uses this JSON structure:

```json
{
  "enabled": true,
  "name": "Hook Name",
  "description": "What this hook does",
  "version": "1",
  "when": {
    "type": "fileEdited|fileCreated|userTriggered",
    "patterns": ["**/tasks.md"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "Instruction sent to the agent"
  }
}
```

## Notes

- Keep hooks focused on one action.
- Prefer narrow `patterns` to avoid noisy triggers.
- Keep prompts concise and executable.

