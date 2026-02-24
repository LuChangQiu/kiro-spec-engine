# Developer Guide

This guide is for developers who want to contribute to Scene Capability Engine or extend its functionality.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Migration Script Interface](#migration-script-interface)
- [Extension Points](#extension-points)
- [API Documentation](#api-documentation)
- [Testing Guidelines](#testing-guidelines)
- [Contributing](#contributing)

---

## Architecture Overview

Scene Capability Engine follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                             │
│  (bin/scene-capability-engine.js, lib/commands/*.js)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Core Systems                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Adoption    │  │   Upgrade    │  │   Backup     │     │
│  │  System      │  │   System     │  │   System     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Scene       │  │  Workspace   │  │ Environment  │     │
│  │  Runtime     │  │  Manager     │  │  Manager     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Utility Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Version     │  │  Validation  │  │  File System │     │
│  │  Manager     │  │  Utils       │  │  Utils       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Modularity**: Each component has a single responsibility
2. **Safety**: All operations are atomic with automatic backups
3. **Extensibility**: Clear extension points for future features
4. **Testability**: Components are designed for easy testing
5. **User-Friendly**: Clear error messages and progress indicators

---

## Core Components

### 1. DetectionEngine (`lib/adoption/detection-engine.js`)

Analyzes project structure and determines the appropriate adoption strategy.

**Key Methods**:
- `analyze(projectPath)`: Scans project structure
- `determineStrategy()`: Selects adoption mode (fresh/partial/full)
- `detectProjectType()`: Identifies Node.js/Python/mixed projects
- `detectConflicts()`: Finds template file conflicts

**Usage Example**:
```javascript
const DetectionEngine = require('./lib/adoption/detection-engine');

const engine = new DetectionEngine('/path/to/project');
const analysis = engine.analyze();
console.log(analysis.mode); // 'fresh', 'partial', or 'full'
```

### 2. AdoptionStrategy (`lib/adoption/adoption-strategy.js`)

Implements different adoption modes for various project states.

**Strategies**:
- `FreshAdoption`: Creates complete .sce/ structure from scratch
- `PartialAdoption`: Adds missing components to existing .sce/
- `FullAdoption`: Upgrades existing complete .sce/ to current version

**Usage Example**:
```javascript
const { getStrategy } = require('./lib/adoption/adoption-strategy');

const strategy = getStrategy('fresh');
await strategy.execute('/path/to/project', {
  preserveSpecs: true,
  backupFirst: true
});
```

### 3. VersionManager (`lib/version/version-manager.js`)

Manages project versions and upgrade paths.

**Key Methods**:
- `readVersion(projectPath)`: Reads version.json
- `writeVersion(projectPath, versionInfo)`: Writes version.json atomically
- `needsUpgrade(currentVersion, targetVersion)`: Checks if upgrade needed
- `calculateUpgradePath(from, to)`: Calculates intermediate versions

**Usage Example**:
```javascript
const VersionManager = require('./lib/version/version-manager');

const vm = new VersionManager();
const needsUpgrade = vm.needsUpgrade('1.0.0', '1.2.0');
if (needsUpgrade) {
  const path = vm.calculateUpgradePath('1.0.0', '1.2.0');
  console.log(path); // ['1.0.0', '1.1.0', '1.2.0']
}
```

### 4. MigrationEngine (`lib/upgrade/migration-engine.js`)

Plans and executes version upgrades with migration scripts.

**Key Methods**:
- `planUpgrade(from, to)`: Creates upgrade plan
- `executeUpgrade(projectPath, plan)`: Runs migrations sequentially
- `loadMigration(version)`: Loads migration script
- `validate(projectPath)`: Post-upgrade validation

**Usage Example**:
```javascript
const MigrationEngine = require('./lib/upgrade/migration-engine');

const engine = new MigrationEngine();
const plan = engine.planUpgrade('1.0.0', '1.2.0');
await engine.executeUpgrade('/path/to/project', plan);
```

### 5. BackupSystem (`lib/backup/backup-system.js`)

Creates, manages, and restores backups for safe operations.

**Key Methods**:
- `createBackup(projectPath, reason)`: Creates timestamped backup
- `listBackups(projectPath)`: Lists available backups
- `restore(projectPath, backupId)`: Restores from backup
- `validateBackup(backupPath)`: Verifies backup integrity

**Usage Example**:
```javascript
const BackupSystem = require('./lib/backup/backup-system');

const backup = new BackupSystem();
const backupId = await backup.createBackup('/path/to/project', 'before-upgrade');
// ... perform operations ...
if (failed) {
  await backup.restore('/path/to/project', backupId);
}
```

---

## Migration Script Interface

Migration scripts enable smooth upgrades between versions with breaking changes.

### Script Structure

Create migration scripts in `lib/upgrade/migrations/` with the naming pattern:
`{from-version}-to-{to-version}.js`

Example: `1.0.0-to-1.1.0.js`

### Required Interface

```javascript
/**
 * Migration script from version X to version Y
 */
module.exports = {
  /**
   * Migrate project from old version to new version
   * @param {string} projectPath - Absolute path to project root
   * @param {Object} context - Migration context
   * @param {Object} context.oldVersion - Old version info
   * @param {Object} context.newVersion - New version info
   * @param {Object} context.logger - Logger instance
   * @returns {Promise<Object>} Migration result
   */
  async migrate(projectPath, context) {
    const { oldVersion, newVersion, logger } = context;
    
    logger.info(`Migrating from ${oldVersion.version} to ${newVersion.version}`);
    
    // Perform migration steps
    // 1. Read existing files
    // 2. Transform data/structure
    // 3. Write new files
    // 4. Update configuration
    
    return {
      success: true,
      changes: [
        'Added new steering file: ENVIRONMENT.md',
        'Updated version.json structure'
      ],
      warnings: []
    };
  },

  /**
   * Rollback migration (optional but recommended)
   * @param {string} projectPath - Absolute path to project root
   * @param {Object} context - Migration context
   * @returns {Promise<Object>} Rollback result
   */
  async rollback(projectPath, context) {
    const { logger } = context;
    
    logger.info('Rolling back migration');
    
    // Reverse migration steps
    // Usually handled by backup restore, but can be implemented
    // for more granular control
    
    return {
      success: true,
      message: 'Rollback completed'
    };
  },

  /**
   * Validate migration result (optional)
   * @param {string} projectPath - Absolute path to project root
   * @returns {Promise<Object>} Validation result
   */
  async validate(projectPath) {
    // Verify migration was successful
    // Check file existence, structure, etc.
    
    return {
      valid: true,
      errors: []
    };
  }
};
```

### Migration Best Practices

1. **Idempotency**: Migrations should be safe to run multiple times
2. **Validation**: Always validate before and after migration
3. **Logging**: Log all significant operations
4. **Error Handling**: Handle errors gracefully with clear messages
5. **Rollback**: Implement rollback when possible
6. **Testing**: Test migrations with various project states

### Example Migration Script

```javascript
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  async migrate(projectPath, context) {
    const { logger } = context;
    const changes = [];
    
    // Add new steering file
    const steeringDir = path.join(projectPath, '.sce', 'steering');
    const envFile = path.join(steeringDir, 'ENVIRONMENT.md');
    
    if (!fs.existsSync(envFile)) {
      const template = `# Environment Configuration
...template content...`;
      await fs.writeFile(envFile, template, 'utf8');
      changes.push('Created ENVIRONMENT.md');
      logger.info('✅ Created ENVIRONMENT.md');
    }
    
    // Update version.json structure
    const versionFile = path.join(projectPath, '.sce', 'version.json');
    const versionData = await fs.readJson(versionFile);
    
    if (!versionData.upgradeHistory) {
      versionData.upgradeHistory = [];
      await fs.writeJson(versionFile, versionData, { spaces: 2 });
      changes.push('Added upgradeHistory to version.json');
      logger.info('✅ Updated version.json structure');
    }
    
    return {
      success: true,
      changes,
      warnings: []
    };
  },

  async validate(projectPath) {
    const errors = [];
    
    // Check ENVIRONMENT.md exists
    const envFile = path.join(projectPath, '.sce', 'steering', 'ENVIRONMENT.md');
    if (!fs.existsSync(envFile)) {
      errors.push('ENVIRONMENT.md not found');
    }
    
    // Check version.json structure
    const versionFile = path.join(projectPath, '.sce', 'version.json');
    const versionData = await fs.readJson(versionFile);
    if (!versionData.upgradeHistory) {
      errors.push('version.json missing upgradeHistory field');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};
```

---

## Extension Points

### 1. Custom Adoption Strategies

Add new adoption strategies by extending the base class:

```javascript
const { AdoptionStrategy } = require('./lib/adoption/adoption-strategy');

class CustomAdoption extends AdoptionStrategy {
  async execute(projectPath, options) {
    // Custom adoption logic
  }
}

// Register strategy
const strategies = {
  custom: CustomAdoption
};
```

### 2. Custom Validation Rules

Extend validation system with custom rules:

```javascript
const validation = require('./lib/utils/validation');

function validateCustomRule(projectPath) {
  // Custom validation logic
  return {
    valid: true,
    errors: []
  };
}

// Use in validation pipeline
const result = await validation.validateProject(projectPath, {
  customValidators: [validateCustomRule]
});
```

### 3. Custom Migration Hooks

Add hooks to migration process:

```javascript
const MigrationEngine = require('./lib/upgrade/migration-engine');

class CustomMigrationEngine extends MigrationEngine {
  async beforeMigration(projectPath, plan) {
    // Pre-migration hook
  }

  async afterMigration(projectPath, result) {
    // Post-migration hook
  }
}
```

### 4. Custom CLI Commands

Add new commands to the CLI:

```javascript
// lib/commands/my-command.js
module.exports = {
  name: 'my-command',
  description: 'My custom command',
  
  async execute(options) {
    // Command logic
  }
};

// Register in bin/scene-capability-engine.js
program
  .command('my-command')
  .description('My custom command')
  .action(require('../lib/commands/my-command').execute);
```

---

## API Documentation

### DetectionEngine API

#### `constructor(projectPath)`
Creates a new DetectionEngine instance.

#### `analyze()`
Analyzes project structure and returns analysis result.

**Returns**: `Object`
```javascript
{
  mode: 'fresh' | 'partial' | 'full',
  projectType: 'nodejs' | 'python' | 'mixed',
  hasKiroDir: boolean,
  hasSpecs: boolean,
  hasVersion: boolean,
  conflicts: string[],
  currentVersion: string | null
}
```

### VersionManager API

#### `readVersion(projectPath)`
Reads version.json from project.

**Returns**: `Promise<Object>`
```javascript
{
  version: '1.2.0',
  kseVersion: '1.2.0',
  createdAt: '2026-01-23T00:00:00.000Z',
  updatedAt: '2026-01-23T00:00:00.000Z',
  upgradeHistory: []
}
```

#### `needsUpgrade(currentVersion, targetVersion)`
Checks if upgrade is needed.

**Returns**: `boolean`

#### `calculateUpgradePath(fromVersion, toVersion)`
Calculates intermediate versions for upgrade.

**Returns**: `string[]` - Array of versions in upgrade order

### BackupSystem API

#### `createBackup(projectPath, reason)`
Creates a timestamped backup.

**Returns**: `Promise<string>` - Backup ID

#### `listBackups(projectPath)`
Lists available backups.

**Returns**: `Promise<Array>`
```javascript
[
  {
    id: 'backup-20260123-120000',
    timestamp: '2026-01-23T12:00:00.000Z',
    reason: 'before-upgrade',
    size: 1024000
  }
]
```

#### `restore(projectPath, backupId)`
Restores project from backup.

**Returns**: `Promise<void>`

---

## Testing Guidelines

### Unit Tests

Unit tests are located in `tests/unit/` and test individual components.

**Running unit tests**:
```bash
npm run test:unit
```

**Writing unit tests**:
```javascript
const DetectionEngine = require('../../lib/adoption/detection-engine');

describe('DetectionEngine', () => {
  test('should detect fresh adoption mode', () => {
    const engine = new DetectionEngine('/path/to/project');
    const analysis = engine.analyze();
    expect(analysis.mode).toBe('fresh');
  });
});
```

### Property-Based Tests

Property-based tests are located in `tests/properties/` and test universal properties.

**Running property tests**:
```bash
npm run test:properties
```

**Writing property tests**:
```javascript
const fc = require('fast-check');
const VersionManager = require('../../lib/version/version-manager');

describe('VersionManager Properties', () => {
  test('version comparison is transitive', () => {
    fc.assert(
      fc.property(
        fc.string(), fc.string(), fc.string(),
        (v1, v2, v3) => {
          const vm = new VersionManager();
          // If v1 < v2 and v2 < v3, then v1 < v3
          // Property test logic
        }
      )
    );
  });
});
```

### Integration Tests

Integration tests are located in `tests/integration/` and test end-to-end flows.

**Running integration tests**:
```bash
npm run test:integration
```

---

## Contributing

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/heguangyong/scene-capability-engine.git
cd scene-capability-engine
```

2. Install dependencies:
```bash
npm install
```

3. Run tests:
```bash
npm test
```

4. Install globally for testing:
```bash
npm run install-global
```

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Follow existing code patterns
- Add JSDoc comments for public APIs

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit pull request with clear description

### Commit Message Format

Follow conventional commits:
```
feat: add new adoption strategy
fix: correct version comparison logic
docs: update developer guide
test: add property tests for backup system
```

---

## Additional Resources

- [User Adoption Guide](./adoption-guide.md)
- [User Upgrade Guide](./upgrade-guide.md)
- [Spec Workflow Guide](../.sce/specs/SPEC_WORKFLOW_GUIDE.md)
- [GitHub Repository](https://github.com/heguangyong/scene-capability-engine)
- [Issue Tracker](https://github.com/heguangyong/scene-capability-engine/issues)

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11
