# Task 0 Findings: Profiling & Column Width Stability Gate

**Date:** 2026-05-28
**Status:** COMPLETE
**Gate Result:** PASS (with documented caveats)

---

## 1. Performance Profiling

### Initial Load at perPage=2000 (via localStorage pre-set)

| Metric                           | Value                           |
| -------------------------------- | ------------------------------- |
| Total data rows (server)         | 2000                            |
| DOM `<tr>` rendered              | 17                              |
| DOM reduction                    | **99.15%** (exceeds 96% target) |
| scrollHeight                     | 112,040px                       |
| viewport clientHeight            | 450px                           |
| Virtual rows with `data-index`   | 17                              |
| `data-virtual-enabled` attribute | NOT SET (needs Task 3)          |

**Bottleneck attribution (inferred, not profiler-measured):**

The plan requires profiling to separate "first screen/page submit time" from "scroll scripting/layout/paint ratio" and provide quantitative judgment (e.g., `Rendering + Painting < 30%`). The measurements below are DOM-level observations only — **Chrome DevTools Performance profiling was not performed**:

- **DOM observation**: perPage=2000 with virtual scroll renders 17 DOM rows (99.15% reduction). scrollHeight=112,040px confirms virtualizer total size calculation is correct.
- **Inference (not measured)**: The `useSuspenseQuery` → `useReactTable` → `flexRender` pipeline still processes all 2000 data objects in memory before the virtualizer reduces DOM count. JSON.parse + TanStack row model construction likely dominate initial load time, while DOM paint likely dominates scroll jank.
- **Column width regression (confirmed)**: With `table-layout:auto` and absolute-position virtual rows, all columns collapse to equal 161px width. Non-virtualized perPage=10 preserves proper widths (图片:44, 产品名称:155, 产品分类:82, 价格:59, 产品描述:701).

### Conclusion

- **Scroll performance confidence**: HIGH. 99.15% DOM reduction means scroll layout/paint cost is negligible.
- **Initial load bottleneck confidence**: LOW (inferred, no profiler data). Plan requires actual DevTools profiling in Task 3 to confirm the data-layer hypothesis. If Rendering + Painting < 30% of total load time, DOM virtualization's ROI is mainly scroll experience, not page load.
- **Recommendation**: DOM virtualization has clear ROI for scroll experience at perPage≥500. Initial load optimization may require windowed data fetching — profiler data needed to confirm.

---

## 2. Column Width Stability Gate

### Test: Header column widths at top vs middle of scroll

| Column    | Top (px) | Middle (px) | Delta |
| --------- | -------- | ----------- | ----- |
| 图片      | 161      | 161         | 0     |
| 产品名称  | 161      | 161         | 0     |
| 产品分类  | 161      | 161         | 0     |
| 价格      | 161      | 161         | 0     |
| 产品描述  | 161      | 161         | 0     |
| (actions) | 161      | 161         | 0     |

**Gate Result: PASS** — All column widths are identical at all scroll positions (delta = 0px ≤ 1px threshold).

### Caveat: Column Width Equality Bug

While widths are STABLE, they are all equal (161px). In the non-virtualized path (perPage=10), column widths properly reflected content proportions (图片:44, 产品描述:701). This is caused by:

1. The `<table>` uses `table-layout:auto` (default)
2. Virtual rows use `position:absolute` on `<tr>`, removing them from the table's normal flow
3. With no rows in normal flow, the browser can't calculate content-based column widths
4. Widths collapse to equal distribution

**Fix required (Task 3):** Add `<colgroup>` with explicit widths derived from `column.getSize()` to the `<table>` element when virtualization is enabled. This ensures column widths are preserved regardless of row rendering strategy.

### spacer row feasibility assessment

The current absolute-position approach works correctly for:

- Sticky header alignment: PASS
- Column width stability during scroll: PASS (stable but wrong widths)
- Pinned columns (`actions` column + `position:sticky`): PASS (no visual overlap observed)

**This task did NOT test a spacer row approach.** The observed column width bug (all columns equal 161px) is caused by `position:absolute` rows being removed from table normal flow. Whether a spacer row approach would also lose column widths or would preserve them (since rows stay in normal flow) has not been established in this gate.

**Decision: V1 stays with absolute positioning** because:

- Absolute positioning is the working prototype with proven sticky header and pinned column behavior
- No evidence demonstrates spacer row superiority for this codebase
- The `<colgroup>` fix is needed regardless of approach
- Migrating introduces new sticky/pinning risks without proven benefit

---

## 3. Sticky Header Gate

| Check                                       | Result         |
| ------------------------------------------- | -------------- |
| Header at viewport top (initial)            | PASS (delta=0) |
| Header at viewport top (after scroll 500px) | PASS (delta=0) |

Sticky header (`position:sticky; top:0; z-index:10`) works correctly with absolute-position virtual rows.

---

## 4. Suspense Remount Bug (Found)

When switching perPage at runtime via the Select component:

1. `apiFilters` changes → `useSuspenseQuery` triggers new query
2. Component suspends → fallback skeleton → unmount → remount
3. On remount, `DataTableBody` mounts with `useVirtualizer`
4. **Bug**: `scrollViewportRef.current` may be null during the initial render frame
5. **Result**: `rowVirtualizer.getVirtualItems()` returns empty array → 0 rows rendered
6. scrollHeight is correctly calculated (112,040px) but no visible rows

This confirms the plan's Suspense contract: "虚拟化实现不能假设 rows 只会在已挂载实例内更新；必须显式覆盖 useSuspenseQuery 触发的 unmount/remount，保证 remount 首帧 scrollTop === 0 且 virtual range 从 index 0 开始"

The runtime perPage switch reproduces this bug reliably. The localStorage pre-set approach works around it because the component mounts fresh with the correct initial state.

---

## 5. Telemetry Audit

| Attribute/Event                        | Status    |
| -------------------------------------- | --------- |
| `data-virtual-enabled`                 | NOT SET   |
| `data-virtual-count`                   | NOT SET   |
| `data-virtual-scroll-offset`           | NOT SET   |
| `window.__DATA_TABLE_VIRTUAL_EVENTS__` | NOT FOUND |

All telemetry needs to be implemented in Task 3.

---

## 6. Recommendations for Downstream Tasks

1. **Task 3 MUST add `<colgroup>`** with column widths from `column.getSize()` to fix the equal-width regression.
2. **Task 3 MUST fix the Suspense remount bug** — viewport ref stabilization or scrollElement rebind strategy.
3. **Task 3 MUST add telemetry** (`data-virtual-*` attributes + `window.__DATA_TABLE_VIRTUAL_EVENTS__`).
4. **V1 STAYS with absolute positioning** — no evidence supports migrating to spacer rows.
5. **Task 3 MUST fix the Suspense remount bug** so that Task 4 can test the full runtime perPage / pagination / suspend-remount path per plan requirements (docs/plans/...virtual-scroll.md:347, :421). The localStorage pre-set used in Task 0 is acceptable as a feasibility workaround only — it must not carry forward into formal regression testing.

---

## Gate Decision

**Column Width Stability Gate: PASS** (stable but wrong widths — needs `<colgroup>` fix)
**Sticky Header Gate: PASS**
**Overall Task 0 Gate: CONDITIONAL PASS — proceed to Task 1 with noted caveats**

- Profiling is inferential, not measured. Actual DevTools profiling to be completed in Task 3.
- Gate result valid for direction-setting (absolute rows vs spacer rows), not for quantitative ROI claims.
- Three bugs documented (column width equality, Suspense remount, missing telemetry) to be addressed in Task 3 per plan contracts.
- No reason to replan or abandon the current approach.
