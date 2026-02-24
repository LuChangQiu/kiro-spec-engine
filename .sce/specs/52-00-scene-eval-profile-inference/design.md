# Design Document: Scene Eval Profile Inference Fallback

## Overview

Extend eval profile resolution so `scene eval` can still infer a domain-aware profile even when
spec manifest loading fails.

## Resolution Order

1. Explicit option: `--profile`
2. Spec manifest domain (`sceneLoader.loadFromSpec`)
3. Feedback template domain
4. Run result domain (`result.domain` or `result.eval_payload.domain`)
5. Run result scene reference (`result.scene_ref` or `result.eval_payload.scene_ref`)
6. Feedback scene reference
7. Default profile

## Inference Heuristics

Add `inferProfileFromSceneRef(sceneRef)`:
- Tokenize scene reference (`scene.<domain>.*`) and map known domain tokens.
- Treat `hybrid` as robot profile for safety-oriented defaults.
- Support ops aliases (`ops`, `sre`, `devops`, `infra`).
- Fallback regex hints for explicit domain keywords.

## Runtime Integration

- Pass `resultPayload` into `resolveSceneEvalProfile`.
- Keep manifest-load errors non-fatal and continue fallback resolution.
- Preserve `profile` and `profile_source` in report inputs.
- Keep task sync policy source traceable from selected profile source.

## UX

- Non-JSON eval summary now prints resolved profile and source for quick diagnosis.
