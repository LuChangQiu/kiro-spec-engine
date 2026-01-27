# Deployment Specification

## Prerequisites

List all prerequisites that must be met before deployment:

- [ ] Prerequisite 1
- [ ] Prerequisite 2
- [ ] Prerequisite 3

## Deployment Steps

### Step 1: [Step Name]

Description of the step and what it accomplishes.

```bash
# Commands to execute
```

**Expected outcome**: What should happen after this step

**Rollback**: How to undo this step if needed

### Step 2: [Step Name]

Description of the step and what it accomplishes.

```bash
# Commands to execute
```

**Expected outcome**: What should happen after this step

**Rollback**: How to undo this step if needed

## Environment Variables

| Variable | Description | Required | Default | Example |
|----------|-------------|----------|---------|---------|
| VAR_NAME | Description | Yes/No | value | example |

## Health Checks

### Check 1: [Check Name]

**Purpose**: What this check validates

**Command**:
```bash
# Health check command
```

**Expected result**: What indicates success

**Failure action**: What to do if check fails

### Check 2: [Check Name]

**Purpose**: What this check validates

**Command**:
```bash
# Health check command
```

**Expected result**: What indicates success

**Failure action**: What to do if check fails

## Rollback Procedure

### When to Rollback

- Condition 1
- Condition 2
- Condition 3

### Rollback Steps

1. Step 1
2. Step 2
3. Step 3

### Verification

How to verify rollback was successful:

- [ ] Verification 1
- [ ] Verification 2
- [ ] Verification 3
