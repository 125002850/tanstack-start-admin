import * as React from 'react';

import { Icons } from '@/components/icons';
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
import { CONDITION_INPUT_OPERATOR_LABELS } from '../lib/condition-operands';
import {
  getConditionOperatorGroup,
  type ConditionFieldType,
  type ConditionOperator
} from '../model/condition-model';
import { useRoutingCanvasOverlayOpen } from './routing-canvas-overlay-context';

const OPERATOR_GROUPS = ['文本', '数字', '日期', '布尔', '集合', '通用'] as const;

export function ConditionOperatorSelect({
  disabled,
  fieldType,
  onValueChange,
  operators,
  overlayId,
  value,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy
}: {
  readonly disabled: boolean;
  readonly fieldType?: ConditionFieldType;
  readonly onValueChange: (value: ConditionOperator) => void;
  readonly operators: readonly ConditionOperator[];
  readonly overlayId: string;
  readonly value: ConditionOperator;
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
  const container = getContainer();
  const groups = OPERATOR_GROUPS.map((label) => ({
    label,
    operators: operators.filter(
      (operator) =>
        getConditionOperatorGroup(operator, fieldType) === label &&
        [label, operator, CONDITION_INPUT_OPERATOR_LABELS[operator]].some((text) =>
          text.toLocaleLowerCase().includes(keyword)
        )
    )
  })).filter((group) => group.operators.length > 0);
  const changeOpen = (open: boolean) => {
    setSearch('');
    overlay.onOpenChange(open);
  };
  useOverlayLifecycle(overlay.open, () => changeOpen(false));

  const renderOperators = (items: readonly ConditionOperator[], first: boolean) => (
    <DropdownMenuRadioGroup value={value}>
      {items.map((operator, index) => (
        <DropdownMenuRadioItem
          key={operator}
          ref={first && index === 0 ? firstItemRef : undefined}
          onSelect={() => onValueChange(operator)}
          value={operator}
        >
          {CONDITION_INPUT_OPERATOR_LABELS[operator]}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  return (
    <DropdownMenu open={overlay.open} onOpenChange={changeOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          ref={setTriggerNode}
          aria-label='条件操作符'
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className='nodrag nopan w-full min-w-0 justify-between gap-1 px-2'
          disabled={disabled}
          type='button'
          variant='outline'
        >
          <span className='truncate'>{CONDITION_INPUT_OPERATOR_LABELS[value]}</span>
          <Icons.chevronsUpDown className='size-4 shrink-0' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={setContentNode}
        align='end'
        aria-label='选择操作符类型'
        className='nodrag nopan nowheel w-40 max-w-[calc(50vw-0.75rem)]'
        collisionPadding={8}
        container={container}
      >
        <Input
          ref={searchRef}
          aria-label='搜索操作符'
          className='mb-1'
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Tab') return;
            event.stopPropagation();
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              firstItemRef.current?.focus();
            } else if (event.key === 'Enter' && keyword && groups[0]?.operators[0]) {
              event.preventDefault();
              onValueChange(groups[0].operators[0]);
              changeOpen(false);
            }
          }}
          placeholder='搜索操作符'
          value={search}
        />
        {keyword ? (
          groups.map((group, index) => (
            <DropdownMenuGroup key={group.label} aria-label={group.label}>
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {renderOperators(group.operators, index === 0)}
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
                    className='nodrag nopan nowheel max-h-(--radix-dropdown-menu-content-available-height) w-44 min-w-0 max-w-(--radix-dropdown-menu-content-available-width) overflow-y-auto'
                    collisionPadding={8}
                    sideOffset={4}
                  >
                    {renderOperators(group.operators, false)}
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
