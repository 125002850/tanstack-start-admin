import { SearchCombobox } from '@/components/ui/search-combobox';
import * as React from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useOverlayLifecycle } from '@/components/ui/overlay-lifecycle';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { cn } from '@/lib/utils';
import {
  isConditionFieldSelectable,
  type ConditionField,
  type ConditionFieldType
} from '../model/condition-model';

import { useRoutingCanvasOverlayOpen } from './routing-canvas-overlay-context';

const FIELD_GROUPS = {
  CONTEXT: '上下文',
  ELEMENT: '当前项',
  PAYLOAD: '业务数据',
  OPTIONS: '执行选项',
  SYSTEM: '系统字段',
  LEGACY: '历史字段'
} satisfies Record<ConditionField['source'], string>;

const FIELD_TYPE_LABELS = {
  STRING: '文本',
  NUMBER: '数字',
  BOOLEAN: '布尔',
  DATE: '日期',
  DATETIME: '日期时间',
  DAY_OF_WEEK: '星期',
  TIME: '时间',
  STRING_ARRAY: '集合'
} satisfies Record<ConditionFieldType, string>;

function fieldName(field: ConditionField): string {
  return field.description?.trim() || field.label || field.path;
}

export function ConditionSearchSelect({
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
  readonly onValueChange: (value: string) => void;
  readonly options: readonly ConditionField[];
  readonly overlayId: string;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly triggerLabel: string;
  readonly value?: string;
  readonly 'aria-invalid'?: boolean;
  readonly 'aria-describedby'?: string;
}) {
  const overlay = useRoutingCanvasOverlayOpen(overlayId);
  const { getContainer, setTriggerNode } = useOverlayPortalContainer<HTMLButtonElement>();
  const searchRef = React.useRef<HTMLInputElement>(null);
  const firstItemRef = React.useRef<HTMLDivElement>(null);
  const [contentNode, setContentNode] = React.useState<HTMLDivElement | null>(null);
  const [search, setSearch] = React.useState('');
  React.useEffect(() => {
    if (contentNode) searchRef.current?.focus();
  }, [contentNode]);
  const keyword = search.trim().toLocaleLowerCase();
  const selectedOption = options.find((option) => option.path === value) ?? null;
  const container = getContainer();
  const groups = Object.entries(FIELD_GROUPS)
    .map(([source, label]) => ({
      label,
      fields: options.filter(
        (option) =>
          option.source === source &&
          isConditionFieldSelectable(option) &&
          [
            option.label,
            option.path,
            option.description,
            label,
            FIELD_TYPE_LABELS[option.type]
          ].some((text) => text?.toLocaleLowerCase().includes(keyword))
      )
    }))
    .filter((group) => group.fields.length > 0);
  const changeOpen = (open: boolean) => {
    setSearch('');
    overlay.onOpenChange(open);
  };
  useOverlayLifecycle(overlay.open, () => changeOpen(false));

  const renderFields = (fields: readonly ConditionField[], first: boolean) => (
    <DropdownMenuRadioGroup value={value ?? ''}>
      {fields.map((option, index) => (
        <DropdownMenuRadioItem
          key={option.path}
          ref={first && index === 0 ? firstItemRef : undefined}
          aria-label={[
            ...new Set([fieldName(option), option.path, FIELD_TYPE_LABELS[option.type]])
          ].join(' ')}
          onSelect={() => onValueChange(option.path)}
          title={option.path}
          value={option.path}
        >
          <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <span className='flex min-w-0 items-center gap-2'>
              <span className='min-w-0 flex-1 truncate'>{fieldName(option)}</span>
              <Badge variant='outline'>{FIELD_TYPE_LABELS[option.type]}</Badge>
            </span>
            {fieldName(option) === option.path ? null : (
              <span className='text-muted-foreground truncate font-mono text-xs'>
                {option.path}
              </span>
            )}
          </span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  return (
    <DropdownMenu open={overlay.open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={setTriggerNode}
          aria-label={triggerLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className='nodrag nopan w-full min-w-0 justify-between gap-1 px-2 font-normal'
          disabled={disabled}
          title={selectedOption?.path}
          type='button'
          variant='outline'
        >
          <span className='truncate'>{selectedOption?.path ?? placeholder}</span>
          <Icons.chevronsUpDown className='shrink-0' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={setContentNode}
        align='start'
        aria-label={'选择' + triggerLabel}
        className={cn(
          'nodrag nopan nowheel min-w-0 max-w-[calc(100vw-2rem)]',
          keyword ? 'w-80' : 'w-40'
        )}
        collisionPadding={8}
        container={container}
      >
        <Input
          ref={searchRef}
          aria-label={searchPlaceholder}
          className='mb-1'
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Tab') return;
            event.stopPropagation();
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              firstItemRef.current?.focus();
            } else if (event.key === 'Enter' && keyword && groups[0]?.fields[0]) {
              event.preventDefault();
              onValueChange(groups[0].fields[0].path);
              changeOpen(false);
            }
          }}
          placeholder='搜索字段'
          value={search}
        />
        {keyword ? (
          groups.map((group, index) => (
            <DropdownMenuGroup key={group.label} aria-label={group.label}>
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {renderFields(group.fields, index === 0)}
            </DropdownMenuGroup>
          ))
        ) : (
          <DropdownMenuGroup>
            {groups.map((group, index) => (
              <DropdownMenuSub key={group.label}>
                <DropdownMenuSubTrigger ref={index === 0 ? firstItemRef : undefined}>
                  {group.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal container={container}>
                  <DropdownMenuSubContent
                    aria-label={group.label}
                    className='nodrag nopan nowheel max-h-(--radix-dropdown-menu-content-available-height) w-80 min-w-0 max-w-(--radix-dropdown-menu-content-available-width) overflow-y-auto'
                    collisionPadding={8}
                    sideOffset={4}
                  >
                    {renderFields(group.fields, false)}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ))}
          </DropdownMenuGroup>
        )}
        {groups.length === 0 ? (
          <p className='text-muted-foreground px-2 py-3 text-sm' role='status'>
            没有匹配的选项
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ConditionSearchOption<TValue extends string> = {
  readonly value: TValue;
  readonly label: string;
  readonly description?: string;
  readonly group?: string;
};

export function ConditionExpressionSelect<TValue extends string>({
  className,
  id,
  disabled,
  onValueChange,
  options,
  overlayId,
  placeholder,
  searchPlaceholder,
  triggerLabel,
  triggerAppearance,
  value,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy
}: {
  readonly className?: string;
  readonly id?: string;
  readonly disabled: boolean;
  readonly onValueChange: (value: TValue) => void;
  readonly options: readonly ConditionSearchOption<TValue>[];
  readonly overlayId: string;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly triggerLabel: string;
  readonly triggerAppearance?: 'input' | 'button';
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
      id={id}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      className={cn('nodrag nopan w-full', className)}
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
      triggerAppearance={triggerAppearance}
      value={selectedOption}
    />
  );
}
