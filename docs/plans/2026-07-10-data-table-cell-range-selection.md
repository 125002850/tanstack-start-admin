# DataTable Cell Range Selection Implementation Plan

**Goal:** 为 DataTable 增加支持虚拟化的连续矩形拖选、键盘方向键/Shift 扩选、边缘自动滚屏与 TSV 区域复制，并安全同步到 `main` 与 `features/sso`。
**Architecture:** 使用稳定 row/column ID 表达 `anchor + focus`，由纯函数基于当前 TanStack row/column order 派生矩形；pointer/keyboard hook 只维护可观察范围，瞬态指针与 RAF 状态保存在 ref；自动滚屏只驱动 DataTable 自身 ScrollArea viewport，并对祖先裁剪与 RTL scrollLeft 做归一化。
**Tech Stack:** React 19、TanStack Table 8、TanStack Virtual 3、TypeScript 7、Vitest 4、Testing Library、Playwright。

---

## File Structure

- Reference: `docs/superpowers/specs/2026-07-10-data-table-cell-range-selection-design.md`
- Reference: `.agents/skills/oig-tanstack-admin/references/data-table.md`
- Create: `src/components/data-table/core/data-table-cell-range.ts`
- Create: `src/components/data-table/core/data-table-cell-range.test.ts`
- Create: `src/components/data-table/core/use-data-table-cell-auto-scroll.ts`
- Create: `src/components/data-table/core/use-data-table-cell-auto-scroll.test.ts`
- Modify: `src/components/data-table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/data-table/core/data-table-body.tsx`
- Modify: `src/components/data-table/core/data-table.test.tsx`
- Modify: `src/styles/globals.css`
- Create: `e2e/data-table-cell-range-selection.smoke.spec.ts`

---

## Cross-Cutting Design Decisions

### 1. Visual Rendering Mechanism

Range selection visual rendering uses **cell-internal styling**, not a cross-table absolute overlay.

- **Background:** Each rendered cell determines `data-cell-selected` membership via `isDataTableCellInRange()` and draws its own range background using a low-opacity primary variable. This naturally works with virtualization — newly mounted cells re-evaluate membership from `anchor + focus` + current row/column index without overlay geometry management.
- **Outer border:** Each cell on the logical range edge outputs `data-cell-range-edge` with space-separated logical sides (`block-start`, `block-end`, `inline-start`, `inline-end`). A CSS `::after` pseudo-element on edge cells draws a primary logical border at the range perimeter. Non-perimeter cells (inside the range boundary) do not produce the edge attribute, so only the outermost boundary renders the `::after` border.
- **Focus ring:** The focus cell (`data-cell-range-focus="true"`) gets a distinct focus ring via `outline` or `box-shadow`, visually nested inside the range border.
- **Pinned columns:** Pinned columns are excluded from the selectable column sequence per existing Invariants. V1 keeps this constraint: pinned cells never receive range background or edge border. Center-zone selection must not visually bleed or overlap pinned columns at the boundary. A dedicated E2E regression verifies pinned cells cannot start selection and there is no background/border pollution at the pinned/center seam. Cross-pinned/center range selection is not in scope and would require a separate design.
- **Reduced motion:** `prefers-reduced-motion` applies `transition-duration: 1ms` to the copy-flash animation, which is the only animated range feedback. Range background and border are static and not animated.

### 2. Accessibility Decision

The DataTable keeps native `<table>`/`<tr>`/`<td>` semantics and is NOT an ARIA `grid` — this constrains which ARIA attributes are valid.

- `aria-multiselectable` is **not added** in V1. Its ARIA baseline requires a widget role (`grid`, `listbox`, `tablist`, `tree`) with per-item `aria-selected`. Adding it to a native `<table>` without corresponding `gridcell` `aria-selected` would produce an incomplete and potentially misleading accessibility tree.
- **Row selection** continues to use `<tr aria-selected>` — this existing semantic is unchanged and remains distinct from range selection.
- **Roving focus:** When a range exists, only the focus cell is in the Tab sequence (`tabIndex=0`; all others `tabIndex=-1`), matching existing keyboard navigation practice.
- **Live region:** A `sr-only` `aria-live="polite"` region announces the current range bounds (start cell, end cell) and cell count when the range changes. This gives screen reader users equivalent spatial awareness without conflicting with the native table semantics.
- **Future ARIA grid upgrade:** If the component is later migrated to `role="grid"` + `role="gridcell"`, then `aria-multiselectable`, per-cell `aria-selected`, and the full ARIA grid keyboard contract (`Ctrl+Home`, `Ctrl+End`, page keys, etc.) must be implemented as a complete package — not incrementally.

### 3. Public API Quick Reference

The pure range-model module at `src/components/data-table/core/data-table-cell-range.ts` exports the following:

```ts
export type DataTableCellCoordinate = {
  rowId: string;
  columnId: string;
};

export type DataTableCellRange = {
  anchor: DataTableCellCoordinate;
  focus: DataTableCellCoordinate;
};

export type DataTableCellRangeBounds = {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

export type DataTableCellRangeIndex = {
  rowIds: readonly string[];
  columnIds: readonly string[];
  rowIndexById: ReadonlyMap<string, number>;
  columnIndexById: ReadonlyMap<string, number>;
};

export type DataTableCellRangeEdge = 'block-start' | 'inline-end' | 'block-end' | 'inline-start';

// Internal — referenced by moveDataTableCellCoordinate
type DataTableCellArrowKey = 'ArrowUp' | 'ArrowRight' | 'ArrowDown' | 'ArrowLeft';

export function createDataTableCellRangeIndex(
  rowIds: readonly string[],
  columnIds: readonly string[]
): DataTableCellRangeIndex;

export function resolveDataTableCellRangeBounds(
  range: DataTableCellRange,
  index: DataTableCellRangeIndex
): DataTableCellRangeBounds | null;

export function isDataTableCellInRange(
  coordinate: DataTableCellCoordinate,
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex
): boolean;

export function getDataTableCellRangeEdges(
  coordinate: DataTableCellCoordinate,
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex
): string | undefined;

export function moveDataTableCellCoordinate(
  coordinate: DataTableCellCoordinate,
  key: DataTableCellArrowKey,
  direction: 'ltr' | 'rtl',
  index: DataTableCellRangeIndex
): DataTableCellCoordinate;

export function buildDataTableCellRangeTsv(
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex,
  getText: (coordinate: DataTableCellCoordinate) => unknown
): string;

export function normalizeDataTableCellClipboardText(value: unknown): string;

export function resolveDataTableCellClipboardText(params: {
  copyValue?: unknown;
  renderedText?: string;
  rawValue: unknown;
}): string;
```

### 4. Pointer Cursor and User-Select

- **Cursor:** All selectable data cells apply `cursor: cell` in both idle and drag-selecting states. Interactive controls (buttons, links, inputs, checkboxes, contenteditable) inside cells do not inherit this cursor and cannot initiate range selection.
- **user-select prevention:** `user-select: none` is applied to the DataTable viewport element _only after_ a valid primary-button `pointerdown` on a selectable cell. It is synchronously removed on all termination paths: `pointerup`, `pointercancel`, `Escape`, `window blur`, owner-table switch, and component unmount.
- **Test coverage:** Unit tests must assert the `user-select` style is cleared after each termination path. Browser E2E verifies that normal text selection is re-enabled after drag completes (e.g., clicking an input or selecting page text outside the table works normally).

---

### Task 1: Browser preflight gate

**Type:** `infra`

**Files**

- Reference: `e2e/workspace-tabs-smoke.spec.ts`
- Reference: `playwright.config.ts`

**Shared Runtime Contracts**

- DataTable workspace-v2 browser fixture and local Vite startup.

**Invariants**

- Existing smoke behavior must pass before production code changes.

**Constraints**

- Must not edit application or test files to force the preflight green.
- Must stop and report if the existing browser fixture cannot start or `@workspace-v2` is already failing.

**Acceptance Criteria**

- [ ] `profile: browser-preflight` passes with zero failed tests.
- [ ] DataTable workspace-v2 page renders rows and supports its existing scroll assertions.

**Verification Profile**

- `profile: browser-preflight`
  - `pnpm test:e2e:smoke e2e/workspace-tabs-smoke.spec.ts --grep @workspace-v2`
- `Expected Signals:` build exits 0; Playwright reports zero failed tests for the selected workspace-v2 cases.

**Verification Strategy**

- `build + smoke`

**Browser Gate Role**

- `preflight`

- [ ] Step 1: Run `profile: browser-preflight` from the feature worktree before implementation.
- [ ] Step 2: Record exact pass count or blocking failure below the execution marker.
- [ ] Step 3: Continue only when the gate is green.

---

### Task 2: Pure coordinate range and clipboard model

**Type:** `behavior`

**Files**

- Create: `src/components/data-table/core/data-table-cell-range.ts`
- Create: `src/components/data-table/core/data-table-cell-range.test.ts`
- Reference: `src/components/data-table/core/use-data-table-cell-selection.ts`

**Dependencies**

- Task 1 browser preflight must pass.

**Shared Runtime Contracts**

- Stable row ID order, selectable visible column ID order, and column `meta.copyValue` clipboard semantics.

**Invariants**

- Row number, actions, and pinned columns remain outside the selectable column sequence.
- Range membership and TSV output are limited to current loaded rows and selectable visible columns.
- `copyValue` remains the highest-priority clipboard value source.

**Constraints**

- Must not import React or access DOM globals from the pure model.
- Must not create a Set containing every selected cell.
- Must not add public DataTable props.

**Acceptance Criteria**

- [ ] `profile: range-model-red` initially fails because range helpers do not exist or do not satisfy behavior.
- [ ] `profile: range-model-green` passes after minimal implementation.
- [ ] Tests cover forward/reverse normalization, membership, invalid endpoint detection, LTR/RTL keyboard movement, logical edges, TSV ordering, newline normalization, and copy-value fallback.

**Verification Profile**

- `profile: range-model-red`
  - `pnpm test:unit src/components/data-table/core/data-table-cell-range.test.ts`
- `profile: range-model-green`
  - `pnpm test:unit src/components/data-table/core/data-table-cell-range.test.ts`
- `Expected Signals:` RED reports missing behavior; GREEN reports one passing file and zero failed tests.

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: Add focused tests defining `DataTableCellCoordinate`, `DataTableCellRange`, normalized bounds, membership/edges, keyboard movement, and TSV serialization.
- [ ] Step 2: Run `profile: range-model-red` and confirm the failure is caused by missing feature behavior.
- [ ] Step 3: Implement the smallest pure helper API needed by the tests.
- [ ] Step 4: Run `profile: range-model-green` and confirm zero failures.
- [ ] Step 5: Refactor names and indexes without changing behavior; rerun `profile: range-model-green`.

---

### Task 3: Pointer selection, roving focus, keyboard expansion, and owner lifecycle

**Type:** `behavior`

**Files**

- Modify: `src/components/data-table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/data-table/core/data-table-body.tsx`
- Modify: `src/components/data-table/core/data-table.test.tsx`
- Use: `src/components/data-table/core/data-table-cell-range.ts`

**Dependencies**

- Task 2 range model must be green.

**Shared Runtime Contracts**

- DataTable cell copy owner broadcast, row expansion target exclusion, row/column virtualization rendering, current page row model, and roving cell focus.

**Invariants**

- Existing single-click selection and single-cell copy tests remain valid.
- Checkbox, button, link, input, row-number, actions, and pinned cells cannot start selection.
- Only the range owner responds to document copy; another DataTable clears the previous range.
- Only the focus cell is in the Tab sequence.

**Constraints**

- Must use pointer events and temporary listeners only during a real pointer sequence.
- Must use `elementsFromPoint + closest + geometric rendered-cell fallback` for pointer targeting.
- Must not retain invisible stale range when an endpoint leaves the current model.
- Must not add Ctrl/Cmd multi-range, fill handle, editing, paste, or cross-page selection.

**Acceptance Criteria**

- [ ] `profile: cell-interaction-red` fails on new drag/keyboard assertions before implementation.
- [ ] `profile: cell-interaction-green` passes all DataTable unit tests.
- [ ] Forward/reverse drag, Shift+click, arrow movement, Shift+arrow growth/shrink, Escape, pointercancel, window blur, TSV copy, multiple tables, and excluded targets are covered.
- [ ] RTL horizontal arrow mapping is covered.

**Verification Profile**

- `profile: cell-interaction-red`
  - `pnpm test:unit src/components/data-table/core/data-table.test.tsx`
- `profile: cell-interaction-green`
  - `pnpm test:unit src/components/data-table/core/data-table.test.tsx src/components/data-table/core/data-table-cell-range.test.ts`
- `Expected Signals:` RED fails only new selection assertions; GREEN reports both files passing with existing 70 tests plus new cases.

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: Extend the existing DataTable selection describe block with pointer, keyboard, owner, lifecycle, and TSV tests.
- [ ] Step 2: Run `profile: cell-interaction-red` and inspect the expected failures.
- [ ] Step 3: Replace single `activeCell` state with range state while preserving copy feedback behavior.
- [ ] Step 4: Pass current rows, selectable columns, and `scrollViewportRef` from `DataTableBody`; add stable cell data attributes and roving handlers.
- [ ] Step 5: Implement pointer targeting fallback and keyboard focus restoration.
- [ ] Step 6: Run `profile: cell-interaction-green`; fix implementation rather than weakening assertions.

---

### Task 4: Edge auto-scroll and virtualization coordination

**Type:** `behavior`

**Files**

- Create: `src/components/data-table/core/use-data-table-cell-auto-scroll.ts`
- Create: `src/components/data-table/core/use-data-table-cell-auto-scroll.test.ts`
- Modify: `src/components/data-table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/data-table/core/data-table-body.tsx`
- Modify: `src/components/data-table/core/data-table.test.tsx`

**Dependencies**

- Task 3 pointer and keyboard selection must be green.

**Shared Runtime Contracts**

- ScrollArea viewport ownership, row/column virtualizer mount timing, ancestor clipping, pointer targeting, RTL normalized horizontal scrolling, and hook cleanup.

**Invariants**

- Only the DataTable viewport scrolls; outer workspace/page containers never scroll because of cell selection.
- Pointerup, pointercancel, Escape, blur, and unmount synchronously stop the RAF loop.
- Pointer position and RAF identifiers stay in refs and do not cause per-frame unrelated React renders.

**Constraints**

- Must derive edge threshold and speed from focus-cell size with the reviewed clamps.
- Must intersect viewport rect with clipping ancestors and visual viewport.
- Must not poll or use timer-based scrolling.
- Must support simultaneous horizontal and vertical scrolling.

**Acceptance Criteria**

- [ ] `profile: auto-scroll-red` fails on speed, clipping, cleanup, and RTL assertions before implementation.
- [ ] `profile: auto-scroll-green` passes pure/hook and DataTable integration tests.
- [ ] Scroll continues to update focus through newly mounted virtual cells via re-hit-testing.

**Verification Profile**

- `profile: auto-scroll-red`
  - `pnpm test:unit src/components/data-table/core/use-data-table-cell-auto-scroll.test.ts src/components/data-table/core/data-table.test.tsx`
- `profile: auto-scroll-green`
  - `pnpm test:unit src/components/data-table/core/use-data-table-cell-auto-scroll.test.ts src/components/data-table/core/data-table.test.tsx src/components/data-table/core/data-table-cell-range.test.ts`
- `Expected Signals:` RED fails new auto-scroll assertions; GREEN reports all selected files passing and no leaked timer/listener warnings.

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: Add failing tests for effective visible rect intersection, dynamic threshold/speed, diagonal delta, scroll boundary, RTL normalization, and cleanup.
- [ ] Step 2: Run `profile: auto-scroll-red` and verify expected failures.
- [ ] Step 3: Implement pure auto-scroll calculations and one RAF-driven hook.
- [ ] Step 4: Integrate the hook with active drag state and post-scroll pointer re-hit-testing.
- [ ] Step 5: Run `profile: auto-scroll-green` and confirm zero failures.

---

### Task 5: Logical visuals, final regression, and dual-branch delivery

**Type:** `wiring`

**Files**

- Modify: `src/styles/globals.css` (range ::after border, cursor:cell, user-select lifecycle, focus ring)
- Create: `e2e/data-table-cell-range-selection.smoke.spec.ts`
- Modify: `src/components/data-table/core/data-table.test.tsx`
- Modify: `src/components/data-table/core/data-table-body.tsx` (pass range announcement to parent)
- Modify: `src/components/data-table/core/use-data-table-cell-selection.ts` (derive `rangeAnnouncement`)
- Modify: `src/components/data-table/core/data-table.tsx` (render sr-only aria-live region outside `<table>`)
- Verify: all runtime and test files listed in this plan.
- Read: `.agents/skills/oig-tanstack-admin/references/git-commits.md`
- Integrate: `main` worktree at `/Users/youdingte/learning/tanstack-start-admin`
- Integrate: `features/sso` worktree at `/Users/youdingte/learning/tanstack-start-admin-features-sso`

**Dependencies**

- Tasks 2-4 must be green.

**Shared Runtime Contracts**

- DataTable selection data attributes, row selection styling, pinned cell background, copy flash animation, column resize/DnD, row expand, ScrollArea, LTR/RTL rendering, cursor:cell on selectable data cells, user-select prevention lifecycle, and sr-only aria-live range announcement.
- Long-lived product branch policy: no whole-branch merge; the verified shared atomic commit is selectively cherry-picked.

**Invariants**

- Existing row selection and copy flash remain visible and semantically distinct.
- Range edges use logical directions and work in LTR and RTL.
- Drag selection temporarily disables user text selection and always restores it.
- No dependency version or unrelated formatting change is included.
- Existing uncommitted user changes in either target worktree are never overwritten.

**Constraints**

- Must reuse primary/theme variables and existing reduced-motion handling.
- Must not hard-code a second theme palette.
- Browser smoke must exercise real pointer drag and keyboard input, not only set data attributes.
- Must stop if either target worktree becomes dirty or its branch head changes incompatibly during implementation.
- Must run commitlint and hooks; must not merge `main` and `features/sso` or rewrite history.

**Acceptance Criteria**

- [ ] `profile: final-unit` passes all unit tests including `data-table.test.tsx` lifecycle coverage for user-select cleanup on pointerup, pointercancel, Escape, window blur, owner switch, and unmount.
- [ ] `profile: final-static` passes lint, typecheck, and formatting check for the repository.
- [ ] `profile: browser-regression` passes drag, keyboard, virtual auto-scroll, nested clipping, TSV copy, cleanup, RTL, pinned non-selectable, user-select restored after real pointer interaction, cursor:cell on data cells, and aria-live range announcement cases.
- [ ] `profile: final-diff` reports no whitespace errors or unintended dependency/lockfile changes.
- [ ] One responsibility-focused feature commit is integrated into `main` and selectively cherry-picked into `features/sso`.
- [ ] Targeted tests, lint, and typecheck pass independently in both long-lived branch worktrees.

**Verification Profile**

- `profile: final-unit`
  - `pnpm test:unit`
- `profile: final-static`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm format:check`
- `profile: browser-regression`
  - `pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2`
- `profile: final-diff`
  - `git diff --check`
  - `git status --short`
  - `git diff -- package.json pnpm-lock.yaml`
- `profile: commit-policy`
  - `pnpm lint:commit -- --from HEAD~1 --to HEAD`
- `profile: branch-main`
  - `pnpm test:unit src/components/data-table/core/data-table-cell-range.test.ts src/components/data-table/core/use-data-table-cell-auto-scroll.test.ts src/components/data-table/core/data-table.test.tsx`
  - `pnpm lint`
  - `pnpm typecheck`
- `profile: branch-sso`
  - `pnpm test:unit src/components/data-table/core/data-table-cell-range.test.ts src/components/data-table/core/use-data-table-cell-auto-scroll.test.ts src/components/data-table/core/data-table.test.tsx`
  - `pnpm lint`
  - `pnpm typecheck`
- `Expected Signals:` every command exits 0; Playwright reports zero failures; package and lockfile diff is empty; commitlint/hooks pass; both target worktrees report zero selected test, lint, and typecheck failures.

**Verification Strategy**

- `integration smoke`

**Browser Gate Role**

- `regression`

- [ ] Step 1: Add range ::after logical border, cursor:cell, user-select lifecycle, focus ring styles in globals.css; derive `rangeAnnouncement` from selection hook, lift via DataTableBody props, and render sr-only `aria-live="polite" aria-atomic="true"` region in DataTable outside the native `<table>` element.
- [ ] Step 2: Add unit tests in `data-table.test.tsx` covering user-select cleanup on pointerup, pointercancel, Escape, window blur, owner switch, and unmount.
- [ ] Step 3: Add Playwright cases for real drag, Shift keyboard selection, virtual edge auto-scroll, nested clipping, copy TSV, release cleanup, RTL, pinned non-selectable, user-select restored after real pointer interaction, and aria-live range announcement.
- [ ] Step 4: Run `profile: final-unit`, then `profile: final-static`.
- [ ] Step 5: Run `profile: browser-regression` and inspect all failures before changing code.
- [ ] Step 6: Run `profile: final-diff` and remove only feature-related formatting issues.
- [ ] Step 7: Re-read target branch status and Git commit rules; stop on unexpected dirty state.
- [ ] Step 8: Commit the atomic feature on `feat/cell-range-selection`, run `profile: commit-policy`, and keep hooks enabled.
- [ ] Step 9: Integrate the exact commit into `main` without a whole-branch merge and run `profile: branch-main`.
- [ ] Step 10: Cherry-pick the exact shared commit into `features/sso`; add a separate adaptation commit only if code differences require it.
- [ ] Step 11: Run `profile: branch-sso` and report both resulting commit IDs.

---

<!-- Execution appended below during runtime -->

### Task 1 Execution

- Result: pass
- Files changed: `e2e/support/mock-iam-session.ts`, `e2e/workspace-tabs-smoke.spec.ts`, `e2e/tags-bar-drag-sort.smoke.spec.ts`, `e2e/workspace-overlay-portal.smoke.spec.ts`; corrected this plan and the design spec to reference real e2e paths.
- Verification: `profile: browser-preflight` -> PASS (3 passed, 0 failed after successful build).
- Notes: The fresh worktree required ignored OpenAPI generated artifacts from the same `main` commit. The existing workspace smoke helper only mocked the removed SSO-era endpoint, so `main` now uses a test-only local IAM session helper that mocks refresh and `/auth/me`; production authentication is unchanged. This fixture change is main-specific and must not be included in the shared commit cherry-picked to `features/sso`.

### Task 2 Execution

- Result: pass
- Files changed: `src/components/data-table/core/data-table-cell-range.ts`, `src/components/data-table/core/data-table-cell-range.test.ts`.
- Verification: `profile: range-model-red` -> FAIL because the module did not exist; `profile: range-model-green` -> PASS (6 passed, 0 failed).
- Notes: The pure model stores only anchor/focus and row/column indexes; it does not materialize a selected-cell ID set and has no React or DOM dependency.

### Task 3 Execution

- Result: pass
- Files changed: `src/components/data-table/core/use-data-table-cell-selection.ts`, `src/components/data-table/core/data-table-body.tsx`, `src/components/data-table/core/data-table.test.tsx`.
- Verification: `profile: cell-interaction-red` -> FAIL (4 new failures, existing 70 passed); `profile: cell-interaction-green` -> PASS (80 passed, 0 failed across two files); `pnpm typecheck` -> PASS; `pnpm lint` -> PASS with 0 warnings.
- Notes: Pointer selection uses owner-scoped DOM targeting with geometric fallback, keyboard selection uses one roving tab stop, and clipboard serialization iterates the current row/column model in row-major order.

### Task 4 Execution

- Result: pass
- Files changed: `src/components/data-table/core/use-data-table-cell-auto-scroll.ts`, `src/components/data-table/core/use-data-table-cell-auto-scroll.test.ts`, `src/components/data-table/core/use-data-table-cell-selection.ts`, `src/components/data-table/core/data-table.test.tsx`.
- Verification: `profile: auto-scroll-red` -> FAIL because the module did not exist and the integration did not schedule RAF; `profile: auto-scroll-green` -> PASS (86 passed, 0 failed across three files); `pnpm typecheck` -> PASS; `pnpm lint` -> PASS with 0 warnings.
- Notes: One RAF loop scrolls only the DataTable viewport, uses effective clipping intersection and dynamic cell-size metrics, re-hit-tests after each frame, and stops on pointer completion or unmount.
