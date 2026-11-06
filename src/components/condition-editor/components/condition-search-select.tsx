import * as React from 'react';

import { SearchCombobox } from '@/components/ui/search-combobox';

import { useRoutingCanvasOverlayOpen } from './routing-canvas-overlay-context';

type ConditionSearchOption<TValue extends string> = {
  readonly value: TValue;
  readonly label: string;
  readonly description?: string;
  readonly group?: string;
};

export function ConditionSearchSelect<TValue extends string>({
  disabled,
  onValueChange,
  options,
  overlayId,
  placeholder,
  searchPlaceholder,
  triggerLabel,
  value,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy
}: {
  readonly disabled: boolean;
  readonly onValueChange: (value: TValue) => void;
  readonly options: readonly ConditionSearchOption<TValue>[];
  readonly overlayId: string;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly triggerLabel: string;
  readonly value?: TValue;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
}) {
  const overlay = useRoutingCanvasOverlayOpen(overlayId);
  const [search, setSearch] = React.useState('');
  const keyword = search.trim().toLocaleLowerCase();
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const filteredOptions = options.filter((option) =>
    [option.label, option.value, option.description, option.group].some((text) =>
      text?.toLocaleLowerCase().includes(keyword)
    )
  );

  return (
    <SearchCombobox
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      className='nodrag nopan w-full'
      contentClassName='w-80 max-w-[calc(100vw-2rem)] nodrag nopan nowheel'
      disabled={disabled}
      emptyText='没有匹配的选项'
      getItemAriaLabel={(option) => [option.label, option.description].filter(Boolean).join(' ')}
      getItemKey={(option) => option.value}
      getItemGroup={(option) => option.group}
      inputValue={search}
      isItemEqualToValue={(option, selected) => option?.value === selected?.value}
      itemToStringLabel={(option) => option?.label ?? ''}
      itemToStringValue={(option) => option?.value ?? ''}
      items={filteredOptions}
      onInputValueChange={setSearch}
      onOpenChange={(open) => {
        setSearch('');
        overlay.onOpenChange(open);
      }}
      onValueChange={(option) => {
        if (option !== null) onValueChange(option.value);
      }}
      open={overlay.open}
      placeholder={placeholder}
      renderItem={(option) => (
        <span className='flex min-w-0 flex-col items-start gap-0.5'>
          <span className='max-w-full truncate'>{option.label}</span>
          {option.description === undefined ? null : (
            <span className='text-muted-foreground max-w-full truncate text-xs'>
              {option.description}
            </span>
          )}
        </span>
      )}
      searchPlaceholder={searchPlaceholder}
      triggerLabel={triggerLabel}
      value={selectedOption}
    />
  );
}
