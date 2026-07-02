import { useStore } from '@tanstack/react-form';
import {
  Select,
  SelectClear,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  useFieldContext,
  FormFieldSet,
  FormField,
  FormFieldError,
  createFormField
} from '@/components/ui/form-context';
import { Option } from '@/types';

interface SelectFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  options: Option[];
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

export function SelectField({
  label,
  description,
  required,
  options,
  placeholder = 'Select an option',
  allowClear = true,
  disabled
}: SelectFieldProps) {
  const field = useFieldContext();
  const value = useStore(field.store, (s) => s.value) as string;

  const showClear = allowClear && !!value && !disabled;

  return (
    <FormFieldSet>
      <FormField data-disabled={disabled}>
        <FieldLabel htmlFor={field.name} required={required}>
          {label}
        </FieldLabel>
        <Select
          value={value}
          disabled={disabled}
          onValueChange={field.handleChange}
          onOpenChange={(open) => {
            if (!open) field.handleBlur();
          }}
        >
          <SelectTrigger
            id={field.name}
            aria-label={label}
            aria-describedby={field.formMessageId}
            aria-invalid={field.isInvalid}
          >
            <SelectValue placeholder={placeholder} />
            {showClear && (
              <SelectClear
                aria-label={`清除${label}`}
                onClear={() => field.handleChange('')}
              />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormSelectField = createFormField(SelectField);
