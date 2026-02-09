# Design Document: Scene Eval Profile Rules Governance

## Overview

Add configurable profile inference rules to `scene eval` so teams can adapt domain routing without
forking runtime code.

## CLI Extensions

### `scene eval`
- `--profile-rules <path>`

### `scene eval-profile-rules-template`
- Generates default rules file scaffold:
  - `.kiro/templates/scene-eval-profile-rules.json`

## Rules Schema

```json
{
  "domain_aliases": {
    "warehouse": "erp",
    "sre": "ops"
  },
  "scene_ref_rules": [
    {
      "pattern": "^scene\.warehouse\.",
      "profile": "erp"
    }
  ]
}
```

## Runtime Resolution

1. Build normalized default rules.
2. If explicit rules file is provided, load/validate or fail.
3. Else, optionally load implicit project rules file with warning fallback.
4. Pass normalized rules to profile inference for domain and scene-ref resolution.

## Compatibility

- Existing profile inference precedence remains unchanged.
- Defaults preserve existing behavior when no rules file is supplied.
- Task sync and eval scoring logic remain unchanged.
