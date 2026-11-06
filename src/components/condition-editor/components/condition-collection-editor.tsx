import { useCallback, useRef, type ReactNode, type RefObject } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOverlayLifecycle } from '@/components/ui/overlay-lifecycle';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';
import { CONDITION_LIMITS } from '../model/condition-limits';
import {
  conditionCollectionItemInput,
  readConditionCollection,
  replaceConditionCollectionItem
} from '../lib/condition-operands';
import type { ConditionOperandInputProps, ConditionTreeEditorProps } from './condition-tree-editor';
import { RoutingCanvasOverlayProvider } from './routing-canvas-overlay-context';
import { RoutingReferenceSetSelector } from './routing-reference-set-selector';

export function ConditionCollectionEditor({
  operand,
  renderOperand,
  open,
  onOpenChange,
  finalFocus,
  children,
  reference,
  onSourceChange
}: {
  readonly operand: ConditionOperandInputProps;
  readonly renderOperand?: ConditionTreeEditorProps['renderOperand'];
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly finalFocus?: RefObject<HTMLElement | null>;
  readonly children: ReactNode;
  readonly reference?: {
    readonly value: string;
    readonly onChange: (value: string) => void;
  };
  readonly onSourceChange?: (source: 'input' | 'set') => void;
}) {
  const items = readConditionCollection(operand.value);
  const contentRef = useRef<HTMLDivElement>(null);
  const { container, setTriggerNode } = useOverlayPortalContainer<HTMLDivElement>();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useOverlayLifecycle(open, close);
  const fixedContent = items ? (
    <FieldGroup className='gap-2 [&>[data-slot=field-group]]:gap-2'>
      <FieldDescription>直接填写，或拖入变量。</FieldDescription>
      <FieldGroup key={items.length} className='max-h-72 gap-2 overflow-y-auto'>
        {items.map((source, index) => {
          const props: ConditionOperandInputProps = {
            ...operand,
            className: undefined,
            collectionSummary: undefined,
            inputRef: undefined,
            id: `${operand.id}-item-${index}`,
            label: `集合值 ${index + 1}`,
            collectionIndex: index,
            value: conditionCollectionItemInput(source),
            placeholder: '固定值或 {{ $json.value }}',
            onChange: (value) =>
              operand.onChange(replaceConditionCollectionItem(operand.value, index, value))
          };
          return (
            <Field
              key={index}
              orientation='horizontal'
              data-invalid={operand.invalid}
              className='gap-2 [&>[data-slot=field-label]]:flex-none'
            >
              <FieldLabel
                className='text-muted-foreground w-4 shrink-0 text-xs tabular-nums'
                htmlFor={props.id}
              >
                {index + 1}
              </FieldLabel>
              <div className='min-w-0 flex-1'>
                {renderOperand ? (
                  renderOperand(props)
                ) : (
                  <Input
                    id={props.id}
                    aria-label={props.label}
                    aria-invalid={props.invalid}
                    aria-describedby={props.describedBy}
                    disabled={props.disabled}
                    value={props.value}
                    placeholder={props.placeholder}
                    onChange={(event) => props.onChange(event.target.value)}
                  />
                )}
              </div>
              <Button
                type='button'
                size='icon'
                className='size-8'
                variant='ghost'
                disabled={operand.disabled}
                aria-label={`删除集合值 ${index + 1}`}
                onClick={() =>
                  operand.onChange(
                    `[${items.filter((_, itemIndex) => itemIndex !== index).join(',')}]`
                  )
                }
              >
                <Icons.trash className='size-4' />
              </Button>
            </Field>
          );
        })}
      </FieldGroup>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        className='justify-start'
        disabled={operand.disabled || items.length >= CONDITION_LIMITS.collectionValues}
        onClick={() => operand.onChange(`[${[...items, '""'].join(',')}]`)}
      >
        <Icons.add className='size-4' data-icon='inline-start' />
        添加一项
      </Button>
    </FieldGroup>
  ) : operand.value.includes('{{') && !operand.value.trim().startsWith('[') ? (
    <FieldGroup className='gap-2'>
      <FieldDescription>正在引用动态数组，可从字段目录替换数组变量。</FieldDescription>
      <Button
        type='button'
        variant='ghost'
        size='sm'
        disabled={operand.disabled}
        onClick={() => operand.onChange('[""]')}
      >
        改为逐项填写
      </Button>
    </FieldGroup>
  ) : (
    <FieldGroup className='gap-2'>
      <FieldDescription>集合格式不完整，可重新逐项填写。</FieldDescription>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={operand.disabled}
        onClick={() => operand.onChange('[""]')}
      >
        重新填写
      </Button>
    </FieldGroup>
  );
  const closeButton = (
    <Button
      type='button'
      size='icon'
      variant='ghost'
      className='ml-auto size-8'
      aria-label='关闭集合选项'
      onClick={close}
    >
      <Icons.close className='size-4' />
    </Button>
  );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={setTriggerNode} className='min-w-0'>
          {children}
        </div>
      </PopoverAnchor>
      <PopoverContent
        ref={contentRef}
        align='end'
        collisionPadding={16}
        container={container}
        finalFocus={finalFocus}
        aria-label='集合值'
        onEscapeKeyDown={(event) => {
          // 内层集合搜索先处理 Escape，保留当前编辑弹框。
          if (contentRef.current?.querySelector('[role="combobox"][aria-expanded="true"]'))
            event.preventDefault();
        }}
        className='nodrag nopan nowheel w-80 max-w-[calc(100vw-2rem)] max-h-(--radix-popover-content-available-height) space-y-3 overflow-y-auto p-3'
        onInteractOutside={(event) => {
          // 集合项保持为映射目标，允许在字段库内搜索、点击和拖动变量。
          if (
            event.target instanceof Element &&
            event.target.closest('[data-field-mapping-source]')
          )
            event.preventDefault();
        }}
      >
        {onSourceChange ? (
          <Tabs
            value={reference ? 'set' : 'input'}
            onValueChange={(value) => onSourceChange(value === 'set' ? 'set' : 'input')}
          >
            <div className='flex items-center gap-2'>
              <TabsList aria-label='集合来源'>
                <TabsTrigger value='input' disabled={operand.disabled}>
                  固定集合
                </TabsTrigger>
                <TabsTrigger value='set' disabled={operand.disabled}>
                  引用集合
                </TabsTrigger>
              </TabsList>
              {closeButton}
            </div>
            <TabsContent value='input'>{fixedContent}</TabsContent>
            <TabsContent value='set'>
              {reference ? (
                <RoutingCanvasOverlayProvider>
                  <RoutingReferenceSetSelector
                    appearance='compact'
                    nodeId={operand.conditionId}
                    value={reference.value}
                    disabled={operand.disabled}
                    onChange={reference.onChange}
                    validation={{
                      'aria-invalid': operand.invalid,
                      'aria-describedby': operand.describedBy
                    }}
                  />
                </RoutingCanvasOverlayProvider>
              ) : null}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <div className='flex items-center gap-2'>
              <p className='text-sm font-medium'>固定集合</p>
              {closeButton}
            </div>
            {fixedContent}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
