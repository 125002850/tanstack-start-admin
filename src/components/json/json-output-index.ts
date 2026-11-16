type JsonFoldRange = { from: number; to: number };

/** 索引已格式化 JSON 的行数和折叠范围，不构建业务对象或依赖完整语法树。 */
export function indexJsonOutput(text: string) {
  const folds = new Map<number, JsonFoldRange>();
  const stack: { lineStart: number; from: number }[] = [];
  let lineCount = 1;
  let lineStart = 0;
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '\n') {
      lineCount++;
      lineStart = index + 1;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') stack.push({ lineStart, from: index + 1 });
    else if (char === '}' || char === ']') {
      const open = stack.pop();
      if (open && open.lineStart !== lineStart) {
        folds.set(open.lineStart, { from: open.from, to: index });
      }
    }
  }

  return { lineCount, folds };
}
