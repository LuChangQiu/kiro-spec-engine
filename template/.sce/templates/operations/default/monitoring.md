# Monitoring Specification

## Metrics

### Metric 1: [Metric Name]

**Description**: What this metric measures

**Type**: Counter / Gauge / Histogram / Summary

**Collection method**: How the metric is collected

**Frequency**: How often to collect

**Labels**: Key-value pairs for metric dimensions

```
metric_name{label1="value1", label2="value2"}
```

### Metric 2: [Metric Name]

**Description**: What this metric measures

**Type**: Counter / Gauge / Histogram / Summary

**Collection method**: How the metric is collected

**Frequency**: How often to collect

**Labels**: Key-value pairs for metric dimensions

```
metric_name{label1="value1", label2="value2"}
```

## Thresholds

### Threshold 1: [Threshold Name]

**Metric**: Which metric this threshold applies to

**Warning level**: Value that triggers warning

**Critical level**: Value that triggers critical alert

**Duration**: How long condition must persist

**Rationale**: Why these thresholds were chosen

### Threshold 2: [Threshold Name]

**Metric**: Which metric this threshold applies to

**Warning level**: Value that triggers warning

**Critical level**: Value that triggers critical alert

**Duration**: How long condition must persist

**Rationale**: Why these thresholds were chosen

## Alert Rules

### Alert 1: [Alert Name]

**Condition**: When this alert fires

**Severity**: Critical / High / Medium / Low

**Notification channels**: Where to send alerts

**Escalation**: Who to notify and when

**Runbook**: Link to troubleshooting procedure

### Alert 2: [Alert Name]

**Condition**: When this alert fires

**Severity**: Critical / High / Medium / Low

**Notification channels**: Where to send alerts

**Escalation**: Who to notify and when

**Runbook**: Link to troubleshooting procedure

## Response Procedures

### Procedure 1: [Procedure Name]

**Trigger**: What alert or condition triggers this procedure

**Immediate actions**:
1. Action 1
2. Action 2
3. Action 3

**Investigation steps**:
1. Step 1
2. Step 2
3. Step 3

**Resolution**:
- Resolution approach 1
- Resolution approach 2

**Post-incident**:
- [ ] Document incident
- [ ] Update runbook if needed
- [ ] Review and improve

### Procedure 2: [Procedure Name]

**Trigger**: What alert or condition triggers this procedure

**Immediate actions**:
1. Action 1
2. Action 2
3. Action 3

**Investigation steps**:
1. Step 1
2. Step 2
3. Step 3

**Resolution**:
- Resolution approach 1
- Resolution approach 2

**Post-incident**:
- [ ] Document incident
- [ ] Update runbook if needed
- [ ] Review and improve
