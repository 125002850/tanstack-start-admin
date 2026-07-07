import { type Cell } from '@tanstack/react-table';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent
} from 'react';

import {
  DATA_TABLE_ACTIONS_COLUMN_ID,
  DATA_TABLE_ROW_NUMBER_COLUMN_ID
} from '@/hooks/use-data-table/constants';

/**
 * 单元格点击选择与复制反馈。
 *
 * 该 hook 不修改 TanStack rowSelection；它维护一套独立的“当前复制单元格”状态：
 * 点击普通业务单元格后，用户按 Cmd/Ctrl+C 会把该单元格文本写入剪贴板，并触发短暂闪烁。
 */
const DATA_TABLE_CELL_SELECTION_CHANGE_EVENT = 'data-table-cell-selection-change';
const DATA_TABLE_CELL_COPY_FEEDBACK_DURATION_MS = 960;

type DataTableCellSelectionState = {
  id: string;
  text: string;
};

type DataTableCellSelectionChangeDetail = {
  owner: symbol | null;
};

type DataTableCellCopyFeedbackState = {
  id: string;
  run: 'a' | 'b';
};

type DataTableCellSelectionProps = {
  'data-cell-id': string;
  'data-cell-copy-flash'?: 'true';
  'data-cell-copy-flash-run'?: DataTableCellCopyFeedbackState['run'];
  'data-cell-selected'?: 'true';
  onClick: (event: ReactMouseEvent<HTMLTableCellElement>) => void;
};

type UseDataTableCellSelectionOptions = {
  shouldIgnoreTarget?: (target: EventTarget | null, currentTarget: HTMLElement) => boolean;
};

let activeCellSelectionOwner: symbol | null = null;

/** 广播当前拥有单元格复制焦点的表格实例，保证页面上多个 DataTable 互斥。 */
function emitDataTableCellSelectionChange(owner: symbol | null) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DataTableCellSelectionChangeDetail>(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, {
      detail: { owner }
    })
  );
}

/** 工具列、行号列和固定列不参与单元格复制选择，避免和操作/固定区交互冲突。 */
function canSelectDataTableCell<TData>(cell: Cell<TData, unknown>): boolean {
  const columnId = cell.column.id;

  return (
    columnId !== DATA_TABLE_ROW_NUMBER_COLUMN_ID &&
    columnId !== DATA_TABLE_ACTIONS_COLUMN_ID &&
    !cell.column.getIsPinned()
  );
}

/** 统一换行符，防止不同浏览器 innerText 产生 CRLF 差异。 */
function normalizeDataTableCellClipboardText(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

/** 优先使用列 meta.copyValue；未提供时退回到单元格 DOM 文本。 */
function getDataTableCellClipboardText<TData>(
  cellElement: HTMLTableCellElement,
  cell: Cell<TData, unknown>
): string {
  const copyValue = cell.column.columnDef.meta?.copyValue;
  if (copyValue) {
    return normalizeDataTableCellClipboardText(copyValue(cell.getValue(), cell.row.original));
  }

  const text =
    typeof cellElement.innerText === 'string'
      ? cellElement.innerText
      : (cellElement.textContent ?? '');

  return normalizeDataTableCellClipboardText(text);
}

/** 如果用户已经手动框选文本，则尊重原生复制，不抢 clipboard。 */
function hasUserTextSelection(): boolean {
  const selection = document.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0);
}

/** 输入框、textarea、select 和 contenteditable 内的复制必须交给控件自身处理。 */
function isEditableCopyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest('input, textarea, select')) {
    return true;
  }

  let element: HTMLElement | null = target;
  while (element) {
    if (element.isContentEditable || element.getAttribute('contenteditable') !== null) {
      return true;
    }
    element = element.parentElement;
  }

  return false;
}

export function useDataTableCellSelection<TData>({
  shouldIgnoreTarget
}: UseDataTableCellSelectionOptions = {}) {
  // ownerRef 是当前 hook 实例的唯一身份，用于跨表格协调复制焦点。
  const ownerRef = useRef(Symbol('data-table-cell-selection'));
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const nextCopyFeedbackRunRef = useRef<DataTableCellCopyFeedbackState['run']>('a');
  const [activeCell, setActiveCell] = useState<DataTableCellSelectionState | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<DataTableCellCopyFeedbackState | null>(null);

  const clearCopyFeedbackTimeout = useCallback(() => {
    if (copyFeedbackTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(copyFeedbackTimeoutRef.current);
    copyFeedbackTimeoutRef.current = null;
  }, []);

  const flashCopiedCell = useCallback(
    (cellId: string) => {
      // run 在 a/b 间切换，让同一个单元格连续复制时也能重新触发 CSS 动画。
      clearCopyFeedbackTimeout();
      const run = nextCopyFeedbackRunRef.current;
      nextCopyFeedbackRunRef.current = run === 'a' ? 'b' : 'a';
      setCopyFeedback({ id: cellId, run });
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        copyFeedbackTimeoutRef.current = null;
        setCopyFeedback(null);
      }, DATA_TABLE_CELL_COPY_FEEDBACK_DURATION_MS);
    },
    [clearCopyFeedbackTimeout]
  );

  const clearCellSelection = useCallback(() => {
    activeCellSelectionOwner = null;
    emitDataTableCellSelectionChange(null);
    setActiveCell(null);
  }, []);

  const handleCellClick = useCallback(
    (event: ReactMouseEvent<HTMLTableCellElement>, cell: Cell<TData, unknown>) => {
      // 行展开、按钮等交互目标可通过 shouldIgnoreTarget 阻止单元格选中。
      if (shouldIgnoreTarget?.(event.target, event.currentTarget)) {
        return;
      }

      if (!canSelectDataTableCell(cell)) {
        clearCellSelection();
        return;
      }

      activeCellSelectionOwner = ownerRef.current;
      emitDataTableCellSelectionChange(ownerRef.current);
      setActiveCell({
        id: cell.id,
        text: getDataTableCellClipboardText(event.currentTarget, cell)
      });
    },
    [clearCellSelection, shouldIgnoreTarget]
  );

  const getCellSelectionProps = useCallback(
    (cell: Cell<TData, unknown>): DataTableCellSelectionProps => {
      const isSelectable = canSelectDataTableCell(cell);
      const isCopyFeedbackCell = isSelectable && copyFeedback?.id === cell.id;

      return {
        'data-cell-id': cell.id,
        'data-cell-copy-flash': isCopyFeedbackCell ? 'true' : undefined,
        'data-cell-copy-flash-run': isCopyFeedbackCell ? copyFeedback.run : undefined,
        'data-cell-selected': isSelectable && activeCell?.id === cell.id ? 'true' : undefined,
        onClick: (event) => handleCellClick(event, cell)
      };
    },
    [activeCell?.id, copyFeedback, handleCellClick]
  );

  useEffect(() => {
    const handleSelectionChange = (event: Event) => {
      // 其他 DataTable 获得单元格焦点时，当前表格同步清空高亮。
      const detail = (event as CustomEvent<DataTableCellSelectionChangeDetail>).detail;
      if (detail?.owner !== ownerRef.current) {
        setActiveCell(null);
      }
    };

    window.addEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
    return () => {
      window.removeEventListener(DATA_TABLE_CELL_SELECTION_CHANGE_EVENT, handleSelectionChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (activeCellSelectionOwner === ownerRef.current) {
        activeCellSelectionOwner = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      clearCopyFeedbackTimeout();
    };
  }, [clearCopyFeedbackTimeout]);

  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      // 只有当前 hook 实例持有复制焦点时才接管 copy 事件。
      if (activeCellSelectionOwner !== ownerRef.current || !activeCell) {
        return;
      }

      if (isEditableCopyTarget(event.target) || hasUserTextSelection() || !event.clipboardData) {
        return;
      }

      event.clipboardData.setData('text/plain', activeCell.text);
      event.preventDefault();
      flashCopiedCell(activeCell.id);
    };

    document.addEventListener('copy', handleCopy);
    return () => {
      document.removeEventListener('copy', handleCopy);
    };
  }, [activeCell, flashCopiedCell]);

  return {
    getCellSelectionProps
  };
}
