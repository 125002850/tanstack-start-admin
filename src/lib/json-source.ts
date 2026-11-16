const JSON_WHITESPACE_PATTERN = /\s/u;

/** 只校验并缩进源码，保留大整数、精确小数及字符串转义。无效 JSON 会抛出异常。 */
export function formatJsonSource(source: string): string {
  JSON.parse(source);
  const tokens = source.match(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/gu) ?? [];
  let depth = 0;
  let output = '';
  const newline = () => `\n${'  '.repeat(depth)}`;

  tokens.forEach((token, index) => {
    if (token === '{' || token === '[') {
      output += token;
      depth += 1;
      if (tokens[index + 1] !== '}' && tokens[index + 1] !== ']') output += newline();
    } else if (token === '}' || token === ']') {
      depth -= 1;
      if (tokens[index - 1] !== '{' && tokens[index - 1] !== '[') output += newline();
      output += token;
    } else if (token === ',') output += `,${newline()}`;
    else if (token === ':') output += ': ';
    else output += token;
  });
  return output;
}

export function findRootStringPropertyValueRanges(source: string, property: string) {
  return findRootJsonPropertyValueRanges(source, property).filter(
    ([start]) => source[start] === '"'
  );
}

/** 读取数组各项在原文中的范围；调用方先验证 JSON，避免提取时重写精确数值。 */
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

export function findRootJsonPropertyValueRanges(source: string, property: string) {
  const ranges: Array<readonly [start: number, end: number]> = [];
  let objectDepth = 0;
  let arrayDepth = 0;

  for (let index = 0; index < source.length; ) {
    const character = source[index];
    if (character === '"') {
      const stringEnd = findJsonStringEnd(source, index);
      if (objectDepth === 1 && arrayDepth === 0) {
        const colonIndex = skipJsonWhitespace(source, stringEnd);
        if (
          source[colonIndex] === ':' &&
          parseJsonString(source.slice(index, stringEnd)) === property
        ) {
          const valueStart = skipJsonWhitespace(source, colonIndex + 1);
          ranges.push([valueStart, findJsonValueEnd(source, valueStart)]);
        }
      }
      index = stringEnd;
      continue;
    }
    if (character === '{') objectDepth += 1;
    if (character === '}') objectDepth -= 1;
    if (character === '[') arrayDepth += 1;
    if (character === ']') arrayDepth -= 1;
    index += 1;
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
