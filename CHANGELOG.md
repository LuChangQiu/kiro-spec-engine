# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
