import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

import { useOverlayPortalContainer } from './use-overlay-portal-container';

const LOAD_MORE_SCROLL_THRESHOLD_PX = 48;

export type ChoiceComboboxValue = string | number;

export type ChoiceComboboxOption<TValue extends ChoiceComboboxValue = string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

export type ChoiceComboboxLoadMoreProps = {
  disabled?: boolean;
  isLoading?: boolean;
  label: string;
  onClick: () => void;
  visible: boolean;
};

export type ChoiceComboboxSearchMode = 'none' | 'local' | 'remote';

type ChoiceComboboxBaseProps<TValue extends ChoiceComboboxValue> = {
  options: readonly ChoiceComboboxOption<TValue>[];
  triggerLabel: string;
  placeholder: string;
  searchMode?: ChoiceComboboxSearchMode;
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  errorText?: string;
  clearLabel?: string;
  allowEmpty?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  open?: boolean;
  inputValue?: string;
  loadMore?: ChoiceComboboxLoadMoreProps;
  id?: string;
  className?: string;
  contentClassName?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  onOpenChange?: (open: boolean) => void;
  onInputValueChange?: (value: string) => void;
  onEscapeKeyDown?: React.ComponentProps<typeof PopoverContent>['onEscapeKeyDown'];
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
};

export type SingleChoiceComboboxProps<TValue extends ChoiceComboboxValue = string> =
  ChoiceComboboxBaseProps<TValue> & {
    value: TValue | null;
    onValueChange: (value: TValue | null) => void;
  };

export type MultipleChoiceComboboxProps<TValue extends ChoiceComboboxValue = string> =
  ChoiceComboboxBaseProps<TValue> & {
    value: TValue[];
    maxSelected?: number;
    onValueChange: (value: TValue[]) => void;
  };

type ChoiceComboboxProps<TValue extends ChoiceComboboxValue> = ChoiceComboboxBaseProps<TValue> & {
  selectionMode: 'single' | 'multiple';
  values: TValue[];
  maxSelected?: number;
  onValuesChange: (values: TValue[]) => void;
};

function uniqueValues<TValue extends ChoiceComboboxValue>(values: readonly TValue[]) {
  return [...new Set(values)];
}

function getOptionKey(value: ChoiceComboboxValue) {
  return `${typeof value}:${String(value)}`;
}

function ChoiceCombobox<TValue extends ChoiceComboboxValue>({
  options,
  values,
  selectionMode,
  maxSelected,
  triggerLabel,
  placeholder,
  searchMode = 'local',
  searchPlaceholder = `搜索${triggerLabel}`,
  emptyText = '未找到匹配项',
  loadingText = '正在加载',
  errorText = '加载失败',
  clearLabel = '清除选择',
  allowEmpty = true,
  disabled = false,
  isLoading = false,
  isError = false,
  open: controlledOpen,
  inputValue: controlledInputValue,
  loadMore,
  id,
  className,
  contentClassName,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  onOpenChange,
  onInputValueChange,
  onEscapeKeyDown,
  onKeyDown,
  onValuesChange
}: ChoiceComboboxProps<TValue>) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [internalSearch, setInternalSearch] = React.useState('');
  const listRef = React.useRef<HTMLDivElement>(null);
  const hasUserScrollIntentRef = React.useRef(false);
  const open = controlledOpen ?? internalOpen;
  const search = searchMode === 'none' ? '' : (controlledInputValue ?? internalSearch);
  const normalizedValues = React.useMemo(() => uniqueValues(values), [values]);
  const selectedValues = React.useMemo(() => new Set(normalizedValues), [normalizedValues]);
  const uniqueOptions = React.useMemo(() => {
    const seen = new Set<TValue>();
    return options.filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [options]);
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const portalContainer = open ? (container ?? getContainer()) : container;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = React.useMemo(() => {
    if (searchMode !== 'local' || !normalizedSearch) return uniqueOptions;

    return uniqueOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedSearch) ||
        String(option.value).toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch, searchMode, uniqueOptions]);
  const optionByValue = React.useMemo(
    () => new Map(uniqueOptions.map((option) => [option.value, option])),
    [uniqueOptions]
  );
  const selectedLabels = React.useMemo(
    () => normalizedValues.map((value) => optionByValue.get(value)?.label ?? String(value)),
    [normalizedValues, optionByValue]
  );

  const setSearch = React.useCallback(
    (nextSearch: string) => {
      if (searchMode === 'none') return;
      if (controlledInputValue === undefined) setInternalSearch(nextSearch);
      onInputValueChange?.(nextSearch);
    },
    [controlledInputValue, onInputValueChange, searchMode]
  );
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
      if (!nextOpen) setSearch('');
    },
    [controlledOpen, onOpenChange, setSearch]
  );
  const handleSelect = React.useCallback(
    (option: ChoiceComboboxOption<TValue>) => {
      if (option.disabled) return;

      const isSelected = selectedValues.has(option.value);
      if (selectionMode === 'single') {
        if (!isSelected) onValuesChange([option.value]);
        handleOpenChange(false);
        return;
      }

      if (isSelected) {
        if (!allowEmpty && selectedValues.size === 1) return;
        onValuesChange(normalizedValues.filter((value) => !Object.is(value, option.value)));
        return;
      }
      if (maxSelected !== undefined && selectedValues.size >= maxSelected) return;
      onValuesChange([...normalizedValues, option.value]);
    },
    [
      allowEmpty,
      handleOpenChange,
      maxSelected,
      normalizedValues,
      onValuesChange,
      selectedValues,
      selectionMode
    ]
  );
  const handleClear = React.useCallback(() => {
    if (!allowEmpty) return;
    onValuesChange([]);
    setSearch('');
    if (selectionMode === 'single') handleOpenChange(false);
  }, [allowEmpty, handleOpenChange, onValuesChange, selectionMode, setSearch]);
  const loadMoreVisible = loadMore?.visible ?? false;
  const loadMoreDisabled = loadMore?.disabled ?? false;
  const loadMoreLoading = loadMore?.isLoading ?? false;
  const loadMoreOnClick = loadMore?.onClick;
  const requestLoadMore = React.useCallback(() => {
    if (!loadMoreVisible || loadMoreDisabled || loadMoreLoading) return;
    loadMoreOnClick?.();
  }, [loadMoreDisabled, loadMoreLoading, loadMoreOnClick, loadMoreVisible]);
  const markUserScrollIntent = React.useCallback(() => {
    hasUserScrollIntentRef.current = true;
  }, []);
  const handleListKeyDownCapture = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (['ArrowDown', 'End', 'PageDown', ' '].includes(event.key)) markUserScrollIntent();
    },
    [markUserScrollIntent]
  );
  const handleListScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const list = event.currentTarget;
      if (
        !hasUserScrollIntentRef.current ||
        list.clientHeight <= 0 ||
        list.scrollHeight <= list.clientHeight
      ) {
        return;
      }

      const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
      if (distanceToBottom > LOAD_MORE_SCROLL_THRESHOLD_PX) return;

      hasUserScrollIntentRef.current = false;
      requestLoadMore();
    },
    [requestLoadMore]
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={setTriggerNode}
          id={id}
          data-slot='choice-combobox-trigger'
          type='button'
          variant='outline'
          disabled={disabled}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          aria-label={triggerLabel}
          className={cn(
            'min-w-0 w-full justify-between gap-2 font-normal',
            selectedLabels.length === 0 && 'text-muted-foreground',
            className
          )}
        >
          <span className='min-w-0 flex-1 truncate text-left'>
            {selectedLabels.length > 0 ? selectedLabels.join(',') : placeholder}
          </span>
          <Icons.chevronsUpDown className='size-4 shrink-0 text-muted-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        align='start'
        container={portalContainer}
        finalFocus={triggerRef}
        onEscapeKeyDown={onEscapeKeyDown}
        onKeyDown={onKeyDown}
      >
        <Command shouldFilter={false}>
          {searchMode === 'none' ? null : (
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
              disabled={disabled}
            />
          )}
          <CommandList
            ref={listRef}
            aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
            onKeyDownCapture={handleListKeyDownCapture}
            onPointerDownCapture={markUserScrollIntent}
            onScroll={handleListScroll}
            onTouchMoveCapture={markUserScrollIntent}
            onWheelCapture={markUserScrollIntent}
          >
            <CommandEmpty>{isError ? errorText : isLoading ? loadingText : emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.has(option.value);
                const isSelectionDisabled =
                  option.disabled ||
                  (selectionMode === 'multiple' &&
                    ((!isSelected &&
                      maxSelected !== undefined &&
                      selectedValues.size >= maxSelected) ||
                      (isSelected && !allowEmpty && selectedValues.size === 1)));

                return (
                  <CommandItem
                    key={getOptionKey(option.value)}
                    value={`${getOptionKey(option.value)} ${option.label}`}
                    disabled={isSelectionDisabled}
                    aria-selected={isSelected}
                    onSelect={() => handleSelect(option)}
                  >
                    {selectionMode === 'multiple' ? (
                      <span
                        aria-hidden='true'
                        className={cn(
                          'border-primary flex size-4 items-center justify-center rounded-sm border',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <Icons.check className='size-4 text-primary-foreground' />
                      </span>
                    ) : (
                      <span
                        aria-hidden='true'
                        className={cn(
                          'flex size-4 items-center justify-center',
                          !isSelected && '[&_svg]:invisible'
                        )}
                      >
                        <Icons.check className='size-4 text-primary' />
                      </span>
                    )}
                    <span className='truncate'>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {allowEmpty && selectedValues.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleClear} className='justify-center text-center'>
                    {clearLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
            {loadMoreVisible ? (
              <div
                data-slot='choice-combobox-load-more-sentinel'
                role={loadMoreLoading ? 'status' : undefined}
                aria-live={loadMoreLoading ? 'polite' : undefined}
                aria-hidden={loadMoreLoading ? undefined : true}
                className={cn(
                  'pointer-events-none w-full',
                  loadMoreLoading
                    ? 'flex h-8 items-center justify-center gap-2 text-xs text-muted-foreground'
                    : 'h-px'
                )}
              >
                {loadMoreLoading ? (
                  <>
                    <Spinner aria-hidden='true' />
                    <span>{loadMore?.label ?? loadingText}</span>
                  </>
                ) : null}
              </div>
            ) : null}
          </CommandList>
          {isError && filteredOptions.length > 0 ? (
            <div role='alert' className='border-t px-3 py-2 text-sm text-destructive'>
              {errorText}
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SingleChoiceCombobox<TValue extends ChoiceComboboxValue = string>({
  value,
  onValueChange,
  ...props
}: SingleChoiceComboboxProps<TValue>) {
  const values = React.useMemo(() => (value == null ? [] : [value]), [value]);
  const handleValuesChange = React.useCallback(
    (nextValues: TValue[]) => onValueChange(nextValues[0] ?? null),
    [onValueChange]
  );

  return (
    <ChoiceCombobox
      {...props}
      values={values}
      selectionMode='single'
      onValuesChange={handleValuesChange}
    />
  );
}

export function MultipleChoiceCombobox<TValue extends ChoiceComboboxValue = string>({
  value,
  maxSelected,
  onValueChange,
  ...props
}: MultipleChoiceComboboxProps<TValue>) {
  return (
    <ChoiceCombobox
      {...props}
      values={value}
      selectionMode='multiple'
      maxSelected={maxSelected}
      onValuesChange={onValueChange}
    />
  );
}
