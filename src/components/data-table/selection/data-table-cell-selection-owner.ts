const DATA_TABLE_CELL_SELECTION_CHANGE_EVENT = 'data-table-cell-selection-change';

type DataTableCellSelectionChangeDetail = {
  owner: symbol | null;
};

let activeCellSelectionOwner: symbol | null = null;

function emitDataTableCellSelectionChange(owner: symbol | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DataTableCellSelectionChangeDetail>(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, {
      detail: { owner }
    })
  );
}

export function activateDataTableCellSelectionOwner(owner: symbol) {
  activeCellSelectionOwner = owner;
  emitDataTableCellSelectionChange(owner);
}

export function clearDataTableCellSelectionOwner() {
  activeCellSelectionOwner = null;
  emitDataTableCellSelectionChange(null);
}

export function releaseDataTableCellSelectionOwner(owner: symbol) {
  if (activeCellSelectionOwner === owner) activeCellSelectionOwner = null;
}

export function isDataTableCellSelectionOwnerActive(owner: symbol) {
  return activeCellSelectionOwner === owner;
}

export function subscribeDataTableCellSelectionOwner(listener: (owner: symbol | null) => void) {
  const handleSelectionChange = (event: Event) => {
    const detail = (event as CustomEvent<DataTableCellSelectionChangeDetail>).detail;
    listener(detail?.owner ?? null);
  };
  window.addEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
  return () =>
    window.removeEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
}
