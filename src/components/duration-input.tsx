import type { ComponentProps } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type DurationInputProps<Unit extends string> = Pick<
  ComponentProps<typeof InputGroupInput>,
  'type' | 'inputMode' | 'min' | 'step'
> & {
  id: string;
  label: string;
  value: { value: string; unit: Unit };
  units: Readonly<Record<Unit, { label: string }>>;
  onChange: (value: { value: string; unit: Unit }) => void;
  onBlur: () => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export function DurationInput<Unit extends string>({
  id,
  label,
  value,
  units,
  onChange,
  onBlur,
  invalid,
  describedBy,
  placeholder = '留空为不限',
  required = false,
  disabled = false,
  type = 'text',
  inputMode = 'numeric',
  min,
  step
}: DurationInputProps<Unit>) {
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        aria-label={label}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        aria-required={required}
        required={required}
        disabled={disabled}
        type={type}
        inputMode={inputMode}
        min={min}
        step={step}
        placeholder={placeholder}
        value={value.value}
        onBlur={onBlur}
        onChange={(event) => onChange({ ...value, value: event.target.value })}
      />
      <InputGroupAddon align='inline-end' className='self-stretch p-0 has-[>button]:mr-0'>
        <Select
          value={value.unit}
          required={required}
          disabled={disabled}
          onValueChange={(unit) => {
            if (Object.hasOwn(units, unit)) onChange({ ...value, unit: unit as Unit });
          }}
          onOpenChange={(open) => {
            if (!open) onBlur();
          }}
        >
          <SelectTrigger
            aria-label={`${label}单位`}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className='h-full w-24 rounded-l-none border-0 border-l shadow-none'
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries<{ label: string }>(units).map(([unit, option]) => (
                <SelectItem key={unit} value={unit}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </InputGroupAddon>
    </InputGroup>
  );
}
