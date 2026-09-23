import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SelectedObjectList } from './selected-object-list';
import type { ObjectPickerProps, ObjectPickerTableContext } from './types';

/** 挂载即打开；调用方关闭时卸载，并自行决定保留或丢弃受控草稿。 */
export function ObjectPicker<T>({
  title,
  selectedItems,
  getKey,
  getLabel,
  getCode,
  onSelectionChange,
  renderTable,
  renderSelectedItem,
  additionalTabs = [],
  busy = false,
  selectedStatus,
  confirmDisabled = false,
  onConfirm,
  onClose
}: ObjectPickerProps<T>) {
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false);
  const keyword = search.trim().toLocaleLowerCase();
  const normalized = useMemo(
    () =>
      Array.from(
        new Map(
          selectedItems.map((original) => [
            getKey(original),
            { key: getKey(original), label: getLabel(original), code: getCode(original), original }
          ])
        ).values()
      ),
    [selectedItems, getKey, getLabel, getCode]
  );
  const filtered = useMemo(
    () =>
      normalized.filter(
        (item) => !keyword || `${item.label} ${item.code}`.toLocaleLowerCase().includes(keyword)
      ),
    [normalized, keyword]
  );
  const rowSelection = Object.fromEntries(normalized.map((item) => [item.key, true]));
  const working = busy || pending;
  const disabled = working || !!selectedStatus?.loading || !!selectedStatus?.error;

  async function run(action: () => void | Promise<void>) {
    if (disabled || lock.current) return;
    lock.current = true;
    setPending(true);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '操作失败，请重试');
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  function changeSelection(next: T[]) {
    const byKey = new Map(next.map((item) => [getKey(item), item]));
    const currentKeys = new Set(normalized.map((item) => item.key));
    const added = [...byKey.values()].filter((item) => !currentKeys.has(getKey(item)));
    const removed = normalized.filter((item) => !byKey.has(item.key)).map((item) => item.original);
    if (!added.length && !removed.length) return;
    void run(() => onSelectionChange([...byKey.values()], { added, removed }));
  }

  const context: ObjectPickerTableContext<T> = {
    rowSelection,
    disabled,
    onRowSelectionChange: (updater, pageItems) => {
      if (disabled || lock.current) return;
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      const pageKeys = new Set(pageItems.map(getKey));
      changeSelection([
        ...normalized.filter((item) => !pageKeys.has(item.key)).map((item) => item.original),
        ...pageItems.filter((item) => next[getKey(item)])
      ]);
    }
  };
  const table = renderTable(context);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !working && !lock.current) onClose();
      }}
    >
      <DialogContent className='flex h-[85vh] flex-col sm:max-w-6xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_180px] gap-4 overflow-hidden'>
          {additionalTabs.length ? (
            <Tabs defaultValue='search' className='min-h-0 min-w-0'>
              <TabsList>
                <TabsTrigger value='search'>搜索选择</TabsTrigger>
                {additionalTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent
                forceMount
                value='search'
                className='flex min-h-0 flex-col data-[state=inactive]:hidden'
              >
                {table}
              </TabsContent>
              {additionalTabs.map((tab) => (
                <TabsContent
                  key={tab.value}
                  value={tab.value}
                  className='flex min-h-0 flex-col gap-3'
                >
                  {tab.content}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className='flex min-h-0 min-w-0 flex-col'>{table}</div>
          )}
          <section className='flex min-h-0 min-w-0 flex-col gap-2' aria-label='已选对象'>
            <p className='text-muted-foreground text-sm'>已选 {normalized.length} 项</p>
            <Input
              aria-label='搜索已选名称或编码'
              placeholder='搜索名称或编码'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div
              className='min-h-0 flex-1 overflow-y-auto'
              aria-busy={working || selectedStatus?.loading}
            >
              {selectedStatus?.error ? (
                <div className='space-y-2 text-sm' role='alert'>
                  <p>{selectedStatus.error}</p>
                  {selectedStatus.onRetry ? (
                    <Button variant='outline' size='sm' onClick={selectedStatus.onRetry}>
                      重试
                    </Button>
                  ) : null}
                </div>
              ) : selectedStatus?.loading ? (
                <p className='text-muted-foreground py-3 text-sm' role='status'>
                  正在加载…
                </p>
              ) : (
                <SelectedObjectList
                  key={keyword}
                  items={filtered}
                  busy={disabled}
                  keyword={keyword}
                  renderItem={renderSelectedItem}
                  onRemove={(item) =>
                    changeSelection(
                      normalized
                        .filter((entry) => entry.key !== getKey(item))
                        .map((entry) => entry.original)
                    )
                  }
                />
              )}
            </div>
          </section>
        </div>
        {actionError ? (
          <p role='alert' className='text-destructive text-sm'>
            {actionError}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant='outline' disabled={working} onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={disabled || confirmDisabled}
            onClick={() => void run(() => onConfirm(normalized.map((item) => item.original)))}
          >
            确认选择（{normalized.length}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
