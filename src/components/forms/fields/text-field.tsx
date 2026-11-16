import { useStore } from '@tanstack/react-form';
import { Input } from '@/components/ui/input';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  useFieldContext,
  FormFieldSet,
  FormField,
  FormFieldError,
  createFormField
} from '@/components/ui/form-context';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface TextFieldProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'onBlur'
> {
  label: string;
  description?: string;
  required?: boolean;
  endAdornment?: React.ReactNode;
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'number' | 'date' | 'time';
}

export function TextField({
  label,
  description,
  required,
  type = 'text',
  className,
  endAdornment,
  ...inputProps
}: TextFieldProps) {
  const field = useFieldContext();
  const isValidating = useStore(field.store, (s) => s.meta.isValidating);
  const value = useStore(field.store, (s) => s.value) as string | number;

  return (
    <FormFieldSet>
      <FormField data-disabled={inputProps.disabled}>
        <FieldLabel htmlFor={field.name} required={required}>
          {label}
        </FieldLabel>
        <div className='relative'>
          <Input
            id={field.name}
            aria-label={label}
            aria-required={required || undefined}
            type={type}
            value={value ?? ''}
            onBlur={field.handleBlur}
            onChange={(e) => {
              if (type === 'number') {
                const v = e.target.value;
                field.handleChange(v === '' ? '' : parseFloat(v));
              } else {
                field.handleChange(e.target.value);
              }
            }}
            aria-describedby={field.formMessageId}
            aria-invalid={field.isInvalid}
            className={cn(
              endAdornment && 'pr-11',
              endAdornment && isValidating && 'pr-16',
              className
            )}
            {...inputProps}
          />
          {(isValidating || endAdornment) && (
            <div
              className={cn(
                'absolute top-1/2 flex -translate-y-1/2 items-center gap-1',
                endAdornment ? 'right-1' : 'right-3'
              )}
            >
              {isValidating && <Spinner className='h-4 w-4' />}
              {endAdornment}
            </div>
          )}
        </div>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FormField>
      <FormFieldError />
    </FormFieldSet>
  );
}

export const FormTextField = createFormField(TextField);
