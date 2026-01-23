# kiro-spec-engine

[![npm version](https://badge.fury.io/js/kiro-spec-engine.svg)](https://badge.fury.io/js/kiro-spec-engine)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Kiro Spec Engine** - A spec-driven rules engine with quality enhancement powered by Ultrawork spirit.

> 🔥 Transform your development workflow with structured specs, steering rules, and relentless quality pursuit.

English | [简体中文](README.zh.md)

## 🎯 What is Kiro Spec Engine?

Kiro Spec Engine (KSE) is a **spec-driven rules engine** that brings structure, quality, and the **Ultrawork spirit** to your development process. It's not just a tool—it's a methodology for building software with clarity and excellence.

### Core Concept: Spec-Driven Rules Engine

At its heart, KSE is a **rules engine** that operates on **specs**:

- **Specs** define what you want to build (Requirements → Design → Tasks)
- **Steering rules** guide how AI assistants should help you build it
- **Ultrawork spirit** ensures professional-grade quality at every stage

### Key Features

- ✅ **Spec-Driven Development**: Structured Requirements → Design → Tasks workflow
- ✅ **Steering Rules System**: Control AI behavior with project-specific rules
- ✅ **Quality Assessment**: Automatic document quality scoring (0-10 scale)
- ✅ **Intelligent Enhancement**: Auto-identify and apply improvements with Ultrawork
- ✅ **Professional Standards**: Ensure production-ready documentation
- ✅ **Multi-language Support**: English and Chinese interfaces
- ✅ **CLI Interface**: Easy-to-use command-line tools

## 🚀 Quick Start

### Installation

Install globally via npm:

```bash
npm install -g kiro-spec-engine
```

Or use the short alias:

```bash
npm install -g kiro-spec-engine
# Creates both 'kiro-spec-engine' and 'kse' commands
```

### Initialize a Project

```bash
# Initialize in current directory
kiro-spec-engine init

# Or specify project name
kiro-spec-engine init "My Awesome Project"

# Use Chinese interface
kiro-spec-engine --lang zh init

# Use short alias
kse init
```

### Create and Enhance Your First Spec

```bash
# Create a new spec
kse create-spec 01-00-user-authentication

# Write your basic requirements.md file
# Then enhance it with Ultrawork
kse enhance requirements .kiro/specs/01-00-user-authentication/requirements.md
```

## 📋 Commands

### Project Management

```bash
# Initialize project
kse init [project-name]

# Adopt existing project
kse adopt                    # Interactive adoption
kse adopt --auto             # Skip confirmations
kse adopt --dry-run          # Show what would change
kse adopt --mode fresh       # Force specific mode

# Upgrade project version
kse upgrade                  # Interactive upgrade
kse upgrade --auto           # Skip confirmations
kse upgrade --dry-run        # Show upgrade plan
kse upgrade --to 1.2.0       # Upgrade to specific version

# Rollback to previous state
kse rollback                 # Interactive rollback
kse rollback --auto          # Skip confirmations
kse rollback --backup <id>   # Restore specific backup

# Check project status
kse status

# Create new spec
kse create-spec <spec-name>

# System diagnostics
kse doctor

# Set language
kse --lang zh <command>  # Chinese
kse --lang en <command>  # English (default)
```

### Document Enhancement

```bash
# Enhance requirements document
kse enhance requirements <file>

# Enhance design document (requires requirements file)
kse enhance design <design-file> --requirements <requirements-file>

# Check tasks completion
kse enhance tasks <tasks-file>
```

### Examples

```bash
# Full workflow example
kse init "E-commerce Platform"
kse create-spec 01-00-user-auth
# Edit .kiro/specs/01-00-user-auth/requirements.md
kse enhance requirements .kiro/specs/01-00-user-auth/requirements.md
# Edit .kiro/specs/01-00-user-auth/design.md  
kse enhance design .kiro/specs/01-00-user-auth/design.md --requirements .kiro/specs/01-00-user-auth/requirements.md
```

## 📊 Quality Standards

### Requirements Stage (0-10 scoring)
- **Basic Structure** (2pts): Overview, user stories, functional requirements, non-functional requirements
- **EARS Format** (2pts): WHEN...THEN acceptance criteria
- **User Stories** (2pts): "As a...I want...So that" format
- **Acceptance Criteria** (2pts): Complete acceptance criteria definitions
- **Non-functional Requirements** (1pt): Performance, security, usability, etc.
- **Constraints** (1pt): Technical constraints, resource constraints, etc.

### Design Stage (0-10 scoring)
- **Basic Structure** (2pts): System overview, architecture design, component design, interface design
- **Requirements Traceability** (2pts): Bidirectional traceability from requirements to design
- **Architecture Diagrams** (1.5pts): Mermaid diagrams or other design diagrams
- **Technology Selection** (1.5pts): Technology stack choices and rationale
- **Non-functional Design** (1.5pts): Performance design, security design, scalability
- **Interface Definition** (1.5pts): API design, data structure definitions

### Tasks Stage
- **Completion Analysis**: Statistics on completed, in-progress, not-started tasks
- **Priority Identification**: Identify priorities based on keywords and task numbers
- **Ultrawork Motivation**: Provide Sisyphus spirit motivation and suggestions
- **Next Steps Guidance**: Suggest specific execution strategies

## 🔄 Project Adoption and Upgrade

### Adopting Existing Projects

KSE can intelligently adopt existing projects with three modes:

**Fresh Adoption** (no `.kiro/` directory):
```bash
kse adopt
# Creates complete .kiro/ structure from scratch
```

**Partial Adoption** (`.kiro/` exists but incomplete):
```bash
kse adopt
# Preserves existing specs/ and steering/
# Adds missing components
```

**Full Adoption** (complete `.kiro/` from older version):
```bash
kse adopt
# Upgrades components to current version
# Preserves all user content
# Creates backup before changes
```

### Upgrading to New Versions

When a new version of KSE is released:

```bash
# Check current version
kse --version

# Upgrade to latest version
kse upgrade

# Upgrade to specific version
kse upgrade --to 1.2.0

# Preview upgrade plan
kse upgrade --dry-run
```

**Incremental Upgrades**: KSE automatically handles version gaps by upgrading through intermediate versions (e.g., 1.0.0 → 1.1.0 → 1.2.0).

### Rollback and Safety

All destructive operations create automatic backups:

```bash
# List available backups
kse rollback

# Restore from specific backup
kse rollback --backup adopt-2026-01-23-100000

# Quick rollback (interactive)
kse rollback
```

**Safety Features**:
- ✅ Automatic backup before adoption/upgrade
- ✅ Backup validation and integrity checking
- ✅ Easy rollback to previous states
- ✅ Dry-run mode to preview changes

## 🛠️ Project Structure

After initialization, your project will have:

```
your-project/
├── .kiro/                          # Kiro core directory
│   ├── specs/                      # Spec storage
│   │   └── SPEC_WORKFLOW_GUIDE.md
│   ├── steering/                   # AI behavior rules (the "rules engine")
│   │   ├── CORE_PRINCIPLES.md      # Core principles + Ultrawork spirit
│   │   ├── ENVIRONMENT.md          # Environment configuration
│   │   ├── CURRENT_CONTEXT.md      # Current context
│   │   └── RULES_GUIDE.md          # Rules index
│   ├── tools/                      # Ultrawork tools
│   │   └── ultrawork_enhancer.py   # Core enhancement tool
│   └── README.md                   # Kiro system documentation
└── README.md                       # Project documentation
```

## 🔥 The Ultrawork Spirit

> Inspired by Sisyphus from Greek mythology, who was condemned to push a boulder up a mountain for eternity, only to watch it roll back down each time.

The Ultrawork spirit embodies:

- **Relentless Effort**: Never give up when facing challenges
- **Continuous Improvement**: Always strive for better quality
- **Professional Standards**: Pursue excellence in every detail (9.0/10 target)
- **Persistent Execution**: Keep pushing forward until completion

Ultrawork is the **quality enhancement philosophy** within Kiro Spec Engine—it's what drives the engine to produce professional-grade results.

## 🌍 Multi-language Support

Kiro Spec Engine supports multiple languages out of the box.

### Setting Language

```bash
# Using command line option
kse --lang zh init

# Using environment variable
export KIRO_LANG=zh
kse init

# Windows
set KIRO_LANG=zh
kse init
```

### Supported Languages

- 🇺🇸 English (en) - Default
- 🇨🇳 Simplified Chinese (zh)

The tool automatically detects your system language and uses it by default. You can override this with the `--lang` option or `KIRO_LANG` environment variable.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/yourusername/kiro-spec-engine.git
cd kiro-spec-engine
npm install
npm link  # For local development
```

### Adding New Languages

1. Create a new language file in `locales/` (e.g., `ja.json`)
2. Copy the structure from `en.json` and translate all text
3. Add language detection logic in `lib/i18n.js`
4. Update README documentation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the **Sisyphus** myth and the concept of noble struggle
- Built on the foundation of **Kiro** spec-driven development
- Influenced by **oh-my-opencode** and the Ultrawork Manifesto

---

**Start your spec-driven journey today! 🔥**

```bash
npm install -g kiro-spec-engine
kse init
```
