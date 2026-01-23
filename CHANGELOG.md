# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-01-23

### Added - Watch Mode Automation System 🤖

**Core Components** (2150+ lines of code, 172 tests):
- **FileWatcher**: Cross-platform file monitoring with chokidar
  - Glob pattern matching with minimatch
  - Configurable ignored patterns
  - Event emission for file changes
  - Error recovery and health monitoring
- **EventDebouncer**: Smart event management
  - Debounce and throttle logic
  - Event queue with duplicate prevention
  - Configurable delays per pattern
- **ActionExecutor**: Command execution engine
  - Shell command execution with context interpolation
  - Retry logic with exponential/linear backoff
  - Timeout handling and process management
  - Command validation and security
- **ExecutionLogger**: Complete audit trail
  - Log rotation by size
  - Metrics tracking (executions, time saved, success rates)
  - Export to JSON/CSV
  - Configurable log levels
- **WatchManager**: Central coordinator
  - Lifecycle management (start/stop/restart)
  - Configuration loading and validation
  - Status reporting and metrics

**CLI Commands** (7 commands):
- `kse watch init` - Initialize watch configuration
- `kse watch start/stop` - Control watch mode
- `kse watch status` - Show current status
- `kse watch logs` - View execution logs (with tail/follow)
- `kse watch metrics` - Display automation metrics
- `kse watch presets` - List available presets
- `kse watch install <preset>` - Install automation preset

**Automation Presets** (4 presets):
- `auto-sync` - Automatically sync workspace when tasks.md changes
- `prompt-regen` - Regenerate prompts when requirements/design change
- `context-export` - Export context when tasks complete
- `test-runner` - Run tests when source files change

**Tool Detection & Auto-Configuration**:
- Automatic IDE detection (Kiro IDE, VS Code, Cursor)
- Tool-specific automation recommendations
- Auto-configuration during project adoption
- Confidence-based suggestions

**Manual Workflows** (6 workflows):
- Complete workflow guide (300+ lines)
- `kse workflows` command for workflow management
- Step-by-step instructions with time estimates
- Interactive checklists for common tasks
- Workflows: task-sync, context-export, prompt-generation, daily, task-completion, spec-creation

### Enhanced
- **README.md**: Added comprehensive automation section
- **Project Adoption**: Integrated tool detection with automation setup
- **Documentation**: Complete manual workflows guide

### Testing
- 289 tests passing (100% pass rate)
- 279 unit tests
- 10 integration tests
- Full coverage of all watch mode components

### Performance
- Efficient file watching with debouncing
- Configurable retry logic
- Log rotation to prevent disk space issues
- Metrics tracking for optimization

## [1.2.3] - 2026-01-23

### Added
- **Developer Documentation**: Comprehensive guides for contributors and extenders
  - `docs/developer-guide.md`: Complete developer guide with API documentation
  - `docs/architecture.md`: Detailed architecture diagrams and data flow documentation
  - Migration script interface documentation with examples
  - Extension points for custom strategies and validators
  - Testing guidelines for unit, property-based, and integration tests
  - Contributing guidelines and development setup

### Enhanced
- Improved documentation structure for developers
- Added detailed API documentation for all core classes
- Added architecture diagrams for system understanding
- Added data flow diagrams for adoption, upgrade, and backup processes

## [1.2.2] - 2026-01-23

### Added
- **User Documentation**: Comprehensive guides for adoption and upgrade workflows
  - `docs/adoption-guide.md`: Complete guide for adopting existing projects
  - `docs/upgrade-guide.md`: Complete guide for upgrading project versions
  - Step-by-step instructions with examples
  - Troubleshooting sections for common issues
  - Best practices and recommendations

### Enhanced
- Improved documentation structure for better user experience
- Added practical examples for all adoption modes
- Added detailed upgrade scenarios with migration examples

## [1.2.1] - 2026-01-23

### Added
- **Validation System**: Comprehensive project validation
  - `validateProjectStructure()`: Check required files and directories
  - `validateVersionFile()`: Verify version.json structure
  - `validateDependencies()`: Check Node.js and Python versions
  - `validateProject()`: Complete project validation
- **Automatic Version Checking**: Detect version mismatches
  - VersionChecker class for automatic version detection
  - Warning display when project version differs from installed kse
  - `--no-version-check` flag to suppress warnings
  - `kse version-info` command for detailed version information
- **Enhanced Testing**: Added tests for validation and version checking
  - 7 new unit tests for validation system
  - 4 new unit tests for version checker
  - Total: 25 tests passing

### Enhanced
- CLI now checks for version mismatches before command execution
- Better error messages for validation failures
- Improved user experience with version information display

## [1.2.0] - 2026-01-23

### Added
- **Project Adoption System**: Intelligent project adoption with three modes
  - Fresh adoption: Create complete .kiro/ structure from scratch
  - Partial adoption: Add missing components to existing .kiro/
  - Full adoption: Upgrade existing complete .kiro/ to current version
- **Version Upgrade System**: Smooth version migration with migration scripts
  - Incremental upgrades through intermediate versions
  - Migration script support for breaking changes
  - Automatic backup before upgrades
- **Backup and Rollback System**: Safe operations with automatic backups
  - Automatic backup creation before destructive operations
  - Backup validation and integrity checking
  - Easy rollback to previous states
- **New CLI Commands**:
  - `kse adopt`: Adopt existing projects into Kiro Spec Engine
  - `kse upgrade`: Upgrade project to newer version
  - `kse rollback`: Restore project from backup
- **Core Components**:
  - DetectionEngine: Analyzes project structure and determines adoption strategy
  - AdoptionStrategy: Implements fresh, partial, and full adoption modes
  - MigrationEngine: Plans and executes version upgrades
  - BackupSystem: Creates, manages, and restores backups

### Enhanced
- Version management with upgrade history tracking
- File system utilities with backup support
- Project structure detection (Node.js, Python, mixed)
- Conflict detection and resolution

### Infrastructure
- Created lib/adoption/ directory for adoption strategies
- Created lib/upgrade/ directory for migration engine
- Created lib/backup/ directory for backup system
- Created lib/commands/ directory for CLI commands
- Migration script template and loader system

### Documentation
- Comprehensive adoption and upgrade system design
- Migration script interface documentation
- User guides for adoption, upgrade, and rollback workflows

## [1.1.0] - 2026-01-23

### Added
- Version management system for project adoption and upgrades
- VersionManager class for tracking project versions
- Compatibility matrix for version compatibility checking
- Upgrade path calculation for incremental upgrades
- Safe file system utilities with atomic operations
- Path validation to prevent path traversal attacks
- Project structure for future adoption/upgrade features

### Infrastructure
- Added semver dependency for version comparison
- Created lib/version/ directory for version management
- Created lib/utils/ directory for shared utilities
- Prepared foundation for kse adopt and kse upgrade commands

### Documentation
- Created spec 02-00-project-adoption-and-upgrade
- Comprehensive design for project adoption system
- Detailed requirements for smooth upgrade experience

## [1.0.0] - 2026-01-23

### Added
- Initial stable release
- Complete npm and GitHub release pipeline
- Python dependency detection with OS-specific installation instructions
- Doctor command for system diagnostics
- Automated CI/CD with GitHub Actions
- Multi-language support (English and Chinese)
- Comprehensive test infrastructure
- Ultrawork quality enhancement tool
- CLI commands: init, doctor, --version, --help
- Template system for new projects

### Documentation
- Complete README with installation and usage guide
- Chinese README (README.zh.md)
- Contributing guidelines (CONTRIBUTING.md)
- MIT License

### Infrastructure
- GitHub Actions workflows for testing and releasing
- Jest test framework with property-based testing support
- Cross-platform support (Windows, macOS, Linux)
- Node.js 16+ support

---

**Legend**:
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes
