import type { WorkspaceTabId } from '../types';
import {
  closeRegisteredWorkspaceOverlays,
  resetWorkspaceOverlayRegistry
} from './workspace-overlay-registry';

const WORKSPACE_OVERLAY_SETTLE_TIMEOUT_MS = 500;
const WORKSPACE_OVERLAY_CLOSE_RETRY_MS = 40;
const WORKSPACE_OVERLAY_MAX_CLOSE_ATTEMPTS = 8;

export type WorkspaceOverlayDismissResult = {
  hasPendingExit: boolean;
  waitForSettled: () => Promise<void>;
};

export type WorkspacePageOverlaySnapshot = {
  readonly tabId: WorkspaceTabId;
};

type WorkspacePageOverlayTargets = {
  root: HTMLElement | undefined;
  ownerDocument: Document;
  triggerTargets: Set<HTMLElement>;
  contentTargets: Set<HTMLElement>;
  controlledContentIds: Set<string>;
};

const settledDismissResult: WorkspaceOverlayDismissResult = {
  hasPendingExit: false,
  waitForSettled: () => Promise.resolve()
};

const pageOverlayRoots = new Map<WorkspaceTabId, HTMLElement>();
let pageOverlaySnapshots = new WeakMap<WorkspacePageOverlaySnapshot, WorkspacePageOverlayTargets>();

const OPEN_TRIGGER_SELECTOR = [
  '[data-slot="alert-dialog-trigger"][data-state="open"]',
  '[data-slot="context-menu-sub-trigger"][data-state="open"]',
  '[data-slot="dialog-trigger"][data-state="open"]',
  '[data-slot="drawer-trigger"][data-state="open"]',
  '[data-slot="dropdown-menu-sub-trigger"][data-state="open"]',
  '[data-slot="dropdown-menu-trigger"][data-state="open"]',
  '[data-slot="hover-card-trigger"][data-state="open"]',
  '[data-slot="menubar-sub-trigger"][data-state="open"]',
  '[data-slot="menubar-trigger"][data-state="open"]',
  '[data-slot="popover-trigger"][data-state="open"]',
  '[data-slot="select-trigger"][data-state="open"]',
  '[data-slot="sheet-trigger"][data-state="open"]',
  '[data-slot="combobox-trigger"][aria-expanded="true"]',
  '[aria-haspopup][aria-expanded="true"]',
  // Radix Tooltip data-state 是 "delayed-open" / "instant-open"，不是 "open"
  '[data-slot="tooltip-trigger"][data-state]:not([data-state="closed"])'
].join(',');

const OPEN_CONTENT_SELECTOR = [
  '[data-slot="alert-dialog-content"][data-state="open"]',
  '[data-slot="context-menu-content"][data-state="open"]',
  '[data-slot="context-menu-sub-content"][data-state="open"]',
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="drawer-content"][data-state="open"]',
  '[data-slot="sheet-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[data-slot="hover-card-content"][data-state="open"]',
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="dropdown-menu-sub-content"][data-state="open"]',
  '[data-slot="menubar-content"][data-state="open"]',
  '[data-slot="menubar-sub-content"][data-state="open"]',
  '[data-slot="select-content"][data-state="open"]',
  '[data-slot="tooltip-content"][data-state]:not([data-state="closed"])',
  '[data-slot="data-table-cell-tooltip-content"][data-state]:not([data-state="closed"])',
  '[data-slot="combobox-content"][data-open]',
  '[role="dialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[role="tooltip"][data-state]:not([data-state="closed"])'
].join(',');

// 真实鼠标切换时，Radix 会在 workspace tab 的 click 之前通过 pointerdown outside
// 先把非模态 Portal 标为 closed。此时它仍在 Presence 的退出动画中，必须继续等待卸载。
const EXITING_CONTENT_SELECTOR = [
  '[data-slot="alert-dialog-content"][data-state="closed"]',
  '[data-slot="context-menu-content"][data-state="closed"]',
  '[data-slot="context-menu-sub-content"][data-state="closed"]',
  '[data-slot="dialog-content"][data-state="closed"]',
  '[data-slot="drawer-content"][data-state="closed"]',
  '[data-slot="sheet-content"][data-state="closed"]',
  '[data-slot="popover-content"][data-state="closed"]',
  '[data-slot="hover-card-content"][data-state="closed"]',
  '[data-slot="dropdown-menu-content"][data-state="closed"]',
  '[data-slot="dropdown-menu-sub-content"][data-state="closed"]',
  '[data-slot="menubar-content"][data-state="closed"]',
  '[data-slot="menubar-sub-content"][data-state="closed"]',
  '[data-slot="select-content"][data-state="closed"]',
  '[data-slot="combobox-content"][data-closed]'
].join(',');

const TRACKED_CONTENT_SELECTOR = [OPEN_CONTENT_SELECTOR, EXITING_CONTENT_SELECTOR].join(',');

const SETTLED_CONNECTED_CONTENT_SELECTOR = [
  '[data-slot="tooltip-content"][data-state="closed"]',
  '[data-slot="data-table-cell-tooltip-content"][data-state="closed"]'
].join(',');

const OVERLAY_CLOSE_SELECTOR = [
  '[data-workspace-overlay-close]',
  '[data-slot="alert-dialog-cancel"]',
  '[data-slot="dialog-close"]',
  '[data-slot="drawer-close"]',
  '[data-slot="sheet-close"]'
].join(',');

export function registerWorkspacePageOverlayRoot(tabId: WorkspaceTabId, root: HTMLElement) {
  pageOverlayRoots.set(tabId, root);

  return () => {
    if (pageOverlayRoots.get(tabId) === root) {
      pageOverlayRoots.delete(tabId);
    }
  };
}

export function captureWorkspacePageOverlays(
  tabId: WorkspaceTabId | null
): WorkspacePageOverlaySnapshot | null {
  if (!tabId) return null;

  const targets = collectWorkspacePageOverlayTargets(tabId, OPEN_CONTENT_SELECTOR);
  if (!targets || overlayTargetsEmpty(targets)) return null;

  const snapshot: WorkspacePageOverlaySnapshot = { tabId };
  pageOverlaySnapshots.set(snapshot, targets);
  return snapshot;
}

export function dismissWorkspacePageOverlays(
  tabId: WorkspaceTabId | null,
  snapshot?: WorkspacePageOverlaySnapshot | null
) {
  if (!tabId) return settledDismissResult;

  // 第一层：显式注册的浮层同步关闭（不依赖 DOM 契约，不等待动画）。
  // 必须放在 snapshot === null 提前返回之前——注册表覆盖自定义浮层，
  // 它们可能不在 DOM 扫描的选择器里。
  const registeredCount = closeRegisteredWorkspaceOverlays(tabId);

  // null 表示 pointerdown 已完成捕获且当时没有 overlay；undefined 才表示未捕获入口，
  // 需要保留全局扫描作为键盘、侧栏导航和程序调用的兼容兜底。
  if (snapshot === null) return settledDismissResult;

  const capturedTargets =
    snapshot?.tabId === tabId ? pageOverlaySnapshots.get(snapshot) : undefined;
  if (snapshot) pageOverlaySnapshots.delete(snapshot);
  return dismissWorkspacePageDomOverlays(tabId, capturedTargets, registeredCount === 0);
}

export function resetWorkspacePageOverlays() {
  pageOverlayRoots.clear();
  pageOverlaySnapshots = new WeakMap();
  warnedUnregisteredOverlayTabs.clear();
  resetWorkspaceOverlayRegistry();
}

const warnedUnregisteredOverlayTabs = new Set<WorkspaceTabId>();

function dismissWorkspacePageDomOverlays(
  tabId: WorkspaceTabId,
  capturedTargets?: WorkspacePageOverlayTargets,
  warnUnregistered = false
): WorkspaceOverlayDismissResult {
  const targets = capturedTargets
    ? cloneWorkspacePageOverlayTargets(tabId, capturedTargets)
    : collectWorkspacePageOverlayTargets(tabId, TRACKED_CONTENT_SELECTOR);
  if (!targets || overlayTargetsEmpty(targets)) return settledDismissResult;

  if (warnUnregistered && isDev() && !warnedUnregisteredOverlayTabs.has(tabId)) {
    // 该 tab 一个浮层都没注册，DOM 里却有开着的浮层 → 有浮层漏接入 useWorkspaceOverlay。
    // 只警告当前仍处于 open 状态的目标，避免退出动画中的 closed 内容误报；
    // 每个 tab 每次会话只提醒一次，防止切换流程中重复刷屏。
    const hasOpenTargets = [...targets.triggerTargets, ...targets.contentTargets].some(
      (target) =>
        target.isConnected &&
        (target.matches(OPEN_TRIGGER_SELECTOR) || target.matches(OPEN_CONTENT_SELECTOR))
    );
    if (hasOpenTargets) {
      warnedUnregisteredOverlayTabs.add(tabId);
      // oxlint-disable-next-line no-console -- dev-only diagnostic
      console.warn(
        `[workspace] tab "${tabId}" 存在未通过 useWorkspaceOverlay 注册的浮层，` +
          '已由 DOM 兜底关闭。建议为对应浮层接入 useWorkspaceOverlay(open, close)。'
      );
    }
  }

  const { root, ownerDocument, triggerTargets, contentTargets, controlledContentIds } = targets;
  const discoverOpenTargets = capturedTargets === undefined;

  requestOverlayClose(
    ownerDocument,
    root,
    triggerTargets,
    contentTargets,
    controlledContentIds,
    false,
    discoverOpenTargets
  );

  if (overlayTargetsSettled(ownerDocument, triggerTargets, contentTargets, controlledContentIds)) {
    return settledDismissResult;
  }

  const settledPromise = waitForOverlayTargetsSettled(
    ownerDocument,
    root,
    triggerTargets,
    contentTargets,
    controlledContentIds,
    discoverOpenTargets
  );

  return {
    hasPendingExit: true,
    waitForSettled: () => settledPromise
  };
}

function collectWorkspacePageOverlayTargets(
  tabId: WorkspaceTabId,
  contentSelector: string
): WorkspacePageOverlayTargets | null {
  const root = pageOverlayRoots.get(tabId);
  const ownerDocument = root?.ownerDocument ?? getBrowserDocument();
  if (!ownerDocument) return null;

  // Trigger 关闭后仍会留在页面里；Portal content 则可能以 closed 状态继续执行退出动画。
  // 分开跟踪，避免把 data-state=closed 误判成 Portal 已经完成卸载。
  const triggerTargets = new Set<HTMLElement>();
  const contentTargets = new Set<HTMLElement>();
  const controlledContentIds = new Set<string>();

  if (root?.isConnected) {
    const openTriggers = collectHtmlElements(root, OPEN_TRIGGER_SELECTOR);
    for (const trigger of openTriggers) {
      triggerTargets.add(trigger);
      collectControlledContent(trigger, ownerDocument, controlledContentIds, contentTargets);
    }
  }

  for (const content of collectHtmlElements(ownerDocument, contentSelector)) {
    contentTargets.add(content);
    if (content.id) controlledContentIds.add(content.id);
  }

  for (const contentId of controlledContentIds) {
    collectControlledContentById(contentId, ownerDocument, contentTargets);
  }

  return {
    root,
    ownerDocument,
    triggerTargets,
    contentTargets,
    controlledContentIds
  };
}

function cloneWorkspacePageOverlayTargets(
  tabId: WorkspaceTabId,
  capturedTargets: WorkspacePageOverlayTargets
): WorkspacePageOverlayTargets {
  return {
    root: pageOverlayRoots.get(tabId) ?? capturedTargets.root,
    ownerDocument: capturedTargets.ownerDocument,
    triggerTargets: new Set(capturedTargets.triggerTargets),
    contentTargets: new Set(capturedTargets.contentTargets),
    controlledContentIds: new Set(capturedTargets.controlledContentIds)
  };
}

function overlayTargetsEmpty(targets: WorkspacePageOverlayTargets) {
  return (
    targets.triggerTargets.size === 0 &&
    targets.contentTargets.size === 0 &&
    targets.controlledContentIds.size === 0
  );
}

function collectHtmlElements(root: ParentNode, selector: string) {
  const ownerDocument = getOwnerDocument(root);
  const win = ownerDocument?.defaultView;
  if (!win) return [];

  return Array.from(root.querySelectorAll(selector)).filter(
    (element): element is HTMLElement => element instanceof win.HTMLElement
  );
}

function dispatchClosePointerSequence(element: HTMLElement) {
  const ownerDocument = element.ownerDocument;
  dispatchPointerEvent(element, 'pointerdown', ownerDocument, 1);
  dispatchMouseEvent(element, 'mousedown', ownerDocument, 1);
  dispatchPointerEvent(element, 'pointerup', ownerDocument, 0);
  dispatchMouseEvent(element, 'mouseup', ownerDocument, 0);
  dispatchMouseEvent(element, 'click', ownerDocument, 0);
  // pointerleave 不冒泡，React 事件代理无法捕获，直接派发到 trigger 上
  // 这是关闭 Radix Tooltip / Popover 的关键事件（它们依赖 pointerleave 而非 click）
  dispatchHoverLeaveEvent(element, 'pointerleave', ownerDocument);
  dispatchHoverLeaveEvent(element, 'mouseleave', ownerDocument);
}

function dispatchHoverLeaveSequence(element: HTMLElement) {
  const ownerDocument = element.ownerDocument;
  dispatchHoverLeaveEvent(element, 'pointerleave', ownerDocument);
  dispatchHoverLeaveEvent(element, 'mouseleave', ownerDocument);
}

function dispatchHoverLeaveEvent(
  target: EventTarget,
  type: 'pointerleave' | 'mouseleave',
  ownerDocument: Document
) {
  const win = ownerDocument.defaultView;
  if (!win) return;

  const EventCtor = type === 'pointerleave' ? (win.PointerEvent ?? win.MouseEvent) : win.MouseEvent;
  target.dispatchEvent(
    new EventCtor(type, {
      bubbles: false,
      cancelable: true,
      composed: true,
      ...(type === 'pointerleave' ? { pointerId: 1, pointerType: 'mouse' as const } : {})
    })
  );
}

function dispatchPointerEvent(
  target: EventTarget,
  type: 'pointerdown' | 'pointerup',
  ownerDocument: Document,
  buttons: number
) {
  const win = ownerDocument.defaultView;
  if (!win) return;

  const init = {
    bubbles: true,
    button: 0,
    buttons,
    cancelable: true,
    composed: true,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'mouse'
  };

  const EventCtor = win.PointerEvent ?? win.MouseEvent;
  target.dispatchEvent(new EventCtor(type, init));
}

function dispatchMouseEvent(
  target: EventTarget,
  type: 'mousedown' | 'mouseup' | 'click',
  ownerDocument: Document,
  buttons: number
) {
  const win = ownerDocument.defaultView;
  if (!win) return;

  target.dispatchEvent(
    new win.MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons,
      cancelable: true,
      composed: true
    })
  );
}

function dispatchEscape(target: EventTarget, ownerDocument: Document) {
  const win = ownerDocument.defaultView;
  if (!win) return;

  target.dispatchEvent(
    new win.KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Escape',
      composed: true,
      key: 'Escape'
    })
  );
}

function collectControlledContent(
  trigger: HTMLElement,
  ownerDocument: Document,
  controlledContentIds: Set<string>,
  pendingTargets: Set<HTMLElement>
) {
  for (const attribute of ['aria-controls', 'aria-describedby']) {
    const contentIds = trigger.getAttribute(attribute)?.split(/\s+/).filter(Boolean) ?? [];
    for (const contentId of contentIds) {
      controlledContentIds.add(contentId);
      collectControlledContentById(contentId, ownerDocument, pendingTargets);
    }
  }
}

function collectControlledContentById(
  contentId: string,
  ownerDocument: Document,
  pendingTargets: Set<HTMLElement>
) {
  const controlledContent = ownerDocument.getElementById(contentId);
  const win = ownerDocument.defaultView;
  if (win && controlledContent instanceof win.HTMLElement) {
    pendingTargets.add(controlledContent);
  }
}

function waitForOverlayTargetsSettled(
  ownerDocument: Document,
  root: HTMLElement | undefined,
  triggerTargets: Set<HTMLElement>,
  contentTargets: Set<HTMLElement>,
  controlledContentIds: Set<string>,
  discoverOpenTargets: boolean
) {
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    const win = ownerDocument.defaultView;
    const Observer = win?.MutationObserver;
    let attempts = 1;
    let settled = false;
    let checkScheduled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const observer = Observer
      ? new Observer(() => {
          scheduleCheck();
        })
      : null;

    const finish = () => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      resolve();
    };

    const check = () => {
      checkScheduled = false;
      if (settled) return;

      if (
        overlayTargetsSettled(ownerDocument, triggerTargets, contentTargets, controlledContentIds)
      ) {
        finish();
        return;
      }

      if (Date.now() - startedAt >= WORKSPACE_OVERLAY_SETTLE_TIMEOUT_MS) {
        finish();
        return;
      }

      if (attempts < WORKSPACE_OVERLAY_MAX_CLOSE_ATTEMPTS) {
        requestOverlayClose(
          ownerDocument,
          root,
          triggerTargets,
          contentTargets,
          controlledContentIds,
          attempts > 1,
          discoverOpenTargets
        );
        attempts += 1;
      }

      retryTimer = setTimeout(scheduleCheck, WORKSPACE_OVERLAY_CLOSE_RETRY_MS);
    };

    function scheduleCheck() {
      if (settled || checkScheduled) return;
      checkScheduled = true;
      scheduleNextFrame(ownerDocument, check);
    }

    observer?.observe(ownerDocument.documentElement, {
      attributeFilter: ['aria-expanded', 'data-open', 'data-state'],
      attributes: true,
      childList: true,
      subtree: true
    });
    scheduleCheck();
  });
}

function requestOverlayClose(
  ownerDocument: Document,
  root: HTMLElement | undefined,
  triggerTargets: Set<HTMLElement>,
  contentTargets: Set<HTMLElement>,
  controlledContentIds: Set<string>,
  allowFallback: boolean,
  discoverOpenTargets: boolean
) {
  if (discoverOpenTargets && root?.isConnected) {
    for (const trigger of collectHtmlElements(root, OPEN_TRIGGER_SELECTOR)) {
      triggerTargets.add(trigger);
      collectControlledContent(trigger, ownerDocument, controlledContentIds, contentTargets);
    }
  }

  const openTriggers = [...triggerTargets].filter(
    (target) => target.isConnected && target.matches(OPEN_TRIGGER_SELECTOR)
  );

  for (const trigger of openTriggers) {
    dispatchHoverLeaveSequence(trigger);
    collectControlledContent(trigger, ownerDocument, controlledContentIds, contentTargets);
  }

  if (discoverOpenTargets) {
    for (const content of collectHtmlElements(ownerDocument, OPEN_CONTENT_SELECTOR)) {
      contentTargets.add(content);
      if (content.id) controlledContentIds.add(content.id);
    }
  }

  const openContents = [...contentTargets].filter(
    (content) => content.isConnected && content.matches(OPEN_CONTENT_SELECTOR)
  );

  const topContent = openContents.at(-1);
  const activeElement = ownerDocument.activeElement;
  const win = ownerDocument.defaultView;
  const escapeTarget =
    win && activeElement instanceof win.HTMLElement && topContent?.contains(activeElement)
      ? activeElement
      : (topContent ?? ownerDocument);

  dispatchEscape(escapeTarget, ownerDocument);

  if (!allowFallback || !topContent?.matches(OPEN_CONTENT_SELECTOR)) return;

  const closeControl = topContent.querySelector<HTMLElement>(OVERLAY_CLOSE_SELECTOR);
  if (closeControl) {
    dispatchClosePointerSequence(closeControl);
    return;
  }

  const controlledTrigger = findControlledTrigger(openTriggers, topContent.id);
  const fallbackTrigger = controlledTrigger ?? openTriggers.at(-1);
  if (fallbackTrigger?.matches(OPEN_TRIGGER_SELECTOR)) {
    dispatchClosePointerSequence(fallbackTrigger);
  }
}

function findControlledTrigger(openTriggers: HTMLElement[], contentId: string) {
  if (!contentId) return undefined;

  return openTriggers.find((trigger) =>
    ['aria-controls', 'aria-describedby'].some((attribute) =>
      (trigger.getAttribute(attribute)?.split(/\s+/) ?? []).includes(contentId)
    )
  );
}

function overlayTargetsSettled(
  ownerDocument: Document,
  triggerTargets: Set<HTMLElement>,
  contentTargets: Set<HTMLElement>,
  controlledContentIds: Set<string>
) {
  for (const trigger of triggerTargets) {
    if (trigger.isConnected && trigger.matches(OPEN_TRIGGER_SELECTOR)) return false;
  }

  for (const content of contentTargets) {
    if (content.isConnected && !content.matches(SETTLED_CONNECTED_CONTENT_SELECTOR)) return false;
  }

  for (const id of controlledContentIds) {
    const element = ownerDocument.getElementById(id);
    if (element?.isConnected && !element.matches(SETTLED_CONNECTED_CONTENT_SELECTOR)) return false;
  }

  return true;
}

function scheduleNextFrame(ownerDocument: Document, callback: () => void) {
  const win = ownerDocument.defaultView;
  if (win?.requestAnimationFrame) {
    win.requestAnimationFrame(() => callback());
    return;
  }

  setTimeout(callback, 16);
}

function getBrowserDocument() {
  return typeof document === 'undefined' ? null : document;
}

function isDev(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (import.meta.env as Record<string, unknown>).DEV === true;
    }
  } catch {
    // import.meta unavailable
  }
  return false;
}

function getOwnerDocument(root: ParentNode) {
  const fallbackDocument = getBrowserDocument();
  if (!fallbackDocument) return null;

  if (root === fallbackDocument) return fallbackDocument;
  const win = fallbackDocument.defaultView;
  if (win && root instanceof win.Element) return root.ownerDocument;
  return fallbackDocument;
}
