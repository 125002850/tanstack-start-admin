import {
  MultipleChoiceCombobox,
  type ChoiceComboboxLoadMoreProps,
  type ChoiceComboboxOption,
  type ChoiceComboboxValue,
  type MultipleChoiceComboboxProps
} from './choice-combobox';

export type MultiSelectComboboxOption<TValue extends ChoiceComboboxValue = string> =
  ChoiceComboboxOption<TValue>;

export type MultiSelectComboboxLoadMoreProps = ChoiceComboboxLoadMoreProps;

type MultiSelectComboboxProps<TValue extends ChoiceComboboxValue = string> = Omit<
  MultipleChoiceComboboxProps<TValue>,
  'searchMode'
> & {
  shouldFilter?: boolean;
};

export function MultiSelectCombobox<TValue extends ChoiceComboboxValue = string>({
  shouldFilter = true,
  ...props
}: MultiSelectComboboxProps<TValue>) {
  return <MultipleChoiceCombobox {...props} searchMode={shouldFilter ? 'local' : 'remote'} />;
}
