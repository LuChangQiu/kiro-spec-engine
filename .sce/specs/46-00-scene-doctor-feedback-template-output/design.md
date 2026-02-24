# Design Document: Scene Doctor Feedback Template Output

## Overview

Add a third doctor artifact stream focused on execution feedback collection.
The template is generated from the doctor report and, when available, task sync metadata.

## Key Changes

- Extend doctor command options with `--feedback-out <path>`.
- Add `feedbackOut` to normalized doctor options.
- Introduce `buildDoctorFeedbackTemplate(report)` to render markdown:
  - doctor context header,
  - task feedback records for each synced actionable task,
  - fallback placeholder when there are no synced tasks.
- Add `writeDoctorFeedbackTemplate(options, report, projectRoot, fileSystem)` to persist markdown safely.
- Integrate writer in doctor execution flow and set `report.feedback_output`.
- Update doctor summary printer to display `Feedback Template` path.

## Data Contract Updates

### Doctor report
- `feedback_output: string` (optional; present when template is exported)

### Feedback template markdown
- Header context lines for scene, domain, mode, status, and trace.
- Per-task checklist entries including:
  - `Status`, `Owner`, `Evidence Paths`, `Completion Notes`, `Eval Update`.

## Compatibility

- Existing doctor workflows are unchanged when `--feedback-out` is omitted.
- JSON consumers receive one additive field and remain backward compatible.
- Task sync remains optional; template gracefully handles empty synced-task sets.
