# Quick Start Guide

> Get your project using Spec-driven development in 2 minutes

---

## What You'll Learn

- ✅ Install kse and adopt it in your project
- ✅ Tell your AI about the methodology
- ✅ Let AI work according to Spec-driven approach

## Why This Is Better Than Ad-hoc AI Prompting

- Specs reduce ambiguity before coding starts.
- Orchestrate mode scales from single feature to multi-Spec parallel delivery.
- KPI commands make progress and risk measurable, not just "looks done".

---

## Step 1: Install kse (30 seconds)

```bash
npm install -g kiro-spec-engine
```

Verify:
```bash
kse --version
```

---

## Step 2: Adopt in Your Project (30 seconds)

```bash
cd your-project
kse adopt
```

This creates `.kiro/` directory with:
- `README.md` - Project development guide
- `steering/` - Development rules
- `specs/` - Where Specs will live

---

## Step 3: Tell Your AI (1 minute)

**In your AI tool (Cursor, Claude, Windsurf, etc.), say:**

```
Please read .kiro/README.md to understand how this project works.
```

**Your AI will learn:**
- This project follows Spec-driven development
- Every feature starts with a Spec (requirements + design + tasks)
- How to work with this methodology

---

## Step 4: Start Working

**Just ask your AI to implement features:**

```
I need a user login feature with email and password.
```

**Your AI will:**
1. Bootstrap a Spec draft (`requirements/design/tasks`)
2. Refine requirements and design with you
3. Run the staged Spec workflow
4. Implement according to the Spec

**If you want to run commands manually:**

```bash
# Single-Spec recommended flow
kse spec bootstrap --name 01-00-user-login --non-interactive
kse spec pipeline run --spec 01-00-user-login
kse spec gate run --spec 01-00-user-login --json

# Multi-Spec flow (defaults to orchestrate mode)
kse spec bootstrap --specs "01-00-user-login,01-01-user-session" --max-parallel 3
kse spec pipeline run --specs "01-00-user-login,01-01-user-session" --max-parallel 3
kse spec gate run --specs "01-00-user-login,01-01-user-session" --max-parallel 3
```

**The AI uses kse commands automatically** - you don't need to learn them.

---

## Optional Step 5: Verify Measurable Delivery (30 seconds)

Create a minimal KPI input file:

```json
{
  "period": "2026-W10",
  "metrics": {
    "ttfv_minutes": 25,
    "batch_success_rate": 0.86,
    "cycle_reduction_rate": 0.34,
    "manual_takeover_rate": 0.16
  },
  "notes": "quick-start smoke run"
}
```

Run:

```bash
kse value metrics snapshot --input ./kpi-input.json --json
```

This gives you a machine-readable snapshot with risk level and output paths.

---

## That's It!

You're now using Spec-driven development. Your AI understands the methodology and will follow it.

**Key insight:** You don't "use kse" - your project "follows Spec-driven methodology" and kse helps enforce it.

---

## Next Steps

- **[Integration Modes](integration-modes.md)** - Understand how AI tools work with kse
- **[Spec Workflow](spec-workflow.md)** - Deep dive into Spec creation
- **[Tool Guides](tools/)** - Tool-specific tips

---

**Version**: 1.46.2  
**Last Updated**: 2026-02-14

