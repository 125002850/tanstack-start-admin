export function hasUserTextSelection(): boolean {
  const selection = document.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0);
}

export function isEditableCopyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('input, textarea, select')) return true;

  let element: HTMLElement | null = target;
  while (element) {
    if (element.isContentEditable || element.getAttribute('contenteditable') !== null) return true;
    element = element.parentElement;
  }
  return false;
}
