/** 编辑与选区汇总共享输入语法；归一化过程中保留原始十进制精度。 */
export function normalizeFullWidthNumericText(value: string) {
  return value
    .replace(/[０-９]/g, (character) =>
      String.fromCharCode(character.charCodeAt(0) - '０'.charCodeAt(0) + '0'.charCodeAt(0))
    )
    .replaceAll('＋', '+')
    .replaceAll('－', '-')
    .replaceAll('．', '.')
    .replaceAll('，', ',')
    .replaceAll('Ｅ', 'E')
    .replaceAll('ｅ', 'e')
    .replaceAll('％', '%');
}

export function normalizeGroupedNumericText(value: string): string | null {
  if (!value.includes(',')) return value;
  const exponentIndex = value.search(/[eE]/);
  const significand = exponentIndex < 0 ? value : value.slice(0, exponentIndex);
  const exponent = exponentIndex < 0 ? '' : value.slice(exponentIndex);
  if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(significand)) return null;
  return `${significand.replaceAll(',', '')}${exponent}`;
}

export function isDecimalNumericText(value: string, allowScientificNotation: boolean): boolean {
  const pattern = allowScientificNotation
    ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
    : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
  return pattern.test(value);
}
