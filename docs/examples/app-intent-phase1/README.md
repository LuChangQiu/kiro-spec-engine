# App Intent Phase-1 Examples

This folder provides copy-ready sample assets for the shipped phase-1 app intent model.

It mirrors the canonical workspace layout:

- `.sce/app/collections/*.json`
- `.sce/app/scene-profiles/*.json`

## Suggested usage

Copy the example files you actually need into your project workspace:

```bash
mkdir -p .sce/app/collections .sce/app/scene-profiles
cp docs/examples/app-intent-phase1/.sce/app/collections/*.json .sce/app/collections/
cp docs/examples/app-intent-phase1/.sce/app/scene-profiles/*.json .sce/app/scene-profiles/
```

Then adapt:

- `app_key`
- `required`
- `allow_local_remove`
- `priority`
- `capability_tags`
- `default_entry`

These are examples, not mandatory defaults. Do not copy them blindly without aligning them to the target business scene.
