# Command Reference

> Quick reference for all kse commands

**Version**: 1.19.0  
**Last Updated**: 2026-01-31

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

### Environment Management

```bash
# List all environments
kse env list

# Switch to environment (with automatic backup)
kse env switch <name>

# Show active environment details
kse env info

# Register new environment from config file
kse env register <config-file>

# Remove environment (requires --force)
kse env unregister <name> --force

# Rollback to previous environment
kse env rollback

# Verify current environment (optional)
kse env verify

# Run command in environment context (optional)
kse env run "<command>"
```

### Multi-Repository Management

```bash
# Initialize repository configuration
kse repo init [--force] [--depth <n>]

# Show status of all repositories
kse repo status [--verbose] [--json]

# Execute command in all repositories
kse repo exec "<command>" [--dry-run]

# Check repository health
kse repo health [--json]
```

### Scene Template Engine

```bash
# Validate template variable schema in a scene package
kse scene template-validate --package <path>
kse scene template-validate --package ./my-package --json

# Resolve inheritance chain and display merged variable schema
kse scene template-resolve --package <name>
kse scene template-resolve --package scene-erp-inventory --json

# Render template package with variable substitution
kse scene template-render --package <name> --values <json-or-path> --out <dir>
kse scene template-render --package scene-erp --values '{"entity_name":"Order"}' --out ./output --json
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

### Managing Multiple Environments

```bash
# 1. Register your environments
kse env register config/dev.json
kse env register config/staging.json
kse env register config/prod.json

# 2. List all environments
kse env list

# 3. Switch to development environment
kse env switch development

# 4. Check current environment
kse env info

# 5. Verify environment is configured correctly
kse env verify

# 6. Run commands in environment context
kse env run "npm test"

# 7. Switch to staging for testing
kse env switch staging

# 8. Rollback if something goes wrong
kse env rollback
```

---

## Tips

1. **Use `kse` not `kiro-spec-engine`** - Shorter and easier to type
2. **Add `--help` to any command** - Get detailed usage information
3. **Use tab completion** - Most shells support command completion
4. **Check `kse doctor`** - Diagnose issues quickly
5. **Use watch mode** - Automate repetitive tasks
6. **Use workspace management** - Easily switch between multiple kse projects
7. **Use environment management** - Manage dev, test, staging, prod configurations with automatic backup
8. **Use multi-repo management** - Coordinate operations across multiple Git repositories

---

## Detailed Command Documentation

### Multi-Repository Management Commands

#### `kse repo init`

Initialize repository configuration by scanning the project directory for Git repositories.

**Usage:**
```bash
kse repo init [options]
```

**Options:**
- `--force` - Overwrite existing configuration without confirmation
- `--depth <n>` - Maximum directory depth to scan (default: 3)

**Behavior:**
- Scans project directory recursively for Git repositories
- Excludes `.kiro` directory from scanning
- Extracts remote URL from `origin` remote (or first available remote)
- Detects current branch for each repository
- Prompts for confirmation if configuration already exists (unless `--force`)
- Creates `.kiro/project-repos.json` configuration file

**Example:**
```bash
# Initialize with default settings
kse repo init

# Force overwrite without confirmation
kse repo init --force

# Scan deeper directory structure
kse repo init --depth 5
```

**Output:**
```
Scanning for Git repositories...
Found 3 repositories:
  ✓ frontend (main) - https://github.com/user/frontend.git
  ✓ backend (develop) - https://github.com/user/backend.git
  ✓ shared (main) - https://github.com/user/shared.git

Configuration saved to .kiro/project-repos.json
```

---

#### `kse repo status`

Display the Git status of all configured repositories.

**Usage:**
```bash
kse repo status [options]
```

**Options:**
- `--verbose` - Show detailed file-level changes
- `--json` - Output in JSON format for scripting

**Output includes:**
- Current branch name
- Number of modified, added, and deleted files
- Commits ahead/behind remote
- Clean/dirty status indicator
- Error status for inaccessible repositories

**Example:**
```bash
# Basic status
kse repo status

# Detailed status with file changes
kse repo status --verbose

# JSON output for automation
kse repo status --json
```

**Output:**
```
┌──────────┬─────────┬────────┬──────────┬───────┬────────┐
│ Name     │ Branch  │ Status │ Modified │ Ahead │ Behind │
├──────────┼─────────┼────────┼──────────┼───────┼────────┤
│ frontend │ main    │ Clean  │ 0        │ 0     │ 0      │
│ backend  │ develop │ Dirty  │ 3        │ 2     │ 0      │
│ shared   │ main    │ Clean  │ 0        │ 0     │ 1      │
└──────────┴─────────┴────────┴──────────┴───────┴────────┘
```

---

#### `kse repo exec`

Execute a Git command in all configured repositories.

**Usage:**
```bash
kse repo exec "<command>" [options]
```

**Options:**
- `--dry-run` - Show commands without executing them
- `--continue-on-error` - Continue even if commands fail (default: true)

**Behavior:**
- Executes command sequentially in each repository
- Displays output for each repository with clear separators
- Continues with remaining repositories if one fails
- Shows summary of successes and failures at the end

**Example:**
```bash
# Pull latest changes
kse repo exec "git pull"

# Create and checkout new branch
kse repo exec "git checkout -b feature/new-feature"

# Preview without executing
kse repo exec "git push" --dry-run

# Fetch all remotes
kse repo exec "git fetch --all"

# Show commit history
kse repo exec "git log --oneline -5"
```

**Output:**
```
=== frontend ===
Already up to date.

=== backend ===
Updating abc123..def456
Fast-forward
 src/api.js | 10 +++++-----
 1 file changed, 5 insertions(+), 5 deletions(-)

=== shared ===
Already up to date.

Summary: 3 succeeded, 0 failed
```

---

#### `kse repo health`

Perform health checks on all configured repositories.

**Usage:**
```bash
kse repo health [options]
```

**Options:**
- `--json` - Output in JSON format for automation

**Checks performed:**
- Path exists and is accessible
- Directory is a valid Git repository
- Remote URL is reachable (network check)
- Default branch exists

**Example:**
```bash
# Run health check
kse repo health

# JSON output for CI/CD
kse repo health --json
```

**Output:**
```
┌──────────┬──────────────┬────────────┬──────────────────┬───────────────┐
│ Name     │ Path Exists  │ Git Repo   │ Remote Reachable │ Branch Exists │
├──────────┼──────────────┼────────────┼──────────────────┼───────────────┤
│ frontend │ ✓            │ ✓          │ ✓                │ ✓             │
│ backend  │ ✓            │ ✓          │ ✓                │ ✓             │
│ shared   │ ✓            │ ✓          │ ✗                │ ✓             │
└──────────┴──────────────┴────────────┴──────────────────┴───────────────┘

Overall Health: 2 healthy, 1 unhealthy
```

---

## See Also

- [Multi-Repository Management Guide](./multi-repo-management-guide.md)
- [Environment Management Guide](./environment-management-guide.md)
- [Manual Workflows Guide](./manual-workflows-guide.md)
- [Cross-Tool Guide](./cross-tool-guide.md)
- [Adoption Guide](./adoption-guide.md)
- [Developer Guide](./developer-guide.md)

---

**Need Help?**
- Run `kse --help` for command reference
- Check [GitHub Issues](https://github.com/heguangyong/kiro-spec-engine/issues)
- Review [Documentation](../README.md)
