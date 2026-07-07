import type { WorkspaceTabId } from '../types';

const WORKSPACE_OVERLAY_SETTLE_TIMEOUT_MS = 500;

export type WorkspaceOverlayDismissResult = {
  hasPendingExit: boolean;
  waitForSettled: () => Promise<void>;
};

const settledDismissResult: WorkspaceOverlayDismissResult = {
  hasPendingExit: false,
  waitForSettled: () => Promise.resolve()
};

const pageOverlayRoots = new Map<WorkspaceTabId, HTMLElement>();

const OPEN_TRIGGER_SELECTOR = [
  '[aria-expanded="true"]',
  '[data-slot$="-trigger"][data-state="open"]',
  '[data-slot="combobox-trigger"][data-open]'
].join(',');

const OPEN_CONTENT_SELECTOR = [
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="sheet-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="dropdown-menu-sub-content"][data-state="open"]',
  '[data-slot="select-content"][data-state="open"]',
  '[data-slot="tooltip-content"][data-state]:not([data-state="closed"])',
  '[data-slot="data-table-cell-tooltip-content"][data-state]:not([data-state="closed"])',
  '[data-slot="combobox-content"][data-open]',
  '[role="dialog"][data-state="open"]',
  '[role="menu"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[role="tooltip"][data-state]:not([data-state="closed"])'
].join(',');

const CONTROLLED_TRIGGER_SELECTOR = '[aria-controls]';

export function registerWorkspacePageOverlayRoot(tabId: WorkspaceTabId, root: HTMLElement) {
  pageOverlayRoots.set(tabId, root);

  return () => {
    if (pageOverlayRoots.get(tabId) === root) {
      pageOverlayRoots.delete(tabId);
    }
  };
}

export function dismissWorkspacePageOverlays(tabId: WorkspaceTabId | null) {
  if (!tabId) return settledDismissResult;
  return dismissWorkspacePageDomOverlays(tabId);
}

export function resetWorkspacePageOverlays() {
  pageOverlayRoots.clear();
}

function dismissWorkspacePageDomOverlays(tabId: WorkspaceTabId): WorkspaceOverlayDismissResult {
  const root = pageOverlayRoots.get(tabId);
  const ownerDocument = root?.ownerDocument ?? getBrowserDocument();
  if (!ownerDocument) return settledDismissResult;

  const pendingTargets = new Set<HTMLElement>();
  const controlledContentIds = new Set<string>();

  if (root?.isConnected) {
    const controlledTriggers = collectHtmlElements(root, CONTROLLED_TRIGGER_SELECTOR);
    for (const trigger of controlledTriggers) {
      collectControlledContent(trigger, ownerDocument, controlledContentIds, pendingTargets);
    }

    const openTriggers = collectHtmlElements(root, OPEN_TRIGGER_SELECTOR);
    for (const trigger of openTriggers) {
      collectControlledContent(trigger, ownerDocument, controlledContentIds, pendingTargets);
      dispatchClosePointerSequence(trigger);
    }
  }

  const escapeTargets = new Set<EventTarget>();
  const activeElement = ownerDocument.activeElement;
  const win = ownerDocument.defaultView;
  if (win && activeElement instanceof win.HTMLElement) {
    escapeTargets.add(activeElement);
  }

  for (const content of collectHtmlElements(ownerDocument, OPEN_CONTENT_SELECTOR)) {
    pendingTargets.add(content);
    if (content.id) controlledContentIds.add(content.id);
    escapeTargets.add(content);
  }

  escapeTargets.add(ownerDocument);
  escapeTargets.add(ownerDocument.body);

  for (const target of escapeTargets) {
    dispatchEscape(target, ownerDocument);
  }

  for (const contentId of controlledContentIds) {
    collectControlledContentById(contentId, ownerDocument, pendingTargets);
  }

  if (pendingTargets.size === 0 && controlledContentIds.size === 0) {
    return settledDismissResult;
  }

  return {
    hasPendingExit: true,
    waitForSettled: () =>
      waitForOverlayTargetsSettled(ownerDocument, pendingTargets, controlledContentIds)
  };
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
  const contentId = trigger.getAttribute('aria-controls');
  if (!contentId) return;

  controlledContentIds.add(contentId);
  collectControlledContentById(contentId, ownerDocument, pendingTargets);
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
  targets: Set<HTMLElement>,
  controlledContentIds: Set<string>
) {
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    const check = () => {
      if (overlayTargetsSettled(ownerDocument, targets, controlledContentIds)) {
        resolve();
        return;
      }

      if (Date.now() - startedAt >= WORKSPACE_OVERLAY_SETTLE_TIMEOUT_MS) {
        resolve();
        return;
      }

      scheduleNextFrame(ownerDocument, check);
    };

    scheduleNextFrame(ownerDocument, check);
  });
}

function overlayTargetsSettled(
  ownerDocument: Document,
  targets: Set<HTMLElement>,
  controlledContentIds: Set<string>
) {
  for (const target of targets) {
    if (target.isConnected) return false;
  }

  for (const id of controlledContentIds) {
    const element = ownerDocument.getElementById(id);
    if (element?.isConnected) return false;
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

function getOwnerDocument(root: ParentNode) {
  const fallbackDocument = getBrowserDocument();
  if (!fallbackDocument) return null;

  if (root === fallbackDocument) return fallbackDocument;
  const win = fallbackDocument.defaultView;
  if (win && root instanceof win.Element) return root.ownerDocument;
  return fallbackDocument;
}
