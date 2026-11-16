import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { conditionFieldInput } from '../lib/condition-operands';
import type { ConditionField } from '../model/condition-model';
import { ConditionExpressionSelect as ConditionSearchSelect } from './condition-search-select';
import type { ConditionOperandInputProps } from './condition-tree-editor';

export function ConditionOperandInput({
  operand,
  catalog
}: {
  readonly operand: ConditionOperandInputProps;
  readonly catalog: readonly ConditionField[];
}) {
  const fields = catalog.filter(
    (field) => field.selectable !== false && field.expression !== undefined
  );
  return (
    <InputGroup>
      <InputGroupInput
        ref={operand.inputRef}
        id={operand.id}
        aria-label={operand.label}
        aria-invalid={operand.invalid}
        aria-describedby={operand.describedBy}
        disabled={operand.disabled}
        spellCheck={false}
        placeholder={operand.placeholder}
        value={operand.value}
        onChange={(event) => operand.onChange(event.target.value)}
      />
      <InputGroupAddon align='inline-end'>
        <ConditionSearchSelect
          className='size-6 shrink-0 justify-center border-0 p-0 shadow-none has-[>svg]:px-0 [&>svg]:hidden'
          disabled={operand.disabled}
          overlayId={`expression:${operand.conditionId}:${operand.side}:${operand.collectionIndex ?? ''}`}
          placeholder='fx'
          searchPlaceholder='搜索变量或表达式'
          triggerAppearance='button'
          triggerLabel={`为${operand.label}插入表达式`}
          options={[
            ...fields.map((field) => ({
              value: field.path,
              label: field.label,
              description: field.expression
            })),
            { value: '', label: '自定义表达式', description: '{{ $json.value }}' }
          ]}
          onValueChange={(path) =>
            operand.onChange(
              conditionFieldInput(
                fields.find((field) => field.path === path),
                '{{ $json.value }}'
              )
            )
          }
        />
      </InputGroupAddon>
    </InputGroup>
  );
}
