# kse Documentation Index

> Complete guide to kse (Kiro Spec Engine)

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11

---

## 🚀 Getting Started

**New to kse?** Start here:

- **[Quick Start Guide](quick-start.md)** - Get up and running in 5 minutes
- **[FAQ](faq.md)** - Frequently asked questions
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

---

## 📖 Core Concepts

Understand how kse works:

- **[Spec Workflow](spec-workflow.md)** - Understanding the Spec-driven development process
- **[Integration Modes](integration-modes.md)** - Three ways to integrate kse with AI tools
- **[Command Reference](command-reference.md)** - Complete list of all kse commands

---

## 🛠️ Tool-Specific Guides

Choose your AI tool and learn how to integrate:

### Native Integration
- **[Kiro IDE Guide](tools/kiro-guide.md)** - Fully automatic integration

### Manual Export Integration
- **[Cursor Guide](tools/cursor-guide.md)** - Using kse with Cursor IDE
- **[Claude Code Guide](tools/claude-guide.md)** - Using kse with Claude Code
- **[VS Code + Copilot Guide](tools/vscode-guide.md)** - Using kse with VS Code and GitHub Copilot

### Watch Mode Integration
- **[Windsurf Guide](tools/windsurf-guide.md)** - Using kse with Windsurf (supports watch mode)

### Universal Integration
- **[Generic AI Tools Guide](tools/generic-guide.md)** - Using kse with any AI tool

---

## 📚 Examples

Learn by example with complete Spec demonstrations:

### API Development
- **[REST API Example](examples/add-rest-api/)** - Complete RESTful API with authentication
  - Requirements, design, and tasks for a task management API
  - JWT authentication, CRUD operations, error handling
  - Node.js + Express + PostgreSQL

### UI Development
- **[User Dashboard Example](examples/add-user-dashboard/)** - React dashboard with data visualization
  - Component hierarchy, state management, API integration
  - Responsive design, charts, loading states
  - React + Recharts

### CLI Development
- **[Export Command Example](examples/add-export-command/)** - Adding a new CLI command
  - Command structure, argument parsing, file I/O
  - Multiple output formats (JSON, Markdown, HTML)
  - Node.js + Commander.js

---

## 🔧 Reference

Detailed technical documentation:

- **[Command Reference](command-reference.md)** - All kse commands with examples
- **[Environment Management Guide](environment-management-guide.md)** - Multi-environment configuration management
- **[Multi-Repository Management Guide](multi-repo-management-guide.md)** - Managing multiple Git repositories
- **[Scene Runtime Guide](scene-runtime-guide.md)** - Scene template engine, quality pipeline, ontology, and Moqui ERP integration
- **[Troubleshooting](troubleshooting.md)** - Solutions to common problems
- **[FAQ](faq.md)** - Answers to frequently asked questions

---

## 📋 Additional Guides

- **[Adoption Guide](adoption-guide.md)** - Adopting kse in existing projects
- **[Upgrade Guide](upgrade-guide.md)** - Upgrading kse to newer versions
- **[Environment Management Guide](environment-management-guide.md)** - Managing multiple environments
- **[Multi-Repository Management Guide](multi-repo-management-guide.md)** - Managing multiple Git repositories
- **[Scene Runtime Guide](scene-runtime-guide.md)** - Scene template engine, quality pipeline, ontology, and Moqui ERP integration
- **[Developer Guide](developer-guide.md)** - Contributing to kse development
- **[Architecture](architecture.md)** - kse system architecture

---

## 🌍 Language

- **English** - You are here
- **[中文 (Chinese)](zh/README.md)** - Chinese documentation

---

## 📊 Documentation by Audience

### For Beginners
1. [Quick Start Guide](quick-start.md) - Start here!
2. [FAQ](faq.md) - Common questions
3. [Tool-Specific Guide](tools/) - Pick your AI tool
4. [Examples](examples/) - Learn by example

### For Intermediate Users
1. [Spec Workflow](spec-workflow.md) - Deep dive into Specs
2. [Integration Modes](integration-modes.md) - Choose the right mode
3. [Command Reference](command-reference.md) - Master all commands
4. [Troubleshooting](troubleshooting.md) - Solve problems

### For Advanced Users
1. [Developer Guide](developer-guide.md) - Contribute to kse
2. [Architecture](architecture.md) - Understand internals
3. [Manual Workflows Guide](manual-workflows-guide.md) - Advanced workflows

---

## 📊 Documentation by Task

### Setting Up
- [Quick Start Guide](quick-start.md) - First-time setup
- [Adoption Guide](adoption-guide.md) - Add to existing project
- [Tool-Specific Guides](tools/) - Configure your AI tool

### Creating Specs
- [Spec Workflow](spec-workflow.md) - How to create Specs
- [Examples](examples/) - See complete examples
- [Quick Start Guide](quick-start.md) - Your first Spec

### Using with AI Tools
- [Integration Modes](integration-modes.md) - Choose integration mode
- [Tool-Specific Guides](tools/) - Tool-specific instructions
- [Command Reference](command-reference.md) - Export context commands

### Troubleshooting
- [Troubleshooting](troubleshooting.md) - Common issues
- [FAQ](faq.md) - Quick answers
- [GitHub Issues](https://github.com/kiro-spec-engine/kse/issues) - Report bugs

---

## 🎯 Quick Links by Feature

### Spec Management
- [Creating Specs](spec-workflow.md#stage-1-requirements)
- [Spec Structure](spec-workflow.md#the-spec-creation-workflow)
- [Example Specs](examples/)

### Environment Management
- [Environment Management Guide](environment-management-guide.md)
- [Environment Commands](command-reference.md#environment-management)
- [Multi-Environment Workflow](environment-management-guide.md#common-workflows)

### Multi-Repository Management
- [Multi-Repository Management Guide](multi-repo-management-guide.md)
- [Repository Commands](command-reference.md#multi-repository-management)
- [Multi-Repo Workflows](multi-repo-management-guide.md#common-workflows)

### Scene Runtime
- [Scene Runtime Guide](scene-runtime-guide.md)
- [Scene Template Engine](command-reference.md#scene-template-engine)
- [Scene Quality Pipeline](command-reference.md#scene-template-quality-pipeline)
- [Scene Ontology](command-reference.md#scene-ontology-enhancement)
- [Moqui ERP Integration](command-reference.md#moqui-erp-integration)

### Context Export
- [Manual Export Mode](integration-modes.md#mode-2-manual-export)
- [Export Commands](command-reference.md#context--prompts)
- [Using Exported Context](tools/)

### Watch Mode
- [Watch Mode Guide](integration-modes.md#mode-3-watch-mode)
- [Watch Commands](command-reference.md#watch-mode)
- [Windsurf Integration](tools/windsurf-guide.md)

### Task Management
- [Task Commands](command-reference.md#task-management)
- [Task Workflow](spec-workflow.md#stage-3-tasks)
- [Team Collaboration](workspace-info.md)

---

## 💡 Tips for Using This Documentation

**Finding Information:**
- Use your browser's search (Ctrl+F / Cmd+F) to find specific topics
- Check the [FAQ](faq.md) first for quick answers
- Browse [Examples](examples/) to learn by doing

**Learning Path:**
1. **Day 1:** [Quick Start Guide](quick-start.md) + [Your Tool Guide](tools/)
2. **Week 1:** [Spec Workflow](spec-workflow.md) + [Examples](examples/)
3. **Month 1:** [Integration Modes](integration-modes.md) + [Advanced Features](command-reference.md)

**Getting Help:**
- **Quick answers:** [FAQ](faq.md)
- **Problems:** [Troubleshooting](troubleshooting.md)
- **Community:** [GitHub Discussions](https://github.com/kiro-spec-engine/kse/discussions)
- **Bugs:** [GitHub Issues](https://github.com/kiro-spec-engine/kse/issues)

---

## 📝 Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Quick Start | ✅ Complete | 2026-01-23 |
| Spec Workflow | ✅ Complete | 2026-01-23 |
| Integration Modes | ✅ Complete | 2026-01-23 |
| Tool Guides (6) | ✅ Complete | 2026-01-23 |
| Examples (3) | ✅ Complete | 2026-01-23 |
| FAQ | ✅ Complete | 2026-02-11 |
| Troubleshooting | ✅ Complete | 2026-01-23 |
| Command Reference | ✅ Complete | 2026-02-11 |
| Environment Management | ✅ Complete | 2026-01-31 |
| Multi-Repository Management | ✅ Complete | 2026-01-31 |
| Scene Runtime Guide | ✅ Complete | 2026-02-11 |

---

## 🤝 Contributing to Documentation

Found an error? Want to improve the docs?

1. **Report issues:** [GitHub Issues](https://github.com/kiro-spec-engine/kse/issues)
2. **Suggest improvements:** [GitHub Discussions](https://github.com/kiro-spec-engine/kse/discussions)
3. **Submit changes:** [Contributing Guide](../CONTRIBUTING.md)

---

## 📄 License

Documentation is licensed under [MIT License](../LICENSE).

---

**Happy Spec-ing!** 🚀

