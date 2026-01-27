# Requirements Document

## Introduction

This document specifies the requirements for extending kiro-spec-engine (kse) to support multi-user collaboration and cross-tool compatibility. Currently, kse is designed for single-user usage within Kiro IDE, which creates three critical limitations:

1. **Steering Directory Conflicts**: When projects have existing steering rules, kse's steering files mix with them, causing confusion
2. **Multi-User Collaboration Issues**: Multiple developers cannot work on the same project simultaneously without conflicts in CURRENT_CONTEXT.md, tasks.md, and version.json
3. **Tool Lock-in**: kse relies on Kiro IDE's automatic steering loading, preventing usage in other AI coding tools like Codex, Claude Code, or Cursor

This specification addresses these limitations by introducing steering isolation, personal workspaces, task claiming mechanisms, and explicit context export capabilities.

## Glossary

- **kse**: Kiro Spec Engine, the CLI tool for spec-driven development
- **Steering**: AI behavior rules stored in `.kiro/steering/` directory
- **Spec**: A feature specification consisting of requirements.md, design.md, and tasks.md
- **Workspace**: A personal directory for individual developer's context and state
- **Task_Claiming**: The mechanism for developers to reserve tasks they are working on
- **Context_Export**: The process of generating a standalone context file for use in other AI tools
- **Adoption**: The process of integrating kse into an existing project
- **Namespace**: A directory-based isolation mechanism for separating kse and project steering files

## Requirements

### Requirement 1: Steering Exclusivity Management

**User Story:** As a project maintainer, I want to choose between kse steering rules and my project's existing steering rules, so that Kiro IDE doesn't load conflicting rules.

#### Acceptance Criteria

1. WHEN a project has existing steering files in `.kiro/steering/`, THE System SHALL detect the conflict during adoption
2. WHEN steering conflicts are detected, THE System SHALL prompt for an exclusivity strategy (use-kse/use-project/backup-and-replace)
3. WHEN "use-kse" is selected, THE System SHALL backup existing steering files to `.kiro/backups/steering-{timestamp}/` and install kse steering files
4. WHEN "use-project" is selected, THE System SHALL skip kse steering file installation and document this choice in `.kiro/adoption-config.json`
5. WHEN "backup-and-replace" is selected, THE System SHALL create a backup and replace existing steering files with kse templates

### Requirement 2: Adoption Strategy Selection

**User Story:** As a developer, I want to choose how kse integrates with my existing project structure, so that I can maintain control over my project's configuration.

#### Acceptance Criteria

1. WHEN running `kse adopt`, THE System SHALL detect existing steering files
2. IF existing steering files are found, THEN THE System SHALL present two strategy options: use-kse or use-project
3. WHEN "use-kse" is selected, THE System SHALL backup existing steering files and install kse steering templates
4. WHEN "use-project" is selected, THE System SHALL skip kse steering installation and preserve existing steering files
5. THE System SHALL document the chosen strategy in `.kiro/adoption-config.json`
6. THE System SHALL provide clear documentation explaining the steering exclusivity constraint

### Requirement 3: Personal Workspace Management

**User Story:** As a team member, I want my own workspace for context and state, so that my work doesn't conflict with other developers.

#### Acceptance Criteria

1. WHEN a developer runs `kse workspace init`, THE System SHALL create a personal workspace directory `.kiro/workspace/{username}/`
2. THE System SHALL create a personal CURRENT_CONTEXT.md file in the workspace directory
3. THE System SHALL store personal task state in the workspace directory
4. WHEN multiple developers work on the same project, THE System SHALL maintain separate workspace directories for each developer
5. THE System SHALL detect the current user from git config or environment variables

### Requirement 4: Task Claiming Mechanism

**User Story:** As a developer, I want to claim tasks I'm working on, so that other team members know which tasks are in progress.

#### Acceptance Criteria

1. WHEN a developer runs `kse task claim {task-id}`, THE System SHALL mark the task with the developer's username in tasks.md
2. THE System SHALL update the task status to "in-progress" and add a timestamp
3. WHEN a task is already claimed by another developer, THE System SHALL display a warning and require confirmation to override
4. WHEN a developer runs `kse task unclaim {task-id}`, THE System SHALL remove the claim marker and reset the task status
5. THE System SHALL display claimed tasks with format: `- [x] 2.1 Task description [@username, claimed: 2026-01-23]`

### Requirement 5: Team Status Visibility

**User Story:** As a team lead, I want to see which tasks are being worked on by which developers, so that I can coordinate team efforts.

#### Acceptance Criteria

1. WHEN running `kse status`, THE System SHALL display all specs in the project
2. FOR each spec, THE System SHALL show task completion statistics and claimed tasks
3. THE System SHALL display claimed tasks grouped by developer
4. THE System SHALL show task status (not-started/in-progress/completed) for each claimed task
5. THE System SHALL highlight overdue or stale claims (claimed more than 7 days ago without progress)

### Requirement 6: Context Export for Cross-Tool Compatibility

**User Story:** As a developer using Claude Code or Cursor, I want to export kse context, so that I can use kse specs in my preferred AI coding tool.

#### Acceptance Criteria

1. WHEN running `kse context export {spec-name}`, THE System SHALL generate a standalone Markdown file containing all relevant context
2. THE exported context SHALL include requirements.md, design.md, tasks.md, and relevant steering rules
3. THE System SHALL format the export as a single Markdown document with clear section headers
4. THE System SHALL save the export to `.kiro/specs/{spec-name}/context-export.md`
5. THE exported file SHALL be self-contained and usable without kse CLI

### Requirement 7: Prompt Generation for AI Tools

**User Story:** As a developer, I want to generate ready-to-use prompts for AI tools, so that I can quickly start working on a task in any AI coding assistant.

#### Acceptance Criteria

1. WHEN running `kse prompt generate {spec-name} {task-id}`, THE System SHALL create a prompt file for the specified task
2. THE prompt SHALL include task description, relevant requirements, design sections, and code context
3. THE System SHALL format the prompt according to best practices for AI coding assistants
4. THE System SHALL save the prompt to `.kiro/specs/{spec-name}/prompts/task-{task-id}.md`
5. THE prompt SHALL include instructions for the AI to update task status after completion

### Requirement 8: Cross-Tool Documentation

**User Story:** As a new kse user, I want clear documentation on using kse with different AI tools, so that I can choose the best workflow for my needs.

#### Acceptance Criteria

1. THE System SHALL provide documentation in `docs/cross-tool-guide.md`
2. THE documentation SHALL include setup instructions for Kiro IDE, Claude Code, Cursor, and Codex
3. FOR each tool, THE documentation SHALL explain how to load kse context and work with specs
4. THE documentation SHALL provide example workflows for common scenarios
5. THE documentation SHALL explain the limitations and trade-offs of each tool integration

### Requirement 9: Workspace Synchronization

**User Story:** As a developer, I want my workspace state to sync with the shared tasks.md, so that my progress is visible to the team.

#### Acceptance Criteria

1. WHEN a developer completes a task in their workspace, THE System SHALL update the shared tasks.md file
2. WHEN running `kse workspace sync`, THE System SHALL reconcile personal workspace state with shared task state
3. IF conflicts are detected during sync, THE System SHALL prompt the developer to resolve them
4. THE System SHALL preserve personal context (CURRENT_CONTEXT.md) while syncing task status
5. THE System SHALL log all sync operations to `.kiro/workspace/{username}/sync.log`

### Requirement 10: Backward Compatibility

**User Story:** As an existing kse user, I want the new features to be optional, so that my current workflow is not disrupted.

#### Acceptance Criteria

1. WHEN a project was adopted before multi-user support, THE System SHALL continue to work in single-user mode
2. THE System SHALL detect single-user mode by absence of workspace directories
3. WHEN running multi-user commands in single-user mode, THE System SHALL provide helpful migration instructions
4. THE System SHALL allow gradual migration from single-user to multi-user mode
5. THE System SHALL preserve all existing functionality for single-user projects

### Requirement 11: Agent Hooks Investigation

**User Story:** As a kse developer, I want to understand Kiro's agent hooks feature, so that I can determine if it can improve kse's functionality.

#### Acceptance Criteria

1. THE System SHALL document the investigation of Kiro agent hooks in `docs/agent-hooks-analysis.md`
2. THE documentation SHALL explain what agent hooks are and how they work in Kiro IDE
3. THE documentation SHALL analyze potential use cases for agent hooks in kse context
4. THE documentation SHALL provide recommendations on whether to integrate agent hooks into kse
5. IF agent hooks are beneficial, THE documentation SHALL outline an integration plan

## Non-Functional Requirements

### Performance

- Context export SHALL complete within 5 seconds for specs with up to 100 tasks
- Task claiming operations SHALL complete within 1 second
- Workspace sync SHALL complete within 3 seconds for typical project sizes

### Usability

- All new commands SHALL follow existing kse CLI conventions
- Error messages SHALL provide clear guidance on how to resolve issues
- Documentation SHALL include examples for all common use cases

### Compatibility

- The System SHALL work on Windows, macOS, and Linux
- The System SHALL support Node.js 14.x and above
- Exported context files SHALL be compatible with all major AI coding tools

### Security

- Personal workspace directories SHALL be excluded from version control by default
- The System SHALL not expose sensitive information in exported context files
- Task claiming SHALL respect git user configuration for authentication

