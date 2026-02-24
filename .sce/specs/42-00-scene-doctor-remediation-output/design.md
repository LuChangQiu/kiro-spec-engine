# Design Document: Scene Doctor Remediation Output

## Overview

Enhance doctor pipeline in `lib/commands/scene.js` by adding:
1) suggestion generation,
2) optional markdown checklist writing,
3) richer text output in non-JSON mode.

## Key Additions

- Doctor option: `--todo-out <path>`
- New helper functions:
  - `buildDoctorSuggestions(report, sceneManifest)`
  - `buildDoctorTodoMarkdown(report, suggestions)`
  - `writeDoctorTodo(options, report, projectRoot, fileSystem)`
- Doctor report now includes:
  - `suggestions`
  - `todo_output` (when exported)

## Suggestion Strategy

- Rule-based mapping for policy reasons and adapter failures.
- Deduplicate repeated suggestions.
- Always return at least one guidance item (`ready-to-run`) in healthy state.

## Output Artifact

- Markdown checklist includes:
  - scene metadata
  - blockers section
  - suggested action checklist
- Output path resolved relative to project root unless absolute path is provided.
