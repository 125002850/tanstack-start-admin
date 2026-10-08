import { useStore } from '@tanstack/react-form';
import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import {
  useFieldContext,
  FormFieldSet,
  FormFieldError,
  createFormField
} from '@/components/ui/form-context';

interface CheckboxFieldProps extends Omit<
  React.ComponentProps<typeof Checkbox>,
  'checked' | 'children' | 'className' | 'defaultChecked' | 'id' | 'onCheckedChange'
> {
  checked: boolean;
  className?: string;
  description?: React.ReactNode;
  fieldLabel?: React.ReactNode;
  id: string;
  label: React.ReactNode;
  onCheckedChange: (checked: boolean) => void;
}

function ControlledCheckboxField({
  'aria-invalid': ariaInvalid,
  checked,
  className,
  description,
  disabled,
  fieldLabel,
  id,
  label,
  onCheckedChange,
  ...checkboxProps
}: CheckboxFieldProps) {
  const invalid = ariaInvalid === true || ariaInvalid === 'true';

  return (
    <Field className={className} data-disabled={disabled} data-invalid={invalid}>
      {fieldLabel ? <FieldTitle>{fieldLabel}</FieldTitle> : null}
      <FieldLabel
        className='border-input dark:bg-input/30 h-9 w-full cursor-pointer flex-row items-center rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow] has-[:disabled]:cursor-not-allowed'
        htmlFor={id}
      >
        <Checkbox
          {...checkboxProps}
          aria-invalid={ariaInvalid}
          checked={checked}
          disabled={disabled}
          id={id}
          onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
        />
        <span className='font-normal'>{label}</span>
      </FieldLabel>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

type TanStackCheckboxFieldProps = Omit<
  CheckboxFieldProps,
  'aria-describedby' | 'aria-invalid' | 'checked' | 'id' | 'onBlur' | 'onCheckedChange'
>;

function TanStackCheckboxField(props: TanStackCheckboxFieldProps) {
  const field = useFieldContext();
  const value = useStore(field.store, (s) => s.value) as boolean;

  return (
    <FormFieldSet>
      <ControlledCheckboxField
        {...props}
        aria-describedby={field.formMessageId}
        aria-invalid={field.isInvalid}
        checked={value}
        id={field.name}
        onBlur={field.handleBlur}
        onCheckedChange={(nextChecked) => {
          field.handleChange(nextChecked);
          field.handleBlur();
        }}
      />
      <FormFieldError />
    </FormFieldSet>
  );
}

// 兼容旧的 <CheckboxField label=... /> 上下文字段，同时支持受控字段。
function CheckboxField(props: CheckboxFieldProps | TanStackCheckboxFieldProps) {
  return 'checked' in props ? (
    <ControlledCheckboxField {...props} />
  ) : (
    <TanStackCheckboxField {...props} />
  );
}

const FormCheckboxField = createFormField(TanStackCheckboxField);

export type { CheckboxFieldProps, TanStackCheckboxFieldProps };
export { ControlledCheckboxField, CheckboxField, TanStackCheckboxField, FormCheckboxField };
