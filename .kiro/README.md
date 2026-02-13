# Project Development Guide

> **AI Tools: Read this first!** This project follows Spec-driven development methodology powered by kse (Kiro Spec Engine).

---

## 🎯 How This Project Works

This project uses **Spec-driven development** - a structured approach where:
- Every feature starts with a **Spec** (requirements + design + tasks)
- All work is tracked and documented
- AI tools help implement features according to Specs

**Your role as AI:**
- When user requests a feature → Check if Spec exists, if not, help create one
- When implementing → Follow the Spec's requirements and design
- When stuck → Read the Spec documents for context
- Track progress by updating task status

---

## 🚀 kse Capabilities (v1.45.x)

**IMPORTANT**: After installing or updating kse, read this section to understand all available capabilities. Using the right tool for the job ensures efficient, high-quality development.

### Core: Spec-Driven Development
- `kse adopt` — Initialize kse in a project (creates `.kiro/` structure)
- `kse create-spec <name>` — Create a new Spec (requirements + design + tasks)
- `kse status` — Show project status and Spec progress
- `kse workflows` — List available Specs and workflows
- `kse context export <spec-name>` — Export Spec context for AI consumption
- `kse prompt generate <spec> <task>` — Generate task-specific prompt

### Task Management
- `kse task claim <spec> <task-id>` — Claim a task for execution
- `kse task list <spec>` — List claimed tasks
- Task status tracking in `tasks.md`: `[ ]` not started, `[-]` in progress, `[x]` completed

### Spec Locking (Multi-User)
- `kse lock acquire <spec>` — Lock a Spec to prevent conflicts
- `kse lock release <spec>` / `kse unlock <spec>` — Release lock
- `kse lock status` — Check lock status
- `kse lock cleanup` — Remove stale locks (24h timeout)
- `kse lock whoami` — Show machine identifier

### Workspace Management
- `kse workspace create/list/switch/info/remove` — Manage multiple kse projects
- Global state: `~/.kse/workspace-state.json`

### Environment Configuration
- `kse env list/switch/info/register/unregister/rollback/verify/run` — Multi-environment management
- Automatic backup before each switch, instant rollback support

### Multi-Repository Management
- `kse repo init [--nested]` — Auto-discover Git repositories
- `kse repo status [--verbose]` — Status of all repositories
- `kse repo exec "<command>"` — Execute command across all repos
- `kse repo health` — Check repository health

### Spec-Level Collaboration
- `kse collab init/status/assign/verify/integrate/migrate` — Coordinate parallel Spec development
- Master Spec + Sub-Specs with dependency management
- Interface contracts for cross-Spec compatibility

### Multi-Agent Parallel Coordination (v1.43.0)
When multiple AI agents work on the same project simultaneously:
- **AgentRegistry** (`lib/collab`) — Agent lifecycle with heartbeat monitoring
- **TaskLockManager** (`lib/lock`) — File-based task mutual exclusion
- **TaskStatusStore** (`lib/task`) — Concurrent-safe tasks.md updates with retry
- **SteeringFileLock** (`lib/lock`) — Steering file write serialization
- **MergeCoordinator** (`lib/collab`) — Git branch isolation per agent
- **Coordinator** (`lib/collab`) — Central task assignment (optional)
- Config: `.kiro/config/multi-agent.json` (`enabled: true` to activate)
- All components are no-ops in single-agent mode (zero overhead)
- See `docs/multi-agent-coordination-guide.md` for full API reference

### Spec-Level Steering & Context Sync (v1.44.0)
Fourth steering layer (L4) and Spec lifecycle coordination for multi-agent scenarios:
- **SpecSteering** (`lib/steering`) — Per-Spec `steering.md` CRUD with template generation, Markdown ↔ structured object roundtrip
- **SteeringLoader** (`lib/steering`) — Unified L1-L4 four-layer steering loader with merged output
- **ContextSyncManager** (`lib/steering`) — Multi-agent CURRENT_CONTEXT.md maintenance with Spec progress table, SteeringFileLock-protected writes
- **SpecLifecycleManager** (`lib/collab`) — Spec state machine (planned → assigned → in-progress → completed → released) with auto-completion detection
- **SyncBarrier** (`lib/collab`) — Agent Spec-switch synchronization barrier (uncommitted changes check, steering reload)
- **Coordinator Integration** — `completeTask` auto-checks Spec completion; `assignTask` runs SyncBarrier
- All components are no-ops in single-agent mode (zero overhead)
- See `docs/multi-agent-coordination-guide.md` for full API reference

### Autonomous Control
- `kse auto create <description>` — Create and execute Spec autonomously
- `kse auto run <spec>` — Execute existing Spec tasks autonomously
- `kse auto status/resume/stop/config` — Manage autonomous execution
- Intelligent error recovery, checkpoint system, learning from history

### Agent Orchestrator — Multi-Agent Spec Execution (v1.45.0)
Automate parallel Spec execution via Codex CLI sub-agents (replaces manual multi-terminal workflow):
- `kse orchestrate run --specs "spec-a,spec-b,spec-c" --max-parallel 3` — Start multi-agent orchestration
- `kse orchestrate status` — View orchestration progress (per-Spec status, overall state)
- `kse orchestrate stop` — Gracefully stop all sub-agents
- **OrchestratorConfig** (`lib/orchestrator`) — Configuration management (Codex command, parallelism, timeout, retries) via `.kiro/config/orchestrator.json`
- **BootstrapPromptBuilder** (`lib/orchestrator`) — Builds bootstrap prompts with Spec path, steering context, execution instructions
- **AgentSpawner** (`lib/orchestrator`) — Process manager for Codex CLI sub-agents with timeout detection, graceful termination (SIGTERM → SIGKILL)
- **StatusMonitor** (`lib/orchestrator`) — Codex JSON Lines event parsing, per-Spec status tracking, orchestration-level aggregation
- **OrchestrationEngine** (`lib/orchestrator`) — DAG-based dependency analysis, batch scheduling, parallel execution (≤ maxParallel), failure propagation, retry mechanism
- Prerequisites: Codex CLI installed, `CODEX_API_KEY` environment variable set
- Recommended config:
```json
{
  "agentBackend": "codex",
  "codexCommand": "npx @openai/codex",
  "codexArgs": ["--skip-git-repo-check"]
}
```
- 11 correctness properties verified via property-based testing

### Scene Runtime (Template Engine + Quality + ERP)
- **Template Engine**: `kse scene template-validate/resolve/render` — Variable schema, multi-file rendering, 3-layer inheritance
- **Package Registry**: `kse scene publish/unpublish/install/list/search/info/diff/version` — Local package management
- **Quality Pipeline**: `kse scene lint/score/contribute` — 10-category lint, quality scoring, one-stop publish
- **Ontology**: `kse scene ontology show/deps/validate/actions/lineage/agent-info` — Semantic relationship graph
- **Moqui ERP**: `kse scene connect/discover/extract` — ERP integration and template extraction
- **Registry Ops**: `kse scene deprecate/audit/owner/tag/lock/stats` — Advanced registry management

### Document Governance
- `kse docs diagnose/cleanup/validate/archive/hooks` — Document lifecycle management
- Automatic compliance checking and cleanup

### DevOps Integration
- `kse ops init/validate/audit/takeover/feedback` — Operations Spec management
- Progressive AI autonomy levels (L1-L5)

### Knowledge Management
- `kse knowledge init/add/list/search/show/delete/stats` — Personal knowledge base

---

## 📋 Development Workflow

### When User Asks You to Implement a Feature

**Step 1: Check if Spec exists**
```
Look in .kiro/specs/ directory
```

**Step 2: If Spec exists**
- Read `requirements.md` - understand what to build
- Read `design.md` - understand how to build it
- Read `tasks.md` - see implementation steps
- Implement according to the Spec
- Update task status as you complete work

**Step 3: If no Spec exists**
- Suggest creating a Spec first
- Help user define requirements
- Help design the solution
- Break down into tasks
- Then implement

### When Working in Multi-Agent Mode

If `.kiro/config/multi-agent.json` exists with `enabled: true`:
1. Register with AgentRegistry before starting work
2. Acquire task locks before modifying any task
3. Use TaskStatusStore for concurrent-safe tasks.md updates
4. Use SteeringFileLock when updating steering files
5. Deregister when done (auto-releases all locks)

---

## 📁 Project Structure

```
.kiro/
├── README.md                  # This file - project development guide
├── specs/                     # All Specs live here
│   └── {spec-name}/           # Individual Spec
│       ├── requirements.md    # What we're building
│       ├── design.md          # How we'll build it
│       ├── tasks.md           # Implementation steps
│       ├── steering.md        # Spec-level steering (L4, multi-agent)
│       ├── lifecycle.json     # Spec lifecycle state (multi-agent)
│       └── locks/             # Task lock files (multi-agent)
├── steering/                  # Development rules (auto-loaded by AI)
│   ├── CORE_PRINCIPLES.md     # Core development principles
│   ├── ENVIRONMENT.md         # Project environment
│   ├── CURRENT_CONTEXT.md     # Current work context
│   └── RULES_GUIDE.md         # Rules index
├── config/                    # Configuration files
│   ├── multi-agent.json       # Multi-agent coordination config
│   ├── agent-registry.json    # Active agent registry
│   └── coordination-log.json  # Coordinator assignment log
└── tools/                     # Tool configurations
```

**Key files:**
- `.kiro/steering/CORE_PRINCIPLES.md` - Development principles for this project
- `.kiro/steering/CURRENT_CONTEXT.md` - What we're currently working on
- `.kiro/specs/{spec-name}/` - Feature specifications

---

## 📖 What is a Spec?

A Spec is a complete feature definition with three parts:

### 1. requirements.md - WHAT we're building
- User stories, functional requirements, acceptance criteria

### 2. design.md - HOW we'll build it
- Architecture, component design, API design, technology choices

### 3. tasks.md - Implementation steps
- Ordered task list with dependencies and implementation notes
- Status: `- [ ]` Not started | `- [-]` In progress | `- [x]` Completed

---

## 💡 Working with This Project

### DO:
- ✅ Check for existing Specs before starting work
- ✅ Follow requirements and design in Specs
- ✅ Update task status as you work
- ✅ Read steering rules for project-specific guidelines
- ✅ Use task locks in multi-agent mode
- ✅ Run tests before marking tasks complete

### DON'T:
- ❌ Start implementing without understanding requirements
- ❌ Ignore the design document
- ❌ Create files in wrong locations (use Spec directories)
- ❌ Skip updating task status
- ❌ Modify tasks.md without locks in multi-agent mode

---

## 🔍 Finding Information

| Need | Where |
|------|-------|
| Feature requirements | `.kiro/specs/{spec-name}/requirements.md` |
| Implementation design | `.kiro/specs/{spec-name}/design.md` |
| What to work on | `.kiro/specs/{spec-name}/tasks.md` |
| Project context | `.kiro/steering/CURRENT_CONTEXT.md` |
| Development rules | `.kiro/steering/CORE_PRINCIPLES.md` |
| Project status | `kse status` |
| Multi-agent setup | `.kiro/config/multi-agent.json` |
| Full documentation | `docs/` directory |

---

**Project Type**: Spec-driven development  
**kse Version**: 1.45.13  
**Last Updated**: 2026-02-13  
**Purpose**: Guide AI tools to work effectively with this project
