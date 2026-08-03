const DATA_TABLE_ROW_ACTION_BUTTON_SIZE = 32;
const DATA_TABLE_ROW_ACTION_GAP = 2;
const DATA_TABLE_ROW_ACTION_CELL_PADDING_X = 32;

export const DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE = 3;

/** 根据可见操作数量预估操作列宽度，保证固定操作列不因按钮数量变化抖动。 */
export function getDataTableRowActionsColumnWidth(
  actionCount: number,
  maxVisible = DATA_TABLE_ROW_ACTIONS_MAX_VISIBLE
): number {
  if (actionCount <= 0) {
    return DATA_TABLE_ROW_ACTION_CELL_PADDING_X;
  }

  const displayedActionCount =
    actionCount > maxVisible ? maxVisible + 1 : Math.min(actionCount, maxVisible);
  const gapWidth = Math.max(0, displayedActionCount - 1) * DATA_TABLE_ROW_ACTION_GAP;

  return (
    DATA_TABLE_ROW_ACTION_CELL_PADDING_X +
    displayedActionCount * DATA_TABLE_ROW_ACTION_BUTTON_SIZE +
    gapWidth
  );
}
