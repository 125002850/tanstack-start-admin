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
import { cn } from '@/lib/utils';

import { useOverlayPortalContainer } from './use-overlay-portal-container';

export type MultiSelectComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MultiSelectComboboxProps = {
  options: readonly MultiSelectComboboxOption[];
  value: string[];
  triggerLabel: string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  contentClassName?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  onValueChange: (value: string[]) => void;
};

export function MultiSelectCombobox({
  options,
  value,
  triggerLabel,
  placeholder,
  searchPlaceholder = `搜索${triggerLabel}`,
  emptyText = '未找到匹配项',
  clearLabel = '清除选择',
  disabled = false,
  id,
  className,
  contentClassName,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  onValueChange
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const selectedValues = React.useMemo(() => new Set(value), [value]);
  const { container, getContainer, setTriggerNode, triggerRef } =
    useOverlayPortalContainer<HTMLButtonElement>();
  const portalContainer = open ? (container ?? getContainer()) : container;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredOptions = React.useMemo(() => {
    if (!normalizedSearch) return options;

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedSearch) ||
        option.value.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch, options]);
  const selectedLabels = React.useMemo(
    () =>
      options
        .filter((option) => selectedValues.has(option.value))
        .map((option) => option.label),
    [options, selectedValues]
  );

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch('');
  }, []);

  const handleToggle = React.useCallback(
    (option: MultiSelectComboboxOption) => {
      if (option.disabled) return;

      const nextValues = new Set(selectedValues);
      if (nextValues.has(option.value)) {
        nextValues.delete(option.value);
      } else {
        nextValues.add(option.value);
      }

      onValueChange(Array.from(nextValues));
    },
    [onValueChange, selectedValues]
  );

  const handleClear = React.useCallback(() => {
    onValueChange([]);
    setSearch('');
  }, [onValueChange]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          ref={setTriggerNode}
          id={id}
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
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.has(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.value} ${option.label}`}
                    disabled={option.disabled}
                    aria-selected={isSelected}
                    onSelect={() => handleToggle(option)}
                  >
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
                    <span className='truncate'>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={handleClear} className='justify-center text-center'>
                    {clearLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
