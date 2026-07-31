import { DATA_TABLE_DATE_DISPLAY_FORMAT, DATA_TABLE_DATE_TIME_DISPLAY_FORMAT } from './data-table';

/**
 * DataTable 用户可见消息目录。
 *
 * 当前编辑契约仍返回 string[]，因此先由这里统一生成中文文案；未来接入 I18N 时可在
 * 保持调用点稳定的前提下，为此接口提供不同语言实现。开发者配置断言不属于此目录。
 */
export interface DataTableMessageCatalog {
  validation: {
    required: string;
    invalidTextValue: string;
    invalidChoiceValue: string;
    maxSelectedExceeded: string;
    invalidSwitchValue: string;
    invalidLongTextDraft: string;
    invalidLongTextValue: string;
    longTextMinLength: (minLength: number) => string;
    longTextMaxLength: (maxLength: number) => string;
    invalidNumericDraft: string;
    invalidNumericValue: string;
    integerRequired: string;
    scientificNotationNotAllowed: string;
    invalidCurrency: string;
    numericMaxFractionDigits: (maxFractionDigits: number) => string;
    numericMin: (min: number) => string;
    numericMax: (max: number) => string;
    numericStep: (step: number) => string;
    invalidDateDraft: string;
    invalidDateValue: string;
    dateMin: (min: string) => string;
    dateMax: (max: string) => string;
    dateUnavailable: string;
    invalidDateTimeDraft: string;
    invalidDateTimeValue: string;
    dateTimeStep: (step: number, granularity: 'minute' | 'second') => string;
    dateTimeGap: (timeZone: string) => string;
    dateTimeOverlap: (timeZone: string) => string;
    dateTimeMin: (min: string) => string;
    dateTimeMax: (max: string) => string;
  };
  editing: {
    rowUnavailable: string;
    cellNotEditable: string;
    codecUnavailable: string;
    columnUnavailable: string;
    batchPlanStale: string;
    activeSessionBeforeBatch: string;
    duplicateBatchTarget: string;
  };
  matrix: {
    textAfterClosingQuote: string;
    unterminatedQuotedCell: string;
    nonRectangularClipboard: string;
    tooManyCells: (cellCount: number, maxCells: number) => string;
    invalidClipboard: string;
    preparationCancelled: string;
    targetRowOutOfBounds: string;
    pinnedColumnExcluded: string;
    targetColumnOutOfBounds: string;
    hiddenColumn: string;
    targetColumnNotEditable: string;
    targetCellReadonly: string;
    targetCodecUnavailable: string;
    finishActiveEdit: string;
    editableTableRequired: string;
    editFailed: string;
    preparationFailed: string;
    deleteTargetColumnUnavailable: string;
    pasteTargetColumnUnavailable: string;
    failed: string;
    sourceCoordinate: (rowIndex: number, columnIndex: number) => string;
    targetCoordinate: (rowIndex: number, columnIndex: number, columnId?: string) => string;
  };
  fill: {
    targetShapeInvalid: string;
    emptyRange: string;
    sourceCellUnavailable: string;
    finishActiveEdit: string;
    editableTableRequired: string;
    failed: string;
    preparationFailed: string;
    sourceColumnsUnavailable: string;
    targetOutOfBounds: string;
  };
}

export const dataTableZhCnMessages: DataTableMessageCatalog = {
  validation: {
    required: '此项为必填项。',
    invalidTextValue: '文本值必须是字符串。',
    invalidChoiceValue: '选项值格式无效。',
    maxSelectedExceeded: '已选项数量超过允许上限。',
    invalidSwitchValue: '开关值必须与选中值或未选中值一致。',
    invalidLongTextDraft: '多行文本草稿必须是字符串。',
    invalidLongTextValue: '多行文本值必须是字符串。',
    longTextMinLength: (minLength) => `文本至少需要 ${minLength} 个字符。`,
    longTextMaxLength: (maxLength) => `文本最多允许 ${maxLength} 个字符。`,
    invalidNumericDraft: '请输入有效的有限数值。',
    invalidNumericValue: '数值必须是有限数字。',
    integerRequired: '请输入整数。',
    scientificNotationNotAllowed: '不允许使用科学计数法。',
    invalidCurrency: '输入的货币符号或代码与当前币种不一致。',
    numericMaxFractionDigits: (maxFractionDigits) => `小数位最多允许 ${maxFractionDigits} 位。`,
    numericMin: (min) => `数值不能小于 ${min}。`,
    numericMax: (max) => `数值不能大于 ${max}。`,
    numericStep: (step) => `数值必须符合步长 ${step}。`,
    invalidDateDraft: `日期格式必须为 ${DATA_TABLE_DATE_DISPLAY_FORMAT}。`,
    invalidDateValue: `日期值必须是有效的 ${DATA_TABLE_DATE_DISPLAY_FORMAT} 字符串。`,
    dateMin: (min) => `日期不能早于 ${min}。`,
    dateMax: (max) => `日期不能晚于 ${max}。`,
    dateUnavailable: '该日期不可选。',
    invalidDateTimeDraft: `日期时间格式必须为 ${DATA_TABLE_DATE_TIME_DISPLAY_FORMAT}。`,
    invalidDateTimeValue: '日期时间值与配置的值类型不匹配。',
    dateTimeStep: (step, granularity) =>
      `日期时间必须按 ${step} ${granularity === 'minute' ? '分钟' : '秒'}递增。`,
    dateTimeGap: (timeZone) => `该日期时间在时区 ${timeZone} 中不存在（夏令时跳变）。`,
    dateTimeOverlap: (timeZone) =>
      `该日期时间在时区 ${timeZone} 中存在歧义（夏令时重叠），请提供明确的 UTC 偏移。`,
    dateTimeMin: (min) => `日期时间不能早于 ${min}。`,
    dateTimeMax: (max) => `日期时间不能晚于 ${max}。`
  },
  editing: {
    rowUnavailable: '目标行不可用。',
    cellNotEditable: '目标单元格不可编辑。',
    codecUnavailable: '目标单元格的编辑解析器不可用。',
    columnUnavailable: '目标编辑列不可用。',
    batchPlanStale: '批量操作计划已过期，请重试。',
    activeSessionBeforeBatch: '请先完成当前单元格编辑，再执行批量操作。',
    duplicateBatchTarget: '批量操作包含重复的目标单元格。'
  },
  matrix: {
    textAfterClosingQuote: '剪贴板内容在闭合引号后包含多余文本。',
    unterminatedQuotedCell: '剪贴板中存在未闭合引号的单元格。',
    nonRectangularClipboard: '剪贴板每行的单元格数量必须一致。',
    tooManyCells: (cellCount, maxCells) =>
      `剪贴板包含 ${cellCount} 个单元格，最多允许 ${maxCells} 个。`,
    invalidClipboard: '剪贴板矩阵格式无效。',
    preparationCancelled: '批量粘贴准备已取消。',
    targetRowOutOfBounds: '粘贴目标行超出当前已加载表格范围。',
    pinnedColumnExcluded: '固定列不参与矩阵粘贴。',
    targetColumnOutOfBounds: '粘贴目标列超出表格范围。',
    hiddenColumn: '隐藏列不能接收矩阵粘贴值。',
    targetColumnNotEditable: '矩阵粘贴的目标列不可编辑。',
    targetCellReadonly: '矩阵粘贴的目标单元格为只读。',
    targetCodecUnavailable: '矩阵粘贴目标的编辑解析器不可用。',
    finishActiveEdit: '请先完成当前单元格编辑，再修改矩阵。',
    editableTableRequired: '矩阵编辑需要可编辑表格。',
    editFailed: '矩阵编辑失败。',
    preparationFailed: '矩阵操作准备失败。',
    deleteTargetColumnUnavailable: '矩阵删除的目标列不可用。',
    pasteTargetColumnUnavailable: '矩阵粘贴的目标列不可用。',
    failed: '矩阵粘贴失败。',
    sourceCoordinate: (rowIndex, columnIndex) => `来源：第 ${rowIndex} 行第 ${columnIndex} 列`,
    targetCoordinate: (rowIndex, columnIndex, columnId) =>
      `目标：第 ${rowIndex} 行第 ${columnIndex} 列${columnId ? `（${columnId}）` : ''}`
  },
  fill: {
    targetShapeInvalid: '填充区域必须从源区域的一整条边连续向外扩展。',
    emptyRange: '填充源区域和目标区域不能为空。',
    sourceCellUnavailable: '填充源单元格必须可见并具备可用的编辑解析器。',
    finishActiveEdit: '请先完成当前单元格编辑，再填充区域。',
    editableTableRequired: '区域填充需要可编辑表格。',
    failed: '区域填充失败。',
    preparationFailed: '区域填充准备失败。',
    sourceColumnsUnavailable: '填充源列不可用。',
    targetOutOfBounds: '填充目标超出当前已加载的可选范围。'
  }
};

/** 当前默认语言；未来由应用层 locale provider 注入后可替换为对应语言目录。 */
export const dataTableMessages = dataTableZhCnMessages;
