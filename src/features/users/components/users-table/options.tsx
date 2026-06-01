export const ROLE_OPTIONS = [
  { value: 'Developer', label: 'Developer' },
  { value: 'Designer', label: 'Designer' },
  { value: 'Manager', label: 'Manager' },
  { value: 'QA', label: 'QA' },
  { value: 'DevOps', label: 'DevOps' },
  { value: 'Product Owner', label: 'Product Owner' }
];

export const ROLE_VALUES = ROLE_OPTIONS.map((option) => option.value) as [string, ...string[]];
