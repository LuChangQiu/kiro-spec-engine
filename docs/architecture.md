# Architecture Documentation

This document provides detailed architecture diagrams and explanations for Scene Capability Engine.

## Table of Contents

- [System Architecture](#system-architecture)
- [Component Interactions](#component-interactions)
- [Data Flow](#data-flow)
- [Adoption Flow](#adoption-flow)
- [Upgrade Flow](#upgrade-flow)
- [Backup and Rollback Flow](#backup-and-rollback-flow)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Interface                              │
│                    (CLI Commands: sce adopt,                        │
│                     sce upgrade, sce rollback,                      │
│                     sce scene ...)                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Command Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   adopt.js   │  │  upgrade.js  │  │ rollback.js  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   scene.js   │  │ workspace.js │  │    env.js    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Scene Runtime Layer                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ scene-ontology   │  │ scene-template-  │  │ moqui-adapter    │ │
│  │                  │  │ linter           │  │                  │ │
│  │ - OntologyGraph  │  │ - lintPackage()  │  │ - MoquiClient    │ │
│  │ - buildFromManif │  │ - scoreQuality() │  │ - MoquiAdapter   │ │
│  │ - validateGraph  │  │ - contribute()   │  │ - MoquiExtractor │ │
│  │ - queryDeps      │  │ - scoreAgent()   │  │                  │ │
│  │ - getActionInfo  │  │                  │  │                  │ │
│  │ - parseLineage   │  │                  │  │                  │ │
│  │ - getAgentHints  │  │                  │  │                  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │ scene-template-  │  │ scene-template-  │                        │
│  │ validator        │  │ renderer         │                        │
│  │                  │  │                  │                        │
│  │ - validateSchema │  │ - renderPackage()│                        │
│  │ - resolveChain() │  │ - resolveVars()  │                        │
│  └──────────────────┘  └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Core Systems Layer                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │ DetectionEngine  │  │ MigrationEngine  │  │  BackupSystem    │ │
│  │                  │  │                  │  │                  │ │
│  │ - analyze()      │  │ - planUpgrade()  │  │ - createBackup() │ │
│  │ - determineMode()│  │ - execute()      │  │ - restore()      │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │AdoptionStrategy  │  │  VersionManager  │                        │
│  │                  │  │                  │                        │
│  │ - Fresh          │  │ - readVersion()  │                        │
│  │ - Partial        │  │ - needsUpgrade() │                        │
│  │ - Full           │  │ - calcPath()     │                        │
│  └──────────────────┘  └──────────────────┘                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Utility Layer                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  Validation      │  │  File System     │  │  Version Check   │ │
│  │  Utils           │  │  Utils           │  │                  │ │
│  │                  │  │                  │  │                  │ │
│  │ - validateProj() │  │ - atomicWrite()  │  │ - checkVersion() │ │
│  │ - validateVer()  │  │ - safeCopy()     │  │ - showWarning()  │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        File System                                   │
│                    (.sce/, backups/, etc.)                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Interactions

### Adoption System Interaction

```
┌──────────┐
│   User   │
└────┬─────┘
     │ sce adopt
     ▼
┌─────────────────┐
│  adopt.js       │
│  (Command)      │
└────┬────────────┘
     │
     ├─────────────────────────────────────────┐
     │                                         │
     ▼                                         ▼
┌─────────────────┐                    ┌─────────────────┐
│DetectionEngine  │                    │  BackupSystem   │
│                 │                    │                 │
│ 1. analyze()    │                    │ 1. createBackup()│
│ 2. detectType() │                    │    (if needed)  │
│ 3. detectConf() │                    └─────────────────┘
└────┬────────────┘
     │ analysis result
     ▼
┌─────────────────┐
│AdoptionStrategy │
│                 │
│ 1. getStrategy()│
│ 2. execute()    │
└────┬────────────┘
     │
     ├──────────────┬──────────────┐
     │              │              │
     ▼              ▼              ▼
┌─────────┐  ┌─────────┐  ┌─────────────┐
│  Fresh  │  │ Partial │  │    Full     │
│Adoption │  │Adoption │  │  Adoption   │
└────┬────┘  └────┬────┘  └─────┬───────┘
     │            │              │
     └────────────┴──────────────┘
                  │
                  ▼
          ┌───────────────┐
          │VersionManager│
          │               │
          │ writeVersion()│
          └───────────────┘
                  │
                  ▼
          ┌───────────────┐
          │  Validation   │
          │               │
          │ validateProj()│
          └───────────────┘
```

### Upgrade System Interaction

```
┌──────────┐
│   User   │
└────┬─────┘
     │ sce upgrade
     ▼
┌─────────────────┐
│  upgrade.js     │
│  (Command)      │
└────┬────────────┘
     │
     ├─────────────────────────────────────────┐
     │                                         │
     ▼                                         ▼
┌─────────────────┐                    ┌─────────────────┐
│VersionManager   │                    │  BackupSystem   │
│                 │                    │                 │
│ 1. readVersion()│                    │ 1. createBackup()│
│ 2. needsUpgrade()│                   │    (mandatory)  │
│ 3. calcPath()   │                    └─────────────────┘
└────┬────────────┘
     │ upgrade path
     ▼
┌─────────────────┐
│MigrationEngine  │
│                 │
│ 1. planUpgrade()│
│ 2. loadMigr()   │
│ 3. execute()    │
└────┬────────────┘
     │
     │ for each version in path
     ▼
┌─────────────────┐
│Migration Script │
│                 │
│ 1. migrate()    │
│ 2. validate()   │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│VersionManager   │
│                 │
│ writeVersion()  │
│ (update history)│
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│  Validation     │
│                 │
│ validateProj()  │
└─────────────────┘
```

---

## Data Flow

### Version Information Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    version.json                              │
│  {                                                           │
│    "version": "1.2.0",                                       │
│    "kseVersion": "1.2.0",                                    │
│    "createdAt": "2026-01-23T00:00:00.000Z",                 │
│    "updatedAt": "2026-01-23T00:00:00.000Z",                 │
│    "upgradeHistory": [                                       │
│      {                                                       │
│        "from": "1.0.0",                                      │
│        "to": "1.1.0",                                        │
│        "timestamp": "2026-01-23T00:00:00.000Z",             │
│        "kseVersion": "1.1.0"                                 │
│      }                                                       │
│    ]                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   VersionManager      │
              │                       │
              │ - Parse version       │
              │ - Validate structure  │
              │ - Compare versions    │
              │ - Calculate path      │
              └───────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │ Adopt   │    │Upgrade  │    │Version  │
    │Command  │    │Command  │    │Checker  │
    └─────────┘    └─────────┘    └─────────┘
```

### Backup Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Project .sce/                            │
│  ├── specs/                                                  │
│  ├── steering/                                               │
│  ├── tools/                                                  │
│  └── version.json                                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ createBackup()
                          ▼
              ┌───────────────────────┐
              │   BackupSystem        │
              │                       │
              │ 1. Validate source    │
              │ 2. Create timestamp   │
              │ 3. Copy recursively   │
              │ 4. Validate backup    │
              └───────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              .sce/backups/backup-{timestamp}/               │
│  ├── specs/                                                  │
│  ├── steering/                                               │
│  ├── tools/                                                  │
│  ├── version.json                                            │
│  └── backup-info.json                                        │
│     {                                                        │
│       "timestamp": "2026-01-23T12:00:00.000Z",              │
│       "reason": "before-upgrade",                            │
│       "originalVersion": "1.0.0"                             │
│     }                                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ restore()
                          ▼
              ┌───────────────────────┐
              │   BackupSystem        │
              │                       │
              │ 1. Validate backup    │
              │ 2. Clear current      │
              │ 3. Copy back          │
              │ 4. Validate restore   │
              └───────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Project .sce/                            │
│  (Restored to backup state)                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Adoption Flow

### Fresh Adoption Flow

```
START
  │
  ▼
┌─────────────────────┐
│ Detect: No .sce/   │
│ Mode: Fresh         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create .sce/       │
│ directory structure │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Copy template files:│
│ - specs/            │
│ - steering/         │
│ - tools/            │
│ - README.md         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create version.json │
│ with current version│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Validate structure  │
└──────┬──────────────┘
       │
       ▼
      END
```

### Partial Adoption Flow

```
START
  │
  ▼
┌─────────────────────┐
│ Detect: Partial     │
│ .sce/ exists but   │
│ incomplete          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create backup       │
│ (optional)          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Analyze missing     │
│ components          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Add missing:        │
│ - directories       │
│ - template files    │
│ - version.json      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Preserve existing:  │
│ - specs/            │
│ - user content      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Validate structure  │
└──────┬──────────────┘
       │
       ▼
      END
```

### Full Adoption Flow

```
START
  │
  ▼
┌─────────────────────┐
│ Detect: Full        │
│ .sce/ complete but │
│ old version         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create backup       │
│ (mandatory)         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Calculate upgrade   │
│ path                │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Execute migrations  │
│ (if needed)         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Update template     │
│ files (non-user)    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Update version.json │
│ with history        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Validate structure  │
└──────┬──────────────┘
       │
       ▼
      END
```

---

## Upgrade Flow

### Standard Upgrade Flow

```
START
  │
  ▼
┌─────────────────────┐
│ Read current version│
│ from version.json   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Check if upgrade    │
│ needed              │
└──────┬──────────────┘
       │ Yes
       ▼
┌─────────────────────┐
│ Create backup       │
│ (mandatory)         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Calculate upgrade   │
│ path with           │
│ intermediate        │
│ versions            │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ For each version    │
│ in path:            │
│                     │
│ ┌─────────────────┐ │
│ │ Load migration  │ │
│ │ script          │ │
│ └────────┬────────┘ │
│          │          │
│          ▼          │
│ ┌─────────────────┐ │
│ │ Execute         │ │
│ │ migrate()       │ │
│ └────────┬────────┘ │
│          │          │
│          ▼          │
│ ┌─────────────────┐ │
│ │ Validate        │ │
│ │ result          │ │
│ └────────┬────────┘ │
│          │          │
│          ▼          │
│ ┌─────────────────┐ │
│ │ Update version  │ │
│ │ and history     │ │
│ └─────────────────┘ │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Final validation    │
└──────┬──────────────┘
       │
       ▼
      END
```

### Upgrade with Rollback Flow

```
START
  │
  ▼
┌─────────────────────┐
│ Begin upgrade       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create backup       │
│ backup-id: ABC123   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Execute migration   │
└──────┬──────────────┘
       │
       │ ERROR!
       ▼
┌─────────────────────┐
│ Catch error         │
│ Log details         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Restore from backup │
│ backup-id: ABC123   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Validate restore    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Report error to user│
│ with recovery steps │
└──────┬──────────────┘
       │
       ▼
      END
```

---

## Backup and Rollback Flow

### Backup Creation Flow

```
START
  │
  ▼
┌─────────────────────┐
│ Validate source     │
│ .sce/ exists       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Generate backup ID  │
│ backup-{timestamp}  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create backup dir   │
│ .sce/backups/...   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Copy .sce/ content │
│ recursively         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create backup-info  │
│ .json with metadata │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Validate backup     │
│ integrity           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Return backup ID    │
└──────┬──────────────┘
       │
       ▼
      END
```

### Rollback Flow

```
START
  │
  ▼
┌─────────────────────┐
│ List available      │
│ backups             │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ User selects backup │
│ or auto-select      │
│ latest              │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Validate backup     │
│ integrity           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Create safety backup│
│ of current state    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Clear current       │
│ .sce/ content      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Copy backup content │
│ to .sce/           │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Validate restore    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Report success      │
└──────┬──────────────┘
       │
       ▼
      END
```

---

## Error Handling Architecture

### Error Categories and Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Categories                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Pre-Operation Errors                                     │
│     - Invalid project path                                   │
│     - Missing dependencies                                   │
│     - Permission errors                                      │
│     → Action: Abort before any changes                       │
│                                                              │
│  2. Operation Errors                                         │
│     - File system errors                                     │
│     - Migration script errors                                │
│     - Validation failures                                    │
│     → Action: Rollback to backup                             │
│                                                              │
│  3. Backup Errors                                            │
│     - Backup creation failed                                 │
│     - Backup validation failed                               │
│     → Action: Abort operation                                │
│                                                              │
│  4. Rollback Errors                                          │
│     - Restore failed                                         │
│     - Backup corrupted                                       │
│     → Action: Manual recovery required                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

**Version**: 1.42.0  
**Last Updated**: 2026-02-11
