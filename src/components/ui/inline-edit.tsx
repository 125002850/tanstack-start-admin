import { useCallback, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Field, FieldError, FieldGroup, FieldLabel } from './field';

type InlineEditProps = {
  value: string;
  label: string;
  onValueChange: (value: string) => void;
  onDraftChange?: (value: string | null) => void;
  validate?: (value: string) => string | undefined;
  maxLength?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export function InlineEdit({
  value,
  label,
  onValueChange,
  onDraftChange,
  validate,
  maxLength,
  disabled = false,
  placeholder,
  className
}: InlineEditProps) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const draft = useRef<string | null>(null);
  const initialValue = useRef('');
  const clickPoint = useRef<{ x: number; y: number } | null>(null);
  const restoreFocus = useRef(false);
  const resetDraft = useEffectEvent(() => {
    if (draft.current === null) return;
    draft.current = null;
    setEditing(false);
    setError(undefined);
    onDraftChange?.(null);
  });
  useLayoutEffect(() => resetDraft(), [value, disabled]);

  const focusEditor = useCallback((element: HTMLSpanElement | null) => {
    if (!element) return;
    element.focus({ preventScroll: true });
    const document = element.ownerDocument;
    const point = clickPoint.current;
    let range: Range | null = null;
    if (point) {
      const caret = document.caretPositionFromPoint?.(point.x, point.y);
      if (caret && element.contains(caret.offsetNode)) {
        range = document.createRange();
        range.setStart(caret.offsetNode, caret.offset);
      } else {
        range = document.caretRangeFromPoint?.(point.x, point.y) ?? null;
      }
    }
    if (!range || !element.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(element);
      const bounds = element.getBoundingClientRect();
      range.collapse(Boolean(point && point.x < bounds.left + bounds.width / 2));
    } else {
      range.collapse(true);
    }
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    clickPoint.current = null;
  }, []);

  function finish(cancel = false) {
    if (draft.current === null) return;
    if (!cancel) {
      const next = draft.current.trim();
      const invalid =
        validate?.(next) ??
        (maxLength !== undefined && next.length > maxLength
          ? `${label}不能超过 ${maxLength} 个字符。`
          : undefined);
      if (invalid) {
        setError(invalid);
        restoreFocus.current = false;
        return;
      }
      if (next !== value) onValueChange(next);
    }
    draft.current = null;
    setEditing(false);
    setError(undefined);
    onDraftChange?.(null);
  }

  return (
    <FieldGroup className='@container-normal w-auto max-w-full gap-1'>
      <Field className='w-auto gap-1' data-invalid={!!error}>
        <FieldLabel htmlFor={id} className='sr-only'>
          {label}
        </FieldLabel>
        {editing ? (
          <span
            ref={focusEditor}
            id={id}
            data-slot='inline-edit-editor'
            role='textbox'
            tabIndex={0}
            aria-label={label}
            aria-multiline='false'
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            contentEditable={!disabled}
            suppressContentEditableWarning
            className={cn(
              'inline-block h-8 min-w-0 max-w-full overflow-hidden whitespace-pre px-2 text-sm font-semibold outline-none',
              className,
              'leading-8'
            )}
            onInput={(event) => {
              draft.current = event.currentTarget.textContent ?? '';
              setError(undefined);
              onDraftChange?.(draft.current);
            }}
            onPaste={(event) => {
              event.preventDefault();
              const text = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ');
              event.currentTarget.ownerDocument.execCommand('insertText', false, text);
            }}
            onBlur={() => finish()}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey) return;
              if (event.key !== 'Enter' && event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              restoreFocus.current = true;
              finish(event.key === 'Escape');
            }}
          >
            {/* 浏览器维护编辑中的文本，React 更新不重写文字或移动光标。 */}
            {initialValue.current}
          </span>
        ) : (
          <Button
            ref={(button) => {
              if (button && restoreFocus.current) {
                button.focus();
                restoreFocus.current = false;
              }
            }}
            id={id}
            type='button'
            variant='link'
            size='sm'
            aria-label={`修改${label}`}
            title={`点击修改${label}`}
            disabled={disabled}
            className={cn(
              'h-8 min-w-0 max-w-full cursor-text px-2 font-semibold text-inherit underline-offset-4 focus-visible:underline focus-visible:ring-0',
              className
            )}
            onClick={(event) => {
              clickPoint.current = event.detail > 0 ? { x: event.clientX, y: event.clientY } : null;
              initialValue.current = value;
              draft.current = value;
              setEditing(true);
              setError(undefined);
              onDraftChange?.(value);
            }}
          >
            <span className='truncate'>{value || placeholder}</span>
          </Button>
        )}
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </Field>
    </FieldGroup>
  );
}
