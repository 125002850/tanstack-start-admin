const HELPER_NAME = 'emptyStringToUndefined';
const HELPER_MODULE = '@/lib/api/request-values';
const REQUEST_CALL_NAMES = new Set(['mutate', 'mutateAsync', 'onSubmit']);
const REQUEST_MAPPER_NAME = /^(?:to|build).*(?:Request|Payload)$/;
const CREATE_REQUEST_MAPPER_NAME = /^(?:to|build)Create.*Request$/;
const UPDATE_OR_SAVE_REQUEST_MAPPER_NAME = /^(?:to|build)(?:Update|Save).*Request$/;

function isFunctionNode(node) {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression'
  );
}

function getStaticPropertyName(node) {
  if (!node || node.computed) return null;
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;
  return null;
}

function getFunctionName(node) {
  if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;

  const parent = node.parent;
  if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  if (parent?.type === 'Property') return getStaticPropertyName(parent);
  if (parent?.type === 'MethodDefinition' && !parent.computed) {
    return parent.key.type === 'Identifier' ? parent.key.name : String(parent.key.value);
  }
  return null;
}

function getEnclosingFunctionName(node) {
  let current = node.parent;
  while (current) {
    if (isFunctionNode(current)) return getFunctionName(current);
    current = current.parent;
  }
  return null;
}

function getCalleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed) {
    return callee.property.type === 'Identifier' ? callee.property.name : null;
  }
  return null;
}

function isInsideRequestCall(node) {
  let current = node.parent;
  while (current) {
    if (current.type === 'CallExpression') {
      if (REQUEST_CALL_NAMES.has(getCalleeName(current.callee))) return true;
    }
    current = current.parent;
  }
  return false;
}

function isRequestBoundary(node) {
  const functionName = getEnclosingFunctionName(node);
  return (
    (functionName != null && REQUEST_MAPPER_NAME.test(functionName)) || isInsideRequestCall(node)
  );
}

function hasHelperImport(sourceCode) {
  return sourceCode.ast.body.some(
    (statement) =>
      statement.type === 'ImportDeclaration' &&
      statement.source.value === HELPER_MODULE &&
      statement.specifiers.some(
        (specifier) => specifier.type === 'ImportSpecifier' && specifier.local.name === HELPER_NAME
      )
  );
}

function buildHelperFixes(fixer, sourceCode, expression) {
  const fixes = [
    fixer.replaceText(expression, `${HELPER_NAME}(${sourceCode.getText(expression.left)})`)
  ];

  if (hasHelperImport(sourceCode)) return fixes;

  const imports = sourceCode.ast.body.filter((statement) => statement.type === 'ImportDeclaration');
  const importText = `import { ${HELPER_NAME} } from '${HELPER_MODULE}';`;
  const lastImport = imports.at(-1);
  if (lastImport) {
    fixes.push(fixer.insertTextAfter(lastImport, `\n${importText}`));
  } else if (sourceCode.ast.body[0]) {
    fixes.push(fixer.insertTextBefore(sourceCode.ast.body[0], `${importText}\n\n`));
  } else {
    fixes.push(fixer.insertTextAfterRange([0, 0], `${importText}\n`));
  }

  return fixes;
}

const noImplicitEmptyToUndefined = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止在请求边界通过 truthiness 隐式把空字符串转换为 undefined'
    },
    schema: [],
    fixable: 'code',
    hasSuggestions: true,
    messages: {
      ambiguous:
        '请求字段不得使用 `value || undefined` 隐式丢弃空字符串。清空字段应保留空字符串；确需省略时请显式使用 emptyStringToUndefined()。',
      useHelper: '接口明确需要省略空字符串时，改用 emptyStringToUndefined()。'
    }
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Property(node) {
        const expression = node.value;
        if (
          expression.type !== 'LogicalExpression' ||
          expression.operator !== '||' ||
          expression.right.type !== 'Identifier' ||
          expression.right.name !== 'undefined' ||
          !isRequestBoundary(node)
        ) {
          return;
        }

        const functionName = getEnclosingFunctionName(node);
        const report = {
          node: expression,
          messageId: 'ambiguous',
          suggest: [
            {
              messageId: 'useHelper',
              fix: (fixer) => buildHelperFixes(fixer, sourceCode, expression)
            }
          ]
        };

        if (functionName != null && CREATE_REQUEST_MAPPER_NAME.test(functionName)) {
          report.fix = (fixer) => buildHelperFixes(fixer, sourceCode, expression);
        }

        context.report(report);
      }
    };
  }
};

const noEmptyStringToUndefinedInUpdate = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止 Update/Save Request Mapper 使用 emptyStringToUndefined'
    },
    schema: [],
    messages: {
      preserveEmpty:
        'Update/Save Request Mapper 必须显式表达更新语义，不能使用 emptyStringToUndefined() 省略空字符串。'
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== HELPER_NAME) return;

        const functionName = getEnclosingFunctionName(node);
        if (functionName != null && UPDATE_OR_SAVE_REQUEST_MAPPER_NAME.test(functionName)) {
          context.report({ node, messageId: 'preserveEmpty' });
        }
      }
    };
  }
};

const oigPlugin = {
  meta: { name: 'oig' },
  rules: {
    'no-implicit-empty-to-undefined': noImplicitEmptyToUndefined,
    'no-empty-string-to-undefined-in-update': noEmptyStringToUndefinedInUpdate
  }
};

export default oigPlugin;
