# Environment Configuration Management Guide

## Overview

The Environment Configuration Management feature provides a lightweight solution for managing multiple environment configurations (development, staging, production, etc.) within your kse projects.

## Quick Start

### Installation and Project Adoption

**⚠️ Important**: When you install kse in a project, it automatically adopts the project and operates in autonomous mode by default. This means:

- ✅ kse takes ownership of the project structure
- ✅ AI assistants can make changes autonomously without frequent confirmations
- ✅ Faster development workflow with less interruption
- ✅ All changes are tracked and can be rolled back if needed

**Recommended Workflow**:

```bash
# Install kse globally or in your project
npm install -g kiro-spec-engine

# Navigate to your project
cd your-project

# Check project status first (recommended)
kse status

# If issues are detected, run diagnostics
kse doctor

# Adopt the project (creates .kiro/ directory)
kse adopt

# kse is now managing your project autonomously
```

**Note**: Future versions of kse will automatically check project status after installation/upgrade and prompt for diagnostics if needed.

### 1. Register an Environment

Create a configuration file (e.g., `env-local.json`):

```json
{
  "name": "local-dev",
  "description": "Local development environment",
  "config_files": [
    {
      "source": ".env.local",
      "target": ".env"
    },
    {
      "source": "config/database.local.json",
      "target": "config/database.json"
    }
  ]
}
```

Register the environment:

```bash
kse env register env-local.json
```

### 2. List Environments

```bash
kse env list
```

### 3. Switch Environments

```bash
kse env switch local-dev
```

The system automatically:
- Creates a backup of existing target files
- Copies source files to target locations
- Updates the active environment

### 4. View Active Environment

```bash
kse env info
```

### 5. Rollback

If something goes wrong, rollback to the previous state:

```bash
kse env rollback
```

## Commands

### `kse env list`

List all registered environments with their status.

### `kse env switch <name>`

Switch to the specified environment. Creates automatic backups before switching.

### `kse env info`

Display details about the currently active environment.

### `kse env register <config-file>`

Register a new environment from a JSON configuration file.

### `kse env unregister <name> --force`

Remove an environment from the registry. Requires `--force` flag for confirmation.

### `kse env rollback`

Restore the most recent backup, reverting to the previous environment state.

### `kse env verify`

Verify the current environment configuration by running the verification command defined in the environment. If no verification rules are configured, reports success.

### `kse env run "<command>"`

Run a command in the context of the current environment. Ensures the active environment is set before executing the command.

## Configuration File Format

```json
{
  "name": "environment-name",
  "description": "Human-readable description",
  "config_files": [
    {
      "source": "path/to/source/file",
      "target": "path/to/target/file"
    }
  ],
  "verification": {
    "command": "node verify.js",
    "expected_output": "OK"
  }
}
```

### Fields

- **name** (required): Unique environment name in kebab-case
- **description** (required): Human-readable description
- **config_files** (required): Array of source-to-target file mappings
- **verification** (optional): Verification command and expected output

## Backup System

The backup system automatically:
- Creates timestamped backups before each environment switch
- Maintains up to 10 backups per target file
- Stores backups in `.kiro/env-backups/`
- Automatically cleans up old backups

## Best Practices

1. **Adopt projects with kse**: Run `kse adopt` to let kse manage your project autonomously, enabling faster AI-assisted development without constant confirmations
2. **Use descriptive names**: Choose clear, descriptive names for your environments
3. **Keep source files in version control**: Store all environment-specific configuration files in your repository
4. **Selective .kiro/ version control**: Use layered .gitignore strategy:
   - ✅ **DO commit**: `.kiro/specs/` (Spec documents), `.kiro/steering/CORE_PRINCIPLES.md`, `.kiro/steering/ENVIRONMENT.md`, `.kiro/steering/RULES_GUIDE.md`, `.kiro/tools/`, `.kiro/config/`
   - ❌ **DO NOT commit**: `.kiro/steering/CURRENT_CONTEXT.md` (personal context), `.kiro/environments.json` (user-specific), `.kiro/backups/`, `.kiro/logs/`, `.kiro/reports/`
   - **Why**: Share Spec documents and team rules, but avoid conflicts from personal state and user-specific configurations
5. **Share environment templates**: Commit environment configuration JSON files (e.g., `env-local.json`, `env-production.json`) to your repository root or a `config/` directory, not in `.kiro/`
6. **Test switches**: Test environment switches in a safe environment before using in production
7. **Regular backups**: The system creates automatic backups, but consider additional backup strategies for critical configurations
8. **Document verification**: Add verification rules to catch configuration errors early

## Examples

### Example 1: Simple Development/Production Setup

```json
{
  "name": "development",
  "description": "Local development environment",
  "config_files": [
    { "source": ".env.development", "target": ".env" }
  ]
}
```

```json
{
  "name": "production",
  "description": "Production environment",
  "config_files": [
    { "source": ".env.production", "target": ".env" }
  ],
  "verification": {
    "command": "node scripts/verify-env.js",
    "expected_output": "production"
  }
}
```

### Example 2: Multiple Configuration Files

```json
{
  "name": "staging",
  "description": "Staging environment with database and API configs",
  "config_files": [
    { "source": ".env.staging", "target": ".env" },
    { "source": "config/database.staging.json", "target": "config/database.json" },
    { "source": "config/api.staging.json", "target": "config/api.json" }
  ]
}
```

## Troubleshooting

### "Source file does not exist"

Ensure all source files specified in your configuration exist before registering or switching environments.

### "Environment already exists"

Each environment must have a unique name. Use `kse env unregister <name> --force` to remove the existing environment first.

### "Cannot unregister active environment"

Switch to a different environment before unregistering the currently active one.

### "No backups available to restore"

Backups are only created during environment switches. If you haven't switched environments yet, there won't be any backups to restore.

## Integration with Multi-Workspace

When using kse's multi-workspace feature, each workspace maintains its own independent environment registry. This allows different projects to have different environment configurations without interference.

## See Also

- [Multi-Workspace Management](../README.md#multi-workspace-management)
- [Command Reference](command-reference.md)


## Migration Guide

### Migrating from Manual Configuration Management

If you're currently managing environment configurations manually (e.g., copying files, using shell scripts), here's how to migrate to kse environment management:

#### Step 1: Identify Your Environments

List all the environments you currently manage:
- Development (local)
- Staging
- Production
- Testing
- etc.

#### Step 2: Identify Configuration Files

For each environment, identify which files need to be switched:
- `.env` files
- Configuration files (e.g., `config/database.json`, `config/app.json`)
- API endpoint configurations
- Feature flags
- etc.

#### Step 3: Create Source Files

Create source files for each environment. Use a naming convention like:
- `.env.local` → `.env`
- `.env.staging` → `.env`
- `.env.production` → `.env`
- `config/database.local.json` → `config/database.json`

**Example structure**:
```
your-project/
├── .env.local          # Source for local environment
├── .env.staging        # Source for staging environment
├── .env.production     # Source for production environment
├── config/
│   ├── database.local.json
│   ├── database.staging.json
│   └── database.production.json
```

#### Step 4: Create Environment Configuration Files

For each environment, create a JSON configuration file:

**local-env.json**:
```json
{
  "name": "local",
  "description": "Local development environment",
  "config_files": [
    {
      "source": ".env.local",
      "target": ".env"
    },
    {
      "source": "config/database.local.json",
      "target": "config/database.json"
    }
  ],
  "verification": {
    "command": "node scripts/verify-env.js",
    "expected_output": "Environment: local"
  }
}
```

**staging-env.json**:
```json
{
  "name": "staging",
  "description": "Staging environment",
  "config_files": [
    {
      "source": ".env.staging",
      "target": ".env"
    },
    {
      "source": "config/database.staging.json",
      "target": "config/database.json"
    }
  ],
  "verification": {
    "command": "node scripts/verify-env.js",
    "expected_output": "Environment: staging"
  }
}
```

#### Step 5: Register Environments

Register each environment with kse:

```bash
kse env register local-env.json
kse env register staging-env.json
kse env register production-env.json
```

#### Step 6: Verify Registration

List all registered environments:

```bash
kse env list
```

#### Step 7: Test Environment Switching

Switch to an environment and verify:

```bash
# Switch to local environment
kse env switch local

# Verify the switch
kse env info

# Verify configuration is correct
kse env verify
```

#### Step 8: Update Your Workflow

Replace your manual configuration management with kse commands:

**Before**:
```bash
# Manual approach
cp .env.local .env
cp config/database.local.json config/database.json
```

**After**:
```bash
# kse approach
kse env switch local
```

#### Step 9: Add to .gitignore

Add target files to `.gitignore` to avoid committing environment-specific configurations:

```gitignore
# Environment target files (managed by kse)
.env
config/database.json
config/app.json

# Keep source files in version control
!.env.local
!.env.staging
!.env.production
!config/database.*.json
```

### Migrating from Other Tools

#### From direnv

If you're using direnv, you can migrate by:

1. Keep your `.envrc` files as source files
2. Create kse environment configurations that copy `.envrc.local` → `.envrc`
3. Continue using direnv for environment variable loading
4. Use kse for switching between environment configurations

#### From Docker Compose

If you're using Docker Compose with multiple environment files:

1. Keep your `docker-compose.yml` and environment-specific files
2. Create kse environments that switch between different compose files
3. Use kse to manage which compose configuration is active

**Example**:
```json
{
  "name": "docker-local",
  "description": "Docker local environment",
  "config_files": [
    {
      "source": "docker-compose.local.yml",
      "target": "docker-compose.override.yml"
    },
    {
      "source": ".env.docker.local",
      "target": ".env"
    }
  ]
}
```

#### From Kubernetes ConfigMaps

If you're using Kubernetes ConfigMaps for configuration:

1. Export ConfigMaps to local files for development
2. Create kse environments for local development
3. Use kse for local environment switching
4. Keep ConfigMaps for production deployments

### Best Practices for Migration

1. **Start Small**: Begin with one or two environments, test thoroughly, then add more
2. **Backup First**: Create backups of your current configuration files before migration
3. **Test Verification**: Create verification scripts to ensure environment correctness
4. **Document**: Document your environment configurations and switching procedures
5. **Team Communication**: Inform your team about the new workflow and provide training
6. **Gradual Rollout**: Migrate one project at a time, learn from each migration

### Common Migration Issues

#### Issue: Source Files Don't Exist

**Problem**: Trying to register an environment but source files are missing.

**Solution**: Create source files first, then register the environment.

```bash
# Create source file
cp .env .env.local

# Register environment
kse env register local-env.json
```

#### Issue: Target Files Already Exist

**Problem**: Target files exist and you're worried about overwriting them.

**Solution**: kse automatically creates backups before switching. You can also manually backup first.

```bash
# Manual backup (optional, kse does this automatically)
cp .env .env.backup

# Switch environment (creates automatic backup)
kse env switch local

# If needed, rollback
kse env rollback
```

#### Issue: Verification Fails

**Problem**: Environment verification fails after switching.

**Solution**: Check the verification command and expected output. Update the environment configuration if needed.

```bash
# Check what went wrong
kse env verify

# Update environment configuration
# Edit the JSON file and re-register
kse env register local-env.json
```

### Migration Checklist

- [ ] Identify all environments
- [ ] Identify all configuration files
- [ ] Create source files for each environment
- [ ] Create environment configuration JSON files
- [ ] Register all environments with kse
- [ ] Test switching between environments
- [ ] Create verification scripts (optional but recommended)
- [ ] Update .gitignore
- [ ] Update team documentation
- [ ] Train team members on new workflow
- [ ] Remove old manual scripts

