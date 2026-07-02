import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue
} from '@/components/ui/combobox';
import { cn } from '@/lib/utils';

import { useOverlayPortalContainer } from './use-overlay-portal-container';

type SearchComboboxLoadMoreProps = {
  disabled?: boolean;
  isLoading?: boolean;
  label: string;
  onClick: () => void;
  visible: boolean;
};

type SearchComboboxProps<TItem> = {
  items: TItem[];
  value?: TItem | null;
  open: boolean;
  inputValue: string;
  triggerLabel: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  loadingText?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  contentClassName?: string;
  allowClear?: boolean;
  clearLabel?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  loadMore?: SearchComboboxLoadMoreProps;
  onOpenChange: (open: boolean) => void;
  onInputValueChange: (value: string) => void;
  onValueChange: (value: TItem | null) => void;
  itemToStringLabel: (item?: TItem | null) => string;
  itemToStringValue: (item?: TItem | null) => string;
  isItemEqualToValue: (item?: TItem | null, value?: TItem | null) => boolean;
  getItemKey: (item: TItem, index: number) => React.Key;
  getItemAriaLabel?: (item: TItem, index: number) => string;
  renderItem: (item: TItem, index: number) => React.ReactNode;
};

export function SearchCombobox<TItem>({
  items,
  value = null,
  open,
  inputValue,
  triggerLabel,
  placeholder,
  searchPlaceholder,
  emptyText,
  loadingText = emptyText,
  disabled = false,
  isLoading = false,
  className,
  contentClassName,
  allowClear = false,
  clearLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  loadMore,
  onOpenChange,
  onInputValueChange,
  onValueChange,
  itemToStringLabel,
  itemToStringValue,
  isItemEqualToValue,
  getItemKey,
  getItemAriaLabel,
  renderItem
}: SearchComboboxProps<TItem>) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const selectedLabel = itemToStringLabel(value);
  const showClear = allowClear && !!selectedLabel && !disabled;
  const portalContainer = open ? (container ?? getContainer()) : container;
  const handleClear = React.useCallback(
    (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onValueChange(null);
      onInputValueChange('');
      if (open) onOpenChange(false);
    },
    [onInputValueChange, onOpenChange, onValueChange, open]
  );

  return (
    <Combobox
      items={items}
      filter={null}
      autoHighlight
      modal={false}
      value={value}
      inputValue={inputValue}
      open={open}
      disabled={disabled}
      itemToStringLabel={itemToStringLabel}
      itemToStringValue={itemToStringValue}
      isItemEqualToValue={isItemEqualToValue}
      onInputValueChange={onInputValueChange}
      onOpenChange={onOpenChange}
      onValueChange={(nextValue) => onValueChange(nextValue ?? null)}
    >
      <ComboboxTrigger
        ref={setTriggerNode}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-label={triggerLabel}
        render={
          <Button
            type='button'
            variant='outline'
            className={cn(
              'min-w-0 w-full overflow-hidden justify-between gap-2 font-normal',
              !selectedLabel && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <span className='min-w-0 max-w-full flex-1 truncate text-left'>
          <ComboboxValue placeholder={placeholder} />
        </span>
        {showClear ? (
          <span
            role='button'
            tabIndex={0}
            aria-label={clearLabel ?? `清除${triggerLabel}`}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={handleClear}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                handleClear(event);
              }
            }}
            className='pointer-events-auto ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          >
            <Icons.close className='pointer-events-none' />
          </span>
        ) : null}
      </ComboboxTrigger>
      <ComboboxContent
        className={cn('p-0', contentClassName)}
        container={portalContainer}
        sideOffset={4}
        initialFocus={inputRef}
        finalFocus={triggerRef}
      >
        <div className='border-b p-1'>
          <ComboboxInput
            ref={inputRef}
            disabled={disabled}
            showTrigger={false}
            placeholder={searchPlaceholder}
            className='w-full'
          />
        </div>
        <ComboboxEmpty>{isLoading ? loadingText : emptyText}</ComboboxEmpty>
        <ComboboxList>
          <ComboboxGroup>
            {items.map((item, index) => (
              <ComboboxItem
                key={getItemKey(item, index)}
                value={item}
                index={index}
                aria-label={getItemAriaLabel?.(item, index) ?? itemToStringLabel(item)}
              >
                {renderItem(item, index)}
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
        {loadMore?.visible ? (
          <div className='border-t p-1'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              aria-label={loadMore.label}
              className='w-full'
              isLoading={loadMore.isLoading || undefined}
              disabled={loadMore.disabled}
              onClick={loadMore.onClick}
            >
              {loadMore.label}
            </Button>
          </div>
        ) : null}
      </ComboboxContent>
    </Combobox>
  );
}
