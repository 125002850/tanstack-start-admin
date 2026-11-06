const JSON_WHITESPACE_PATTERN = /\s/u;

export function findJsonArrayItemValueRanges(source: string) {
  const ranges: Array<readonly [start: number, end: number]> = [];
  let cursor = skipJsonWhitespace(source, 0);
  if (source[cursor] !== '[') return ranges;
  cursor = skipJsonWhitespace(source, cursor + 1);
  while (cursor < source.length && source[cursor] !== ']') {
    const end = findJsonValueEnd(source, cursor);
    if (end <= cursor) return [];
    ranges.push([cursor, end]);
    cursor = skipJsonWhitespace(source, end);
    if (source[cursor] === ']') break;
    if (source[cursor] !== ',') return [];
    cursor = skipJsonWhitespace(source, cursor + 1);
  }
  return ranges;
}

export function parseJsonString(source: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(source);
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function findJsonStringEnd(source: string, start: number) {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '"') {
      return index + 1;
    }
  }
  return source.length;
}

function findJsonValueEnd(source: string, start: number) {
  let depth = 0;
  let index = start;
  for (; index < source.length; index += 1) {
    const character = source[index];
    if (depth === 0 && (character === ',' || character === '}' || character === ']')) break;
    if (character === '"') index = findJsonStringEnd(source, index) - 1;
    else if (character === '{' || character === '[') depth += 1;
    else if (character === '}' || character === ']') depth -= 1;
  }
  while (index > start && JSON_WHITESPACE_PATTERN.test(source[index - 1])) index -= 1;
  return index;
}

function skipJsonWhitespace(source: string, start: number) {
  let index = start;
  while (index < source.length && JSON_WHITESPACE_PATTERN.test(source[index])) index += 1;
  return index;
}
