import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { inputClassName } from '@/components/ui/input';
import { useAutocompleteInputOpenState } from '@/components/ui/use-autocomplete-input-open-state';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type AutocompleteInputProps<TItem> = Omit<
  React.ComponentProps<typeof CommandPrimitive.Input>,
  'children' | 'onSelect' | 'onValueChange' | 'value'
> & {
  empty?: React.ReactNode;
  getItemKey?: (item: TItem, index: number) => React.Key;
  getItemAriaLabel?: (item: TItem, index: number) => string;
  itemToValue: (item: TItem) => string;
  items: TItem[];
  loading?: boolean;
  loadingText?: React.ReactNode;
  onSelect: (item: TItem) => void;
  onValueChange: (value: string) => void;
  popoverClassName?: string;
  renderItem: (item: TItem, index: number) => React.ReactNode;
  value: string;
};

function AutocompleteInputInner<TItem>(
  {
    className,
    disabled = false,
    empty = '暂无匹配项',
    getItemAriaLabel,
    getItemKey,
    itemToValue,
    items,
    loading = false,
    loadingText = '加载中...',
    onBlur,
    onClick,
    onFocus,
    onKeyDown,
    onSelect,
    onValueChange,
    popoverClassName,
    renderItem,
    value,
    ...inputProps
  }: AutocompleteInputProps<TItem>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>
) {
  const {
    open,
    setOpen,
    inputHandlers: {
      onBlur: handleBlur,
      onClick: handleClick,
      onFocus: handleFocus,
      onKeyDown: handleKeyDown
    }
  } = useAutocompleteInputOpenState({
    disabled,
    onBlur,
    onClick,
    onFocus,
    onKeyDown
  });
  const { container, getContainer, setTriggerNode } = useOverlayPortalContainer<HTMLInputElement>();
  const hasItems = items.length > 0;
  const shouldShowContent = !disabled && open && (loading || hasItems || !!empty);
  const portalContainer = shouldShowContent ? (container ?? getContainer()) : container;
  const commandLabel =
    typeof inputProps['aria-label'] === 'string' ? inputProps['aria-label'] : 'Autocomplete';

  const setInputNode = React.useCallback(
    (node: HTMLInputElement | null) => {
      setTriggerNode(node);
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef, setTriggerNode]
  );

  return (
    <Command
      label={commandLabel}
      shouldFilter={false}
      className='overflow-visible rounded-none bg-transparent'
    >
      <Popover open={shouldShowContent} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <CommandPrimitive.Input
            ref={setInputNode}
            {...inputProps}
            value={value}
            disabled={disabled}
            className={inputClassName(className)}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onValueChange={(nextValue) => {
              onValueChange(nextValue);
              if (!disabled) setOpen(true);
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          align='start'
          container={portalContainer}
          className={cn('w-(--radix-popover-trigger-width) p-0', popoverClassName)}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <CommandList onMouseDown={(event) => event.preventDefault()}>
            {loading ? (
              <CommandEmpty>{loadingText}</CommandEmpty>
            ) : hasItems ? (
              <CommandGroup>
                {items.map((item, index) => {
                  const itemValue = itemToValue(item);
                  return (
                    <CommandItem
                      key={getItemKey?.(item, index) ?? itemValue}
                      value={itemValue}
                      aria-label={getItemAriaLabel?.(item, index) ?? itemValue}
                      onSelect={() => {
                        onSelect(item);
                        setOpen(false);
                      }}
                    >
                      {renderItem(item, index)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : (
              <CommandEmpty>{empty}</CommandEmpty>
            )}
          </CommandList>
        </PopoverContent>
      </Popover>
    </Command>
  );
}

const AutocompleteInput = React.forwardRef(AutocompleteInputInner) as <TItem>(
  props: AutocompleteInputProps<TItem> & React.RefAttributes<HTMLInputElement>
) => React.ReactElement;

export { AutocompleteInput };
