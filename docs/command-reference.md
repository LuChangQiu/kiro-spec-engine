# Command Reference

> Quick reference for all kse commands

**Version**: 1.11.2  
**Last Updated**: 2026-01-29

---

## Command Naming

The package provides two command aliases:
- `kse` - **Recommended short alias** (use this in all documentation)
- `kiro-spec-engine` - Full command name (legacy, not recommended)

**Always use `kse` in examples and documentation for consistency.**

---

## Installation

```bash
npm install -g kiro-spec-engine
```

This creates the `kse` command globally.

---

## Core Commands

### Project Setup

```bash
# Initialize new project
kse init [project-name]

# Adopt existing project
kse adopt

# Check project status
kse status

# Run system diagnostics
kse doctor
```

### Spec Management

```bash
# Create new spec (interactive)
kse create-spec

# Create spec with name
kse create-spec 01-00-feature-name

# List all specs
kse list-specs
```

### Task Management

```bash
# Claim a task
kse task claim <spec-name> <task-id>

# Unclaim a task
kse task unclaim <spec-name> <task-id>

# Show task status
kse task status <spec-name>
```

### Context & Prompts

```bash
# Export spec context
kse context export <spec-name>

# Export with steering rules
kse context export <spec-name> --steering

# Generate task prompt
kse prompt generate <spec-name> <task-id>

# Generate for specific tool
kse prompt generate <spec-name> <task-id> --tool=claude-code
```

### Watch Mode

```bash
# Initialize watch configuration
kse watch init

# Start watch mode
kse watch start

# Stop watch mode
kse watch stop

# Check watch status
kse watch status

# View watch logs
kse watch logs

# Show automation metrics
kse watch metrics

# List available presets
kse watch presets

# Install a preset
kse watch install <preset-name>
```

### Workflows

```bash
# List available workflows
kse workflows

# Show workflow details
kse workflows show <workflow-name>

# Open workflow guide
kse workflows guide

# Mark workflow as complete
kse workflows complete <workflow-name>
```

### Workspace Management

```bash
# Create a new workspace
kse workspace create <name> [path]

# List all workspaces
kse workspace list

# Switch active workspace
kse workspace switch <name>

# Show workspace info
kse workspace info [name]

# Remove a workspace
kse workspace remove <name> [--force]

# Legacy commands (still supported)
kse workspace sync
kse workspace team
```

### Version & Upgrade

```bash
# Show version info
kse version-info

# Check for upgrades
kse upgrade check

# Perform upgrade
kse upgrade
```

---

## Global Options

```bash
# Set language
kse --lang zh <command>
kse --lang en <command>

# Show help
kse --help
kse <command> --help

# Show version
kse --version
```

---

## Common Workflows

### Starting a New Feature

```bash
# 1. Create spec
kse create-spec 01-00-my-feature

# 2. Export context
kse context export 01-00-my-feature

# 3. Work on tasks...

# 4. Sync progress
kse workspace sync
```

### Managing Multiple Projects

```bash
# 1. Register your projects as workspaces
kse workspace create project-a ~/projects/project-a
kse workspace create project-b ~/projects/project-b

# 2. List all workspaces
kse workspace list

# 3. Switch between projects
kse workspace switch project-a

# 4. Check current workspace
kse workspace info

# 5. Work on the active project...

# 6. Switch to another project
kse workspace switch project-b
```

### Setting Up Automation

```bash
# 1. Initialize watch mode
kse watch init

# 2. Install presets
kse watch install auto-sync
kse watch install test-runner

# 3. Start watching
kse watch start

# 4. Check status
kse watch status
```

### Working with Team

```bash
# 1. Check team status
kse workspace team

# 2. Claim a task
kse task claim 01-00-feature 1.1

# 3. Work on task...

# 4. Sync when done
kse workspace sync
```

---

## Tips

1. **Use `kse` not `kiro-spec-engine`** - Shorter and easier to type
2. **Add `--help` to any command** - Get detailed usage information
3. **Use tab completion** - Most shells support command completion
4. **Check `kse doctor`** - Diagnose issues quickly
5. **Use watch mode** - Automate repetitive tasks
6. **Use workspace management** - Easily switch between multiple kse projects

---

## See Also

- [Manual Workflows Guide](./manual-workflows-guide.md)
- [Cross-Tool Guide](./cross-tool-guide.md)
- [Adoption Guide](./adoption-guide.md)
- [Developer Guide](./developer-guide.md)

---

**Need Help?**
- Run `kse --help` for command reference
- Check [GitHub Issues](https://github.com/heguangyong/kiro-spec-engine/issues)
- Review [Documentation](../README.md)
