import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icons } from '@/components/icons';
import type { ObjectPickerItem } from './types';
import './selected-object-list.css';

type Entry<T> = { item: ObjectPickerItem<T>; exiting?: boolean; entering?: boolean };

/** 保留正在退出的展示行；外部受控名单仍是选择状态的唯一来源。 */
export function SelectedObjectList<T>({
  items,
  busy,
  keyword,
  onRemove,
  renderItem
}: {
  items: ObjectPickerItem<T>[];
  busy: boolean;
  keyword: string;
  onRemove: (item: T) => void;
  renderItem?: (item: T) => ReactNode;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [snapshot, setSnapshot] = useState(items);
  const [entries, setEntries] = useState<Entry<T>[]>(() => items.map((item) => ({ item })));
  const [batch, setBatch] = useState(0);
  if (snapshot !== items) {
    const previous = new Map(entries.map((entry) => [entry.item.key, entry]));
    const nextKeys = new Set(items.map((item) => item.key));
    const added = items.filter((item) => !previous.has(item.key));
    const next: Entry<T>[] = items.map((item) => ({
      item,
      entering: added.length === 1 && !previous.has(item.key)
    }));
    entries.forEach((entry, index) => {
      if (!nextKeys.has(entry.item.key)) {
        next.splice(index, 0, { item: entry.item, exiting: true });
      }
    });
    setSnapshot(items);
    setEntries(next);
    if (added.length > 1) setBatch(batch + 1);
  }

  useLayoutEffect(() => {
    if (!batch || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // 大名单只动画整个列表，避免为数千条记录分别创建动画。
    const animation = listRef.current?.animate([{ opacity: 0.4 }, { opacity: 1 }], {
      duration: 180,
      easing: 'ease-out'
    });
    return () => animation?.cancel();
  }, [batch]);

  return entries.length ? (
    <ul ref={listRef} aria-label='已选对象列表'>
      {entries.map(({ item, entering, exiting }) => (
        <li
          key={item.key}
          className='selected-object-row'
          data-motion={exiting ? 'exit' : entering ? 'enter' : undefined}
          aria-hidden={exiting || undefined}
          inert={exiting || undefined}
          onAnimationEnd={(event) => {
            if (exiting && event.target === event.currentTarget) {
              setEntries((current) =>
                current.filter((entry) => entry.item.key !== item.key || !entry.exiting)
              );
            }
          }}
        >
          <div className='min-h-0 overflow-hidden'>
            <button
              type='button'
              className='group hover:bg-accent focus-visible:bg-accent focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset disabled:cursor-wait disabled:opacity-50'
              aria-label={`移除 ${item.label}（${item.code}）`}
              title={`${item.label} · ${item.code}，点击移除`}
              disabled={busy || exiting}
              onClick={() => onRemove(item.original)}
            >
              <span className='min-w-0 flex-1'>
                {renderItem ? (
                  renderItem(item.original)
                ) : (
                  <>
                    <span className='block truncate text-sm'>{item.label || item.code}</span>
                    <span className='text-muted-foreground block truncate text-xs'>
                      {item.code}
                    </span>
                  </>
                )}
              </span>
              <Icons.close className='text-muted-foreground size-3.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' />
            </button>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p className='text-muted-foreground py-3 text-sm'>
      {keyword ? '没有匹配的已选对象' : '暂无已选对象'}
    </p>
  );
}
