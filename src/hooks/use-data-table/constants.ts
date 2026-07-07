/** DataTable 查询输入默认去抖时间，避免文本筛选每次键入都触发查询。 */
export const DEBOUNCE_MS = 300;
/** 自动生成序号列的内部列 ID，业务列不应复用。 */
export const DATA_TABLE_ROW_NUMBER_COLUMN_ID = '__rowNumber';
/** 序号列默认固定宽度；实际宽度会随 totalCount 位数向上扩展。 */
export const DATA_TABLE_ROW_NUMBER_COLUMN_WIDTH = 40;
/** 操作列约定 ID；手写同名列会被 useDataTable 识别并规范化。 */
export const DATA_TABLE_ACTIONS_COLUMN_ID = 'actions';
/** 自动生成选择列的内部列 ID，业务列不应复用。 */
export const DATA_TABLE_SELECT_COLUMN_ID = 'select';
/** 选择列固定宽度。 */
export const DATA_TABLE_SELECT_COLUMN_WIDTH = 40;
