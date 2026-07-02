import { useStore } from '@tanstack/react-form';
import { Switch } from '@/components/ui/switch';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  useFieldContext,
  FormFieldSet,
  FormField,
  createFormField
} from '@/components/ui/form-context';

interface SwitchFieldProps {
  label: string;
  description?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function SwitchField({
  label,
  description,
  disabled,
  'aria-label': ariaLabel
}: SwitchFieldProps) {
  const field = useFieldContext();
  const value = useStore(field.store, (s) => s.value) as boolean;

  return (
    <FormFieldSet>
      <FormField orientation='horizontal' data-disabled={disabled}>
        <div className='flex flex-1 flex-col gap-1.5 leading-snug'>
          <FieldLabel htmlFor={field.name} className='text-base'>
            {label}
          </FieldLabel>
          {description && <FieldDescription>{description}</FieldDescription>}
        </div>
        <Switch
          id={field.name}
          aria-label={ariaLabel}
          checked={value}
          disabled={disabled}
          onCheckedChange={field.handleChange}
          onBlur={field.handleBlur}
        />
      </FormField>
    </FormFieldSet>
  );
}

export const FormSwitchField = createFormField(SwitchField);
