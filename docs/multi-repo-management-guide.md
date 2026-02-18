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

## Manual Configuration

### Overview

Starting with v1.21.0, you can manually create and edit the `.kiro/project-repos.json` configuration file without relying solely on `kse repo init`. This is useful for:

- Curating a specific list of repositories
- Removing false positives from auto-scan
- Adding repositories that weren't auto-detected
- Creating configurations for repositories that don't exist yet

### Minimal Configuration Format

The simplest valid configuration requires only `name` and `path` for each repository:

```json
{
  "repositories": [
    {
      "name": "my-repo",
      "path": "./my-repo"
    },
    {
      "name": "another-repo",
      "path": "./another-repo"
    }
  ]
}
```

**Key points:**
- The `version` field is optional (defaults to "1.0")
- Only `name` and `path` are required for each repository
- All other fields (`remote`, `defaultBranch`, `description`, `tags`, `group`) are optional

### Complete Configuration Example

For more detailed configurations, you can include all optional fields:

```json
{
  "version": "1.0",
  "repositories": [
    {
      "name": "frontend",
      "path": "./packages/frontend",
      "remote": "https://github.com/user/frontend.git",
      "defaultBranch": "main",
      "description": "React frontend application",
      "tags": ["ui", "react"],
      "group": "client"
    },
    {
      "name": "backend",
      "path": "./packages/backend",
      "remote": "https://github.com/user/backend.git",
      "defaultBranch": "develop",
      "description": "Node.js API server",
      "tags": ["api", "nodejs"],
      "group": "server"
    },
    {
      "name": "local-only",
      "path": "./local-repo"
    }
  ],
  "groups": {
    "client": {
      "description": "Client-side applications"
    },
    "server": {
      "description": "Server-side services"
    }
  }
}
```

### Field Requirements

#### Required Fields
- **name**: Unique identifier for the repository
  - Must contain only alphanumeric characters, hyphens, underscores, and dots
  - Examples: `"frontend"`, `"my-repo"`, `"repo.1"`, `".github"`

- **path**: Path to the repository directory
  - Can be relative (e.g., `"./my-repo"`) or absolute (e.g., `"/home/user/my-repo"`)
  - Must point to an existing directory containing a `.git` directory
  - Cannot point to a Git worktree (`.git` file instead of directory)

#### Optional Fields
- **remote**: Git remote URL (can be omitted for local-only repositories)
- **defaultBranch**: Default branch name (e.g., `"main"`, `"develop"`)
- **description**: Human-readable description
- **tags**: Array of tags for categorization
- **group**: Group name for logical organization
- **parent**: Parent repository path (for nested repositories)

### Validation Rules

When you manually create or edit the configuration, `kse` validates:

1. **File Format**: Must be valid JSON
2. **Structure**: Must have a `repositories` array
3. **Required Fields**: Each repository must have `name` and `path`
4. **Path Existence**: Each path must exist on the filesystem
5. **Git Repository**: Each path must contain a `.git` directory (not file)
6. **No Duplicates**: Repository names and paths must be unique
7. **No Worktrees**: Paths cannot point to Git worktrees

### Creating a Manual Configuration

**Step 1: Create the directory structure**

```bash
mkdir -p .kiro
```

**Step 2: Create the configuration file**

Create `.kiro/project-repos.json` with your repositories:

```json
{
  "repositories": [
    {
      "name": "repo1",
      "path": "./repo1"
    },
    {
      "name": "repo2",
      "path": "./repo2"
    }
  ]
}
```

**Step 3: Verify the configuration**

```bash
kse repo status
```

If there are validation errors, `kse` will display clear error messages:

```
Error: Repository path validation failed
  - Repository "repo1": path "./repo1" does not exist. Please check the path is correct.
  - Repository "repo2": path "./repo2" is not a Git repository (no .git directory found). Please ensure this is a Git repository.
```

### Editing an Existing Configuration

You can manually edit the auto-generated configuration to:

**Remove repositories:**
```json
{
  "repositories": [
    // Remove unwanted entries from this array
    {
      "name": "keep-this",
      "path": "./keep-this"
    }
    // Deleted: { "name": "remove-this", "path": "./remove-this" }
  ]
}
```

**Add new repositories:**
```json
{
  "repositories": [
    {
      "name": "existing-repo",
      "path": "./existing-repo"
    },
    {
      "name": "new-repo",
      "path": "./new-repo"
    }
  ]
}
```

**Simplify to minimal format:**
```json
{
  "repositories": [
    {
      "name": "repo1",
      "path": "./repo1"
      // Removed: remote, defaultBranch, description, tags, group
    }
  ]
}
```

### Troubleshooting

#### Error: "path does not exist"

**Cause**: The specified path doesn't exist on the filesystem.

**Solution**: Check the path is correct and the directory exists:
```bash
ls -la ./my-repo  # Unix/Mac
dir .\my-repo     # Windows
```

#### Error: "is not a Git repository"

**Cause**: The path exists but doesn't contain a `.git` directory.

**Solution**: Initialize the directory as a Git repository:
```bash
cd ./my-repo
git init
```

#### Error: "appears to be a Git worktree"

**Cause**: The path contains a `.git` file instead of a directory (Git worktree).

**Solution**: Use the main repository path instead of the worktree path:
```json
{
  "name": "my-repo",
  "path": "./main-repo"  // Use main repo, not worktree
}
```

#### Error: "Duplicate repository name"

**Cause**: Two repositories have the same name.

**Solution**: Ensure each repository has a unique name:
```json
{
  "repositories": [
    { "name": "repo1", "path": "./path1" },
    { "name": "repo2", "path": "./path2" }  // Changed from "repo1"
  ]
}
```

#### Error: "Configuration file contains invalid JSON"

**Cause**: The JSON syntax is incorrect (missing comma, bracket, etc.).

**Solution**: Validate your JSON using a JSON validator or IDE:
- Check for missing commas between array elements
- Ensure all brackets and braces are properly closed
- Use a JSON formatter to identify syntax errors

## Nested Repository Support

### Overview

Nested repository support allows `kse` to discover and manage Git repositories that are nested inside other Git repositories. This is useful for projects with complex structures where components are organized as independent Git repositories within a parent repository.

**Example structure:**
```
project-root/
├── .git/                    # Parent repository
├── backend/
│   ├── .git/               # Backend repository
│   └── runtime/
│       └── component/
│           ├── HiveMind/
│           │   └── .git/   # Nested component repository
│           ├── mantle-udm/
│           │   └── .git/   # Nested component repository
│           └── MarbleERP/
│               └── .git/   # Nested component repository
└── frontend/
    └── .git/               # Frontend repository
```

### Enabling Nested Scanning

Nested scanning is **enabled by default** in `kse repo init`. To explicitly control this behavior:

```bash
# Enable nested scanning (default)
kse repo init --nested

# Disable nested scanning (stop at first repo)
kse repo init --no-nested
```

### Parent-Child Relationships

When nested repositories are discovered, `kse` tracks the parent-child relationship in the configuration file:

```json
{
  "version": "1.0",
  "repositories": [
    {
      "name": "backend",
      "path": "backend",
      "remote": "https://github.com/user/backend.git",
      "defaultBranch": "main",
      "parent": null
    },
    {
      "name": "HiveMind",
      "path": "backend/runtime/component/HiveMind",
      "remote": "https://github.com/user/HiveMind.git",
      "defaultBranch": "master",
      "parent": "backend"
    },
    {
      "name": "mantle-udm",
      "path": "backend/runtime/component/mantle-udm",
      "remote": "https://github.com/moqui/mantle-udm.git",
      "defaultBranch": "master",
      "parent": "backend"
    }
  ]
}
```

**Key points:**
- Top-level repositories have `parent: null`
- Nested repositories have `parent` set to the path of their parent repository
- The `parent` field is optional for backward compatibility

### Display and Output

When nested repositories are present, commands display the parent-child relationship:

```bash
$ kse repo status

┌────────────┬─────────┬────────┬──────────┬───────┬────────┬─────────┐
│ Name       │ Branch  │ Status │ Modified │ Ahead │ Behind │ Parent  │
├────────────┼─────────┼────────┼──────────┼───────┼────────┼─────────┤
│ backend    │ main    │ Clean  │ 0        │ 0     │ 0      │ -       │
│ HiveMind   │ master  │ Dirty  │ 2        │ 1     │ 0      │ backend │
│ mantle-udm │ master  │ Clean  │ 0        │ 0     │ 0      │ backend │
└────────────┴─────────┴────────┴──────────┴───────┴────────┴─────────┘
```

The **Parent** column shows:
- `-` for top-level repositories
- Parent repository path for nested repositories

### Use Cases

#### 1. Monorepo with Component Repositories

A monorepo that includes independent component repositories:

```
monorepo/
├── .git/                    # Main monorepo
├── packages/
│   ├── core/
│   │   └── .git/           # Core package as separate repo
│   └── plugins/
│       ├── plugin-a/
│       │   └── .git/       # Plugin A as separate repo
│       └── plugin-b/
│           └── .git/       # Plugin B as separate repo
```

**Benefits:**
- Manage all repositories from the monorepo root
- Track status of all components at once
- Execute commands across all components

#### 2. Framework with Runtime Components

A framework that includes runtime components as separate repositories:

```
framework/
├── .git/                    # Framework repository
└── runtime/
    └── component/
        ├── component-a/
        │   └── .git/       # Component A
        ├── component-b/
        │   └── .git/       # Component B
        └── component-c/
            └── .git/       # Component C
```

**Benefits:**
- Components can be developed independently
- Framework and components can have different release cycles
- Easy to update all components at once

#### 3. Multi-Tier Application

An application with frontend, backend, and shared libraries:

```
app/
├── .git/                    # Application repository
├── frontend/
│   └── .git/               # Frontend repository
├── backend/
│   ├── .git/               # Backend repository
│   └── services/
│       ├── auth/
│       │   └── .git/       # Auth service
│       └── api/
│           └── .git/       # API service
└── shared/
    └── .git/               # Shared libraries
```

**Benefits:**
- Each tier can be developed by different teams
- Shared libraries can be versioned independently
- Unified management from application root

### Directory Exclusions

To improve performance and avoid scanning unnecessary directories, `kse` automatically excludes common non-repository directories:

- `node_modules` - Node.js dependencies
- `.git` - Git metadata
- `build`, `dist`, `out` - Build outputs
- `target` - Java/Maven build output
- `.next`, `.nuxt` - Framework build caches
- `vendor` - PHP/Go dependencies

You can add custom exclusions using the `--exclude` option:

```bash
kse repo init --exclude "node_modules,vendor,custom-dir"
```

### Circular Symlink Detection

`kse` automatically detects and skips circular symbolic links to prevent infinite loops during scanning:

```bash
# This structure is handled safely
project/
├── .git/
├── link-to-parent -> ../project  # Circular symlink
└── subdir/
    └── .git/
```

### Performance Considerations

Nested scanning may take longer for large directory structures. To optimize:

1. **Reduce scan depth**: Use `--max-depth` to limit how deep to scan
   ```bash
   kse repo init --max-depth 4
   ```

2. **Exclude directories**: Skip known non-repository directories
   ```bash
   kse repo init --exclude "node_modules,build,dist"
   ```

3. **Disable nested scanning**: If you only need top-level repositories
   ```bash
   kse repo init --no-nested
   ```

### Troubleshooting Nested Repositories

#### Missing Nested Repositories

If nested repositories are not discovered:

1. **Check scan depth**: Increase `--max-depth` if repositories are deeply nested
   ```bash
   kse repo init --max-depth 5
   ```

2. **Verify nested scanning is enabled**: Ensure `--no-nested` is not used
   ```bash
   kse repo init --nested
   ```

3. **Check exclusions**: Ensure the directory is not excluded
   ```bash
   kse repo init --exclude "node_modules"  # Don't exclude the parent directory
   ```

#### Circular Reference Errors

If you see circular reference errors in health checks:

```
Error: Circular parent reference detected: repo-a -> repo-b -> repo-a
```

**Solution:**
1. Open `.kiro/project-repos.json`
2. Check the `parent` fields
3. Remove or fix the circular reference
4. Run `kse repo health` to verify

#### Parent Repository Not Found

If you see parent not found errors:

```
Error: Parent repository not found: backend
```

**Solution:**
1. Ensure the parent repository is in the configuration
2. Check that the `parent` field matches the parent's `path` field exactly
3. Run `kse repo init` to regenerate the configuration

### Backward Compatibility

Nested repository support is fully backward compatible:

- Existing configurations without `parent` fields work unchanged
- Repositories without `parent` are treated as top-level repositories
- The `parent` field is optional and can be omitted
- Old configurations can be upgraded by running `kse repo init`

### Migration from Non-Nested to Nested

To migrate an existing configuration to use nested scanning:

```bash
# Backup existing configuration
cp .kiro/project-repos.json .kiro/project-repos.json.backup

# Re-initialize with nested scanning
kse repo init --nested -y

# Verify the new configuration
kse repo status
kse repo health
```

## Commands

### `kse repo init`

Initialize repository configuration by scanning the project directory.

**Usage:**
```bash
kse repo init [options]
```

**Options:**
- `-y, --yes`: Skip confirmation prompts
- `--max-depth <depth>`: Maximum directory depth to scan (default: 3)
- `--exclude <paths>`: Comma-separated paths to exclude from scanning
- `--nested`: Enable nested repository scanning (default)
- `--no-nested`: Disable nested repository scanning

**Behavior:**
- Scans project directory recursively for Git repositories
- Excludes `.kiro` directory and common build directories (node_modules, build, dist, etc.)
- Extracts remote URL from `origin` remote (or first available remote)
- Detects current branch
- Prompts for confirmation if configuration already exists
- **Nested scanning** (default): Continues scanning inside Git repositories to find nested subrepositories
- **Non-nested scanning**: Stops at the first Git repository found in each directory branch

**Example:**
```bash
# Initialize with default settings (nested scanning enabled)
kse repo init

# Skip confirmation prompts
kse repo init -y

# Disable nested repository scanning
kse repo init --no-nested

# Scan deeper directory structure
kse repo init --max-depth 5

# Exclude specific directories
kse repo init --exclude "node_modules,vendor"
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

### Directory Not Detected as Repository

**Problem:**
`kse repo init` doesn't detect a directory that you know contains a Git repository.

**Cause:**
The scanner only identifies directories that contain a `.git` subdirectory. Regular subdirectories within a Git repository are not detected as separate repositories.

**Solution:**
1. Verify the directory has a `.git` subdirectory:
   ```bash
   ls -la your-directory/.git
   ```
2. If `.git` is missing, the directory is not a Git repository root. Initialize it:
   ```bash
   cd your-directory
   git init
   ```
3. If you're working with Git worktrees (where `.git` is a file, not a directory), note that worktrees are intentionally excluded from detection.

**Note:** This behavior was fixed in v1.20.5 to eliminate false positives where regular subdirectories were incorrectly identified as repositories.

### Too Many Repositories Detected

**Problem:**
`kse repo init` detects many more repositories than you actually have (e.g., 34 detected when you only have 8).

**Cause:**
If you're using a version prior to v1.20.5, the scanner may incorrectly identify regular subdirectories as repositories.

**Solution:**
1. Upgrade to v1.20.5 or later:
   ```bash
   npm install -g kiro-spec-engine@latest
   ```
2. Re-run the initialization:
   ```bash
   kse repo init
   ```
3. The scanner will now only detect directories with `.git` subdirectories.

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
- 🐛 Report bugs on [GitHub Issues](https://github.com/heguangyong/scene-capability-engine/issues)
- 💬 Ask questions in [GitHub Discussions](https://github.com/heguangyong/scene-capability-engine/discussions)

---

**Version**: 1.20.0  
**Last Updated**: 2026-02-01  
**Changes**: Added nested repository support documentation
