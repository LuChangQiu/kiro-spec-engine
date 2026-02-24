# Open Handle Governance Baseline (2026-02-14)

## Scope

- Removed `forceExit` from:
  - `jest.config.js`
  - `jest.config.ci.js`
- Added diagnosis command:
  - `npm run test:handles` (`--runInBand --detectOpenHandles`)

## Verification Commands

```bash
npm run test:smoke
npm run test:full
npm run test:handles
```

## Observations

1. `test:smoke` passes without the previous explicit "Force exiting Jest" message.
2. `test:handles` passes and does not report explicit open-handle stack traces.
3. `test:full` still prints Jest worker shutdown warning:
   - "A worker process has failed to exit gracefully and has been force exited."

## Interim Conclusion

- **Completed:** removal of hard `forceExit` dependency and addition of diagnostics entrypoint.
- **Residual risk:** parallel-worker teardown warning remains in `test:full`.

## Next Remediation Focus

1. Isolate suite(s) leaking resources under worker mode.
2. Add explicit teardown for remaining timer/watcher/process lifecycle leaks.
3. Re-run `test:full` until worker shutdown warning is eliminated.
