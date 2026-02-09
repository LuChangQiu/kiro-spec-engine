# Design Document: Scene Runtime Execution Pilot

## Overview

Implement a minimal runtime pipeline:
1. load scene contract
2. compile Plan IR
3. run policy gate
4. execute dry_run or controlled commit
5. emit audit + evidence + eval payload

## Components

- SceneLoader: reads and validates scene manifests.
- PlanCompiler: converts scene contract to Plan IR.
- PolicyGate: enforces risk and approval rules.
- RuntimeExecutor: executes plan by run mode.
- AuditEmitter: writes structured events.
- EvalBridge: builds KPI scoring input.

## Pilot Scope

- commit enabled only for scene.order.query (low risk ERP)
- hybrid scene runs in dry_run only

## Safety

- no direct robot control calls
- adapter checks only in hybrid dry_run mode
