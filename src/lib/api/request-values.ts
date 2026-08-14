/**
 * 将表单中的空字符串转换为可被 JSON 序列化省略的 `undefined`。
 *
 * 仅用于创建接口明确把空字符串定义为“未提供/使用默认值”的请求字段；
 * Update/Save Request Mapper 不得使用本函数。
 * 是否去除首尾空白由调用方决定，避免这个 helper 隐式修改用户输入。
 */
export function emptyStringToUndefined(value: string | null | undefined): string | undefined {
  return value == null || value === '' ? undefined : value;
}
