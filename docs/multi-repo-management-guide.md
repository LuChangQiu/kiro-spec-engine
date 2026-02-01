# Multi-Repository Management Guide

## Overview

The Multi-Repository Management feature enables you to manage multiple Git subrepositories within a single project through a unified command-line interface. This is particularly useful for projects that consist of multiple independent repositories (e.g., frontend, backend, shared libraries) that need to be coordinated together.

## Quick Start

### 1. Initialize Repository Configuration

Navigate to your project root and run:

```bash
kse repo init
```

This command:
- Scans your project directory for Git repositories
- Extracts remote URLs and current branches
- Creates `.kiro/project-repos.json` configuration file
- Excludes the `.kiro` directory from scanning

**Example output:**
```
Scanning for Git repositories...
Found 3 repositories:
  ✓ frontend (main) - https://github.com/user/frontend.git
  ✓ backend (develop) - https://github.com/user/backend.git
  ✓ shared (main) - https://github.com/user/shared.git

Configuration saved to .kiro/project-repos.json
```

### 2. Check Repository Status

View the status of all repositories at once:

```bash
kse repo status
```

**Example output:**
```
┌──────────┬─────────┬────────┬──────────┬───────┬────────┐
│ Name     │ Branch  │ Status │ Modified │ Ahead │ Behind │
├──────────┼─────────┼────────┼──────────┼───────┼────────┤
│ frontend │ main    │ Clean  │ 0        │ 0     │ 0      │
│ backend  │ develop │ Dirty  │ 3        │ 2     │ 0      │
│ shared   │ main    │ Clean  │ 0        │ 0     │ 1      │
└──────────┴─────────┴────────┴──────────┴───────┴────────┘
```

For detailed file-level changes:

```bash
kse repo status --verbose
```

### 3. Execute Commands Across Repositories

Run the same Git command in all repositories:

```bash
kse repo exec "git pull"
```

**Example output:**
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

Preview commands without executing (dry-run):

```bash
kse repo exec "git pull" --dry-run
```

### 4. Health Check

Verify that all repositories are properly configured:

```bash
kse repo health
```

**Example output:**
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

## Configuration File Format

The configuration is stored in `.kiro/project-repos.json`:

```json
{
  "version": "1.0",
  "repositories": [
    {
      "name": "frontend",
      "path": "packages/frontend",
      "remote": "https://github.com/user/frontend.git",
      "defaultBranch": "main",
      "description": "React frontend application",
      "tags": ["ui", "react"],
      "group": "client"
    },
    {
      "name": "backend",
      "path": "packages/backend",
      "remote": "https://github.com/user/backend.git",
      "defaultBranch": "develop",
      "description": "Node.js API server",
      "tags": ["api", "nodejs"],
      "group": "server"
    }
  ],
  "groups": {
    "client": {
      "description": "Client-side applications",
      "color": "blue"
    },
    "server": {
      "description": "Server-side services",
      "color": "green"
    }
  },
  "settings": {
    "defaultRemote": "origin",
    "scanDepth": 3
  }
}
```

### Configuration Fields

#### Required Fields

- **name**: Unique identifier for the repository (alphanumeric, hyphens, underscores)
- **path**: Relative or absolute path to the repository
- **remote**: Git remote URL (can be `null` for local-only repos)
- **defaultBranch**: Default branch name (e.g., "main", "develop")

#### Optional Fields

- **description**: Human-readable description of the repository
- **tags**: Array of tags for categorization and filtering
- **group**: Group name for logical organization

#### Global Settings

- **version**: Configuration format version (currently "1.0")
- **groups**: Group definitions with descriptions and colors
- **settings**: Global settings like default remote name and scan depth

### Path Resolution

Paths can be specified as:

- **Relative paths**: Resolved relative to project root
  ```json
  "path": "packages/frontend"
  ```

- **Absolute paths**: Used as-is
  ```json
  "path": "/home/user/projects/frontend"
  ```

- **Cross-platform**: Paths are normalized to use forward slashes internally
  ```json
  "path": "packages\\frontend"  // Windows
  "path": "packages/frontend"   // Unix/Mac
  ```

## Commands

### `kse repo init`

Initialize repository configuration by scanning the project directory.

**Usage:**
```bash
kse repo init [options]
```

**Options:**
- `--force`: Overwrite existing configuration without confirmation
- `--depth <n>`: Maximum directory depth to scan (default: 3)

**Behavior:**
- Scans project directory recursively for Git repositories
- Excludes `.kiro` directory
- Extracts remote URL from `origin` remote (or first available remote)
- Detects current branch
- Prompts for confirmation if configuration already exists

**Example:**
```bash
# Initialize with default settings
kse repo init

# Force overwrite without confirmation
kse repo init --force

# Scan deeper directory structure
kse repo init --depth 5
```

### `kse repo status`

Display the Git status of all repositories.

**Usage:**
```bash
kse repo status [options]
```

**Options:**
- `--verbose`: Show detailed file-level changes
- `--json`: Output in JSON format

**Output includes:**
- Current branch name
- Number of modified, added, and deleted files
- Commits ahead/behind remote
- Clean/dirty status
- Error status for inaccessible repositories

**Example:**
```bash
# Basic status
kse repo status

# Detailed status with file changes
kse repo status --verbose

# JSON output for scripting
kse repo status --json
```

### `kse repo exec`

Execute a Git command in all repositories.

**Usage:**
```bash
kse repo exec "<command>" [options]
```

**Options:**
- `--dry-run`: Show commands without executing
- `--continue-on-error`: Continue even if commands fail (default: true)

**Behavior:**
- Executes command sequentially in each repository
- Displays output for each repository with clear separators
- Continues with remaining repositories if one fails
- Shows summary of successes and failures

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

### `kse repo health`

Perform health checks on all repositories.

**Usage:**
```bash
kse repo health [options]
```

**Options:**
- `--json`: Output in JSON format

**Checks performed:**
- Path exists and is accessible
- Directory is a valid Git repository
- Remote URL is reachable (network check)
- Default branch exists

**Output:**
- Individual check results for each repository
- Specific error messages for failures
- Overall health summary

**Example:**
```bash
# Run health check
kse repo health

# JSON output for automation
kse repo health --json
```

## Common Workflows

### Workflow 1: Daily Development Sync

Start your day by syncing all repositories:

```bash
# Check status of all repos
kse repo status

# Pull latest changes
kse repo exec "git pull"

# Verify everything is healthy
kse repo health
```

### Workflow 2: Feature Branch Creation

Create a feature branch across all repositories:

```bash
# Create and checkout feature branch
kse repo exec "git checkout -b feature/user-authentication"

# Verify all repos are on the new branch
kse repo status
```

### Workflow 3: Release Preparation

Prepare all repositories for a release:

```bash
# Ensure all repos are clean
kse repo status

# Pull latest changes
kse repo exec "git pull"

# Create release branch
kse repo exec "git checkout -b release/v1.2.0"

# Tag the release
kse repo exec "git tag -a v1.2.0 -m 'Release v1.2.0'"

# Push branches and tags
kse repo exec "git push origin release/v1.2.0"
kse repo exec "git push --tags"
```

### Workflow 4: Troubleshooting

Diagnose issues across repositories:

```bash
# Run health check
kse repo health

# Check detailed status
kse repo status --verbose

# Verify remote connectivity
kse repo exec "git remote -v"

# Check for uncommitted changes
kse repo exec "git status --short"
```

### Workflow 5: Bulk Updates

Update dependencies or configuration across all repos:

```bash
# Update npm dependencies
kse repo exec "npm update"

# Run tests
kse repo exec "npm test"

# Commit changes
kse repo exec "git add ."
kse repo exec "git commit -m 'chore: update dependencies'"

# Push changes
kse repo exec "git push"
```

## Manual Configuration

You can manually edit `.kiro/project-repos.json` to:

### Add a Repository

```json
{
  "repositories": [
    {
      "name": "new-service",
      "path": "services/new-service",
      "remote": "https://github.com/user/new-service.git",
      "defaultBranch": "main",
      "description": "New microservice",
      "tags": ["service", "api"],
      "group": "server"
    }
  ]
}
```

### Organize with Groups

```json
{
  "groups": {
    "frontend": {
      "description": "Frontend applications",
      "color": "blue"
    },
    "backend": {
      "description": "Backend services",
      "color": "green"
    },
    "infrastructure": {
      "description": "Infrastructure and DevOps",
      "color": "yellow"
    }
  }
}
```

### Add Metadata

```json
{
  "repositories": [
    {
      "name": "frontend",
      "path": "packages/frontend",
      "remote": "https://github.com/user/frontend.git",
      "defaultBranch": "main",
      "description": "React frontend with TypeScript",
      "tags": ["react", "typescript", "ui"],
      "group": "frontend",
      "metadata": {
        "maintainer": "frontend-team@example.com",
        "ci": "github-actions",
        "deployment": "vercel"
      }
    }
  ]
}
```

## Troubleshooting

### Configuration File Not Found

**Error:**
```
Error: Configuration file not found at .kiro/project-repos.json
```

**Solution:**
Run `kse repo init` to create the configuration file.

### Repository Path Not Found

**Error:**
```
Error: Repository path does not exist: packages/frontend
```

**Solution:**
1. Verify the path in `.kiro/project-repos.json`
2. Ensure the repository is cloned
3. Update the path if the repository moved

### Remote Not Reachable

**Error:**
```
Warning: Remote not reachable for repository: backend
```

**Solution:**
1. Check network connectivity
2. Verify remote URL: `git remote -v`
3. Check authentication (SSH keys, tokens)
4. Update remote URL if changed

### Invalid Configuration

**Error:**
```
Error: Configuration validation failed:
  - Duplicate repository name: frontend
  - Missing required field: path
```

**Solution:**
1. Open `.kiro/project-repos.json`
2. Fix validation errors
3. Ensure all required fields are present
4. Remove duplicate names

### Git Command Failed

**Error:**
```
Error in backend: fatal: not a git repository
```

**Solution:**
1. Verify the path is a Git repository
2. Run `git init` if needed
3. Check file permissions
4. Run `kse repo health` to diagnose

### Permission Denied

**Error:**
```
Error: Permission denied accessing repository: frontend
```

**Solution:**
1. Check file system permissions
2. Verify you have read/write access
3. Run as appropriate user
4. Check Git credentials

## Best Practices

### 1. Keep Configuration in Version Control

Add `.kiro/project-repos.json` to your main repository:

```bash
git add .kiro/project-repos.json
git commit -m "docs: add multi-repo configuration"
```

### 2. Use Descriptive Names

Choose clear, consistent repository names:

```json
{
  "name": "user-service",        // ✓ Good
  "name": "us",                  // ✗ Too short
  "name": "the-user-service-api" // ✗ Too verbose
}
```

### 3. Organize with Groups

Group related repositories for better organization:

```json
{
  "groups": {
    "core": { "description": "Core services" },
    "tools": { "description": "Development tools" },
    "docs": { "description": "Documentation" }
  }
}
```

### 4. Add Meaningful Descriptions

Document each repository's purpose:

```json
{
  "name": "auth-service",
  "description": "OAuth2 authentication service with JWT support"
}
```

### 5. Use Tags for Filtering

Tag repositories for easy filtering (future feature):

```json
{
  "tags": ["microservice", "nodejs", "production"]
}
```

### 6. Regular Health Checks

Run health checks regularly:

```bash
# Add to your daily workflow
kse repo health
```

### 7. Dry-Run Before Bulk Operations

Always preview destructive operations:

```bash
# Preview before executing
kse repo exec "git push --force" --dry-run
```

### 8. Document Custom Workflows

Create scripts for common workflows:

```bash
#!/bin/bash
# sync-all.sh - Sync all repositories

echo "Checking status..."
kse repo status

echo "Pulling changes..."
kse repo exec "git pull"

echo "Running health check..."
kse repo health
```

## Advanced Usage

### Scripting with JSON Output

Use JSON output for automation:

```bash
# Get status as JSON
kse repo status --json > status.json

# Parse with jq
kse repo status --json | jq '.[] | select(.isClean == false)'

# Check health in CI/CD
if kse repo health --json | jq -e '.[] | select(.healthy == false)' > /dev/null; then
  echo "Health check failed!"
  exit 1
fi
```

### Integration with CI/CD

Example GitHub Actions workflow:

```yaml
name: Multi-Repo Check

on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install kse
        run: npm install -g kiro-spec-engine
      
      - name: Check repository health
        run: kse repo health
      
      - name: Check repository status
        run: kse repo status
```

### Custom Configuration Validation

Validate configuration before committing:

```bash
# Add to pre-commit hook
#!/bin/bash
if [ -f .kiro/project-repos.json ]; then
  kse repo health || exit 1
fi
```

## Limitations and Future Enhancements

### Current Limitations

- Sequential execution only (no parallel operations)
- No filtering by group or tag
- No support for nested submodules
- Limited to Git repositories

### Planned Enhancements (Phase 2)

- **Parallel Execution**: Execute commands in parallel for faster operations
- **Filtering**: Filter operations by group, tag, or status
- **Branch Management**: Dedicated commands for branch operations
- **Tag Management**: Bulk tag creation and management
- **Reporting**: HTML reports and export to CSV/JSON
- **CI/CD Integration**: Pre-built integrations for popular CI/CD platforms

## Related Documentation

- [Command Reference](command-reference.md) - Complete command documentation
- [Spec Workflow](spec-workflow.md) - Understanding Specs
- [Environment Management](environment-management-guide.md) - Environment configuration
- [Workspace Management](workspace-management-guide.md) - Multi-workspace support

## Support

If you encounter issues or have questions:

- 📖 Check the [Troubleshooting Guide](troubleshooting.md)
- 🐛 Report bugs on [GitHub Issues](https://github.com/heguangyong/kiro-spec-engine/issues)
- 💬 Ask questions in [GitHub Discussions](https://github.com/heguangyong/kiro-spec-engine/discussions)

---

**Version**: 1.19.0  
**Last Updated**: 2026-01-31
