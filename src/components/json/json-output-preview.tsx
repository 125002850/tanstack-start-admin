import { useMemo, useRef } from 'react';
import { json } from '@codemirror/lang-json';
import { foldService } from '@codemirror/language';
import CodeMirror, { EditorState, EditorView, type BasicSetupOptions } from '@uiw/react-codemirror';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { copyTextToClipboard } from '@/lib/browser/copy-text-to-clipboard';
import { formatJsonSource } from '@/lib/json-source';
import { JsonInputAction } from './json-input-action';
import { indexJsonOutput } from './json-output-index';

const VIEWER_SETUP: BasicSetupOptions = {
  lineNumbers: true,
  foldGutter: true,
  foldKeymap: true,
  history: false,
  historyKeymap: false,
  autocompletion: false,
  completionKeymap: false,
  closeBrackets: false,
  closeBracketsKeymap: false,
  bracketMatching: false,
  indentOnInput: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  highlightSelectionMatches: false,
  searchKeymap: false,
  lintKeymap: false,
  rectangularSelection: false,
  crosshairCursor: false,
  dropCursor: false,
  allowMultipleSelections: false
};

const VIEWER_THEME = EditorView.theme({
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)', lineHeight: '20px' }
});

/** 只读 JSON 查看器，行号、折叠和可见区域渲染由 CodeMirror 统一处理。 */
export function JsonOutputPreview({
  source,
  ariaLabel,
  formatted = false
}: {
  source: string;
  ariaLabel: string;
  formatted?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { text, lineCount, folds } = useMemo(() => {
    const text = formatted ? source : formatJsonSource(source);
    return { text, ...indexJsonOutput(text) };
  }, [source, formatted]);
  const extensions = useMemo(
    () => [
      json(),
      VIEWER_THEME,
      foldService.of((_state, lineStart) => folds.get(lineStart) ?? null),
      EditorState.phrases.of({
        'Fold line': '折叠此处',
        'Unfold line': '展开此处',
        'folded code': '已折叠内容',
        unfold: '展开'
      }),
      EditorView.contentAttributes.of({
        'aria-label': ariaLabel,
        'aria-readonly': 'true',
        'aria-multiline': 'true',
        role: 'textbox',
        tabindex: '0'
      })
    ],
    [ariaLabel, folds]
  );

  return (
    <div ref={container} data-json-output-preview className='flex min-w-0 flex-col gap-2'>
      <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
        <span>共 {lineCount} 行</span>
        <JsonInputAction
          label={`复制完整${ariaLabel}`}
          tooltip='复制完整 JSON'
          icon={Icons.copy}
          onClick={async () => {
            if (await copyTextToClipboard(text, { container: container.current })) {
              toast.success('完整 JSON 已复制。');
            } else {
              toast.error('复制失败，请重试。');
            }
          }}
        />
      </div>
      <CodeMirror
        value={text}
        extensions={extensions}
        basicSetup={VIEWER_SETUP}
        readOnly
        editable={false}
        indentWithTab={false}
        height={lineCount > 18 ? '24rem' : undefined}
        minHeight='6rem'
        maxHeight='24rem'
        theme='none'
        className='overflow-hidden rounded-md border'
      />
    </div>
  );
}
