const commitHeaderPattern =
  /^(?:(?:build|test|chore|feat|fix|perf|refactor|docs|types|style):\s.+|Initial commit|Merge .+|Revert ".+"|Update .+)$/;

const commitHeaderExample =
  '提交标题必须匹配：<type>: <description>、Initial commit、Merge ...、Revert "..." 或 Update ...';

const commitlintConfig = {
  defaultIgnores: false,
  rules: {
    'header-pattern': [2, 'always']
  },
  plugins: [
    {
      rules: {
        'header-pattern': ({ header = '' }) => [
          commitHeaderPattern.test(header),
          commitHeaderExample
        ]
      }
    }
  ]
};

export default commitlintConfig;
