import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tree, type TreeItem } from '@/components/ui/tree';
import { handleFormSubmitError } from '@/lib/query-client';

export interface EmployeePickerOption {
  employeeId: number;
  employeeNo: string;
  employeeName: string;
}

export interface EmployeePickerQuery {
  departmentId: string | null;
  keyword: string;
}

export interface EmployeePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: readonly EmployeePickerOption[];
  departments: readonly TreeItem[];
  employees: readonly EmployeePickerOption[];
  onQueryChange?: (query: EmployeePickerQuery) => void;
  onSelectionChange?: (employees: EmployeePickerOption[]) => void;
  renderSelectedEmployee?: (employee: EmployeePickerOption) => ReactNode;
  onConfirm?: (employees: EmployeePickerOption[]) => void | Promise<void>;
  onLoadMore?: () => void;
  pending?: boolean;
  loadingMore?: boolean;
  error?: ReactNode;
  onRetry?: () => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  footer?: ReactNode;
}

/** 数据和认证由 feature 提供；跨部门、跨页选择按稳定员工 ID 保留。 */
export function EmployeePickerDialog({
  open,
  onOpenChange,
  value,
  departments,
  employees,
  onQueryChange,
  onSelectionChange,
  renderSelectedEmployee,
  onConfirm,
  onLoadMore,
  pending = false,
  loadingMore = false,
  error,
  onRetry,
  disabled = false,
  title = '选择员工',
  description = '从组织目录选择员工；已选员工可跨部门保留。',
  footer
}: EmployeePickerDialogProps) {
  const id = useId();
  const [departmentSearch, setDepartmentSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<number, EmployeePickerOption>>(new Map());
  const [confirming, setConfirming] = useState(false);
  const running = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const notifyQuery = useEffectEvent((query: EmployeePickerQuery) => onQueryChange?.(query));
  useEffect(() => {
    if (!open) return;
    setSelected(new Map(value.map((employee) => [employee.employeeId, employee])));
    setKeyword('');
    setDepartmentSearch('');
    setDepartmentId(null);
  }, [open, value]);
  useEffect(() => {
    if (open) notifyQuery({ departmentId, keyword });
  }, [open, departmentId, keyword]);
  const items = useMemo(
    () => [{ value: id, label: '全部员工', children: [...departments] }],
    [departments, id]
  );
  const visible = useMemo(
    () =>
      employees.filter(
        (employee) =>
          onQueryChange ||
          `${employee.employeeName} ${employee.employeeNo}`
            .toLocaleLowerCase()
            .includes(keyword.trim().toLocaleLowerCase())
      ),
    [employees, keyword, onQueryChange]
  );
  const locked = disabled || confirming;
  function change(next: Map<number, EmployeePickerOption>) {
    setSelected(next);
    onSelectionChange?.([...next.values()]);
  }
  async function confirm() {
    if (running.current || locked) return;
    running.current = true;
    setConfirming(true);
    try {
      await onConfirm?.([...selected.values()]);
      onOpenChange(false);
    } catch (failure) {
      handleFormSubmitError(failure);
    } finally {
      running.current = false;
      setConfirming(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!running.current) onOpenChange(next);
      }}
    >
      <DialogContent
        className='flex max-h-[90dvh] flex-col sm:max-w-5xl'
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[1fr_1.2fr_1.2fr]'>
          <section aria-label='部门' className='flex min-h-40 min-w-0 flex-col gap-2 lg:h-96'>
            <Field>
              <FieldLabel htmlFor={`${id}-departments`}>部门</FieldLabel>
              <Input
                id={`${id}-departments`}
                type='search'
                placeholder='搜索部门'
                value={departmentSearch}
                onChange={(event) => setDepartmentSearch(event.target.value)}
              />
            </Field>
            <div className='min-h-0 flex-1 overflow-auto'>
              <Tree
                items={items}
                searchQuery={departmentSearch}
                selection={{
                  mode: 'single',
                  value: departmentId ?? id,
                  onValueChange: (next) => setDepartmentId(next === id ? null : next)
                }}
              />
            </div>
          </section>
          <section aria-label='员工候选' className='flex min-h-40 min-w-0 flex-col gap-2 lg:h-96'>
            <Field>
              <FieldLabel htmlFor={`${id}-employees`}>员工</FieldLabel>
              <Input
                id={`${id}-employees`}
                type='search'
                placeholder='搜索姓名或工号'
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </Field>
            {error ? (
              <div role='alert'>
                {error}
                {onRetry ? (
                  <Button variant='outline' size='sm' onClick={onRetry}>
                    重试
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className='min-h-0 flex-1 overflow-auto' aria-busy={pending}>
              {pending ? <p className='text-sm text-muted-foreground'>正在加载员工…</p> : null}
              {!pending && visible.length === 0 ? (
                <p className='text-sm text-muted-foreground'>没有匹配的员工</p>
              ) : null}
              {visible.map((employee) => (
                <label
                  htmlFor={`${id}-employee-${employee.employeeId}`}
                  key={employee.employeeId}
                  className='flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-accent'
                >
                  <Checkbox
                    id={`${id}-employee-${employee.employeeId}`}
                    aria-label={`选择${employee.employeeName}`}
                    checked={selected.has(employee.employeeId)}
                    disabled={locked}
                    onCheckedChange={(checked) => {
                      const next = new Map(selected);
                      if (checked === true) next.set(employee.employeeId, employee);
                      else next.delete(employee.employeeId);
                      change(next);
                    }}
                  />
                  <span className='min-w-0 text-sm'>
                    <span className='block truncate'>{employee.employeeName}</span>
                    <span className='text-xs text-muted-foreground'>{employee.employeeNo}</span>
                  </span>
                </label>
              ))}
              {onLoadMore ? (
                <Button
                  className='w-full'
                  variant='outline'
                  disabled={pending || loadingMore || locked}
                  onClick={onLoadMore}
                  isLoading={loadingMore}
                >
                  加载更多
                </Button>
              ) : null}
            </div>
          </section>
          <section aria-label='已选员工' className='flex min-h-40 min-w-0 flex-col gap-2 lg:h-96'>
            <div className='flex items-center justify-between gap-2'>
              <span className='text-sm font-medium'>已选 {selected.size} 人</span>
              <Button
                size='sm'
                variant='ghost'
                disabled={locked || selected.size === 0}
                onClick={() => change(new Map())}
              >
                清空
              </Button>
            </div>
            <div className='min-h-0 flex-1 overflow-auto'>
              {[...selected.values()].map((employee) => (
                <div key={employee.employeeId} className='flex items-start gap-2 border-b py-2'>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm'>{employee.employeeName}</p>
                    <p className='text-xs text-muted-foreground'>{employee.employeeNo}</p>
                    {renderSelectedEmployee?.(employee)}
                  </div>
                  <Button
                    aria-label={`移除${employee.employeeName}`}
                    variant='ghost'
                    size='icon'
                    disabled={locked}
                    onClick={() => {
                      const next = new Map(selected);
                      next.delete(employee.employeeId);
                      change(next);
                    }}
                  >
                    <Icons.close className='size-4' />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
        <DialogFooter>
          {footer ?? (
            <Button
              onClick={() => void confirm()}
              disabled={locked || pending || !!error}
              isLoading={confirming}
            >
              确认选择
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
