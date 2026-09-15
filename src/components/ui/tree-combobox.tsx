import * as React from 'react';
import { Icons } from '@/components/icons';
import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Tree, type TreeItem, type TreeSelection } from './tree';
import { useOverlayPortalContainer } from './use-overlay-portal-container';

interface TreeComboboxProps {
  items: readonly TreeItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (search: string) => void;
  triggerLabel: string;
  'aria-invalid'?: React.AriaAttributes['aria-invalid'];
  searchLabel?: string;
  defaultExpandedValues?: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  status?: 'ready' | 'loading' | 'error';
  onRetry?: () => void;
}

const flat = (nodes: readonly TreeItem[]): TreeItem[] =>
  nodes.flatMap((n) => [n, ...flat(n.children ?? [])]);

function TreeCombobox({
  items,
  open,
  onOpenChange,
  search,
  onSearchChange,
  triggerLabel,
  'aria-invalid': ariaInvalid,
  placeholder = '请选择',
  searchLabel,
  defaultExpandedValues = [],
  disabled,
  status = 'ready',
  onRetry,
  selection
}: TreeComboboxProps & { selection: TreeSelection }) {
  const id = React.useId();
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const values =
    selection.mode === 'single' ? (selection.value ? [selection.value] : []) : selection.values;
  const byValue = new Map(flat(items).map((n) => [n.value, n]));
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) onSearchChange('');
  };
  const effectiveSelection: TreeSelection =
    selection.mode === 'single'
      ? {
          ...selection,
          onValueChange: (value) => {
            selection.onValueChange(value);
            close(false);
          }
        }
      : selection;
  return (
    <Popover open={open} onOpenChange={close}>
      <PopoverTrigger asChild>
        <Button
          ref={setTriggerNode}
          type='button'
          variant='outline'
          role='combobox'
          aria-label={triggerLabel}
          aria-invalid={ariaInvalid}
          aria-expanded={open}
          aria-controls={id}
          disabled={disabled}
          className='w-full justify-between font-normal'
        >
          <span className='truncate'>
            {values.length
              ? values.map((v) => byValue.get(v)?.label ?? `失效引用 ${v}`).join('、')
              : placeholder}
          </span>
          <Icons.chevronsUpDown className='size-4 shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={id}
        align='start'
        container={open ? (container ?? getContainer()) : container}
        finalFocus={triggerRef}
        className='w-(--radix-popover-trigger-width) min-w-72 p-2'
      >
        <div className='flex flex-col gap-2'>
          <Input
            type='search'
            aria-label={searchLabel ?? `搜索${triggerLabel}`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder='搜索名称或编码'
          />
          {status === 'loading' ? (
            <p role='status'>正在加载…</p>
          ) : status === 'error' ? (
            <div role='alert'>
              加载失败
              <Button type='button' variant='ghost' onClick={onRetry}>
                重试
              </Button>
            </div>
          ) : (
            <div className='max-h-80 overflow-auto'>
              <Tree
                items={items}
                defaultExpandedValues={defaultExpandedValues}
                selection={effectiveSelection}
                searchQuery={search}
              />
            </div>
          )}
          {selection.mode !== 'single' && values.length > 0 ? (
            <Button type='button' variant='ghost' onClick={() => selection.onValuesChange([])}>
              清除选择
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SingleTreeCombobox(
  props: TreeComboboxProps & { value: string | null; onValueChange: (value: string) => void }
) {
  return (
    <TreeCombobox
      {...props}
      selection={{ mode: 'single', value: props.value, onValueChange: props.onValueChange }}
    />
  );
}
export function MultipleTreeCombobox(
  props: TreeComboboxProps & { value: readonly string[]; onValueChange: (value: string[]) => void }
) {
  return (
    <TreeCombobox
      {...props}
      selection={{
        mode: 'independent-multiple',
        values: props.value,
        onValuesChange: props.onValueChange
      }}
    />
  );
}
