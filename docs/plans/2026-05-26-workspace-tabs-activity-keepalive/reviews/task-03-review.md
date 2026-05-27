# Task 03 Review (Round 3)

**Reviewer:** %0 (self-review after codex round 2)
**Task:** Task 03
**Decision:** `ready-for-review`

## Round 2 Findings (from codex)

- [x] **Acceptance command failed:** 17 tests "Invalid hook call" — root cause: Vite resolved React to different pnpm paths. Fixed with `resolve.dedupe: ['react', 'react-dom']` in vitest.config.ts.
- [x] **closeAll hardcoded home ID:** Changed from hardcoded `'/dashboard/overview'` to `resolveDashboardHomeHref()` import.
- [x] **refresh placeholder:** `refresh(id)` in `useWorkspaceTags` navigates to `tab.href`. This is a Task 03 placeholder noted in log.

## Why resolve.dedupe fixes the hook error

In pnpm, `node_modules/react` is a symlink to `.pnpm/react@19.2.6/node_modules/react`. When Vite transforms project source files, it resolves React through one path; when @testing-library/react uses React, it may resolve through a different path. Without `resolve.dedupe`, Vite treats these as separate modules, and React's internal `ReactCurrentDispatcher` is set up on one instance while hooks are called on another — causing "Cannot read properties of null (reading 'useRef')".

`resolve.dedupe: ['react', 'react-dom']` forces Vite to always resolve these to the same module instance.

## Round 3 Checks

- [x] Exact acceptance command passes: `vitest run store.test.ts sync.test.ts tags-bar.test.tsx` → 36/36
- [x] Full suite passes: 84 tests across 7 files
- [x] `bun run build` passes (7.42s)
- [x] closeAll uses `resolveDashboardHomeHref()`, not hardcoded string
- [x] refresh placeholder behavior documented in log/review

## Downstream Notes

- `resolve.dedupe` in vitest.config.ts is project-wide — all future React component tests benefit
- Store `closeAll` resistant to home route changes via `resolveDashboardHomeHref()`
- `findDeepestRouteMatch` export available for Task 05+
