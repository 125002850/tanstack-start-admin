import { useState } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { cn } from '@/lib/utils';
import { useConditionReferenceSets } from './condition-reference-sets';
import { useRoutingCanvasOverlayOpen } from './routing-canvas-overlay-context';

export function RoutingReferenceSetSelector({
  value,
  disabled,
  nodeId,
  onChange,
  validation,
  appearance = 'default'
}: {
  readonly value: string;
  readonly disabled: boolean;
  readonly nodeId: string;
  readonly onChange: (value: string) => void;
  readonly appearance?: 'default' | 'compact';
  readonly validation?: { readonly 'aria-invalid'?: boolean; readonly 'aria-describedby'?: string };
}) {
  const [search, setSearch] = useState('');
  const items = useConditionReferenceSets();
  const overlay = useRoutingCanvasOverlayOpen(`set-ref:${nodeId}`);
  const options = items.filter((option) => option.fieldType === 'STRING');
  const selected = options.find((option) => option.code === value);
  const unavailable = !!value && selected === undefined;
  return (
    <Field data-invalid={unavailable || validation?.['aria-invalid']}>
      <FieldLabel
        className={cn(appearance === 'compact' && 'sr-only')}
        htmlFor={`routing-set-ref-${nodeId}`}
        required
      >
        引用集合
      </FieldLabel>
      <SearchCombobox
        id={`routing-set-ref-${nodeId}`}
        items={options.filter((item) =>
          `${item.label} ${item.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
        )}
        value={selected ?? (value ? { code: value, label: value, fieldType: 'STRING' } : null)}
        disabled={disabled}
        open={overlay.open}
        onOpenChange={(open) => {
          overlay.onOpenChange(open);
          if (!open) setSearch('');
        }}
        inputValue={search}
        onInputValueChange={setSearch}
        onValueChange={(item) => {
          if (item) onChange(item.code);
        }}
        triggerLabel='引用集合'
        placeholder='选择数据集合'
        searchPlaceholder='搜索集合名称或编码'
        emptyText='没有匹配的集合'
        aria-required
        aria-invalid={unavailable || validation?.['aria-invalid']}
        aria-describedby={validation?.['aria-describedby']}
        className='nodrag nopan w-full'
        getItemKey={(item) => item.code}
        itemToStringLabel={(item) => item?.label ?? ''}
        itemToStringValue={(item) => item?.code ?? ''}
        isItemEqualToValue={(item, current) => item?.code === current?.code}
        renderItem={(item) => item.label}
      />
      {unavailable ? <FieldError>引用集合已不可用，请重新选择。</FieldError> : null}
      {options.length === 0 ? <FieldDescription>没有类型兼容的引用集合。</FieldDescription> : null}
    </Field>
  );
}

export function RoutingReferenceSetLabel({ code }: { readonly code: string }) {
  return (
    <span>
      引用集合：
      <RoutingReferenceSetName code={code} />
    </span>
  );
}

export function RoutingReferenceSetName({ code }: { readonly code: string }) {
  const items = useConditionReferenceSets();
  return <>{items.find((option) => option.code === code)?.label ?? code}</>;
}
