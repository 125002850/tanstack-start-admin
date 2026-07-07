import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ExpandConfigEdge, ExpandTabEdge } from '@/types/data-table';
import { Icons } from '@/components/icons';

/**
 * 行展开详情面板。
 *
 * 面板使用 tabs 承载一行数据的多个详情视图；禁用的 tab 会在当前行上下文中过滤掉，
 * 激活态指示器通过测量当前 trigger 实现，避免 Tabs 默认样式和项目视觉冲突。
 */
interface DataTableExpandPanelProps<TData> {
  panelId: string;
  row: TData;
  expandConfig: ExpandConfigEdge<TData>;
  activeTab: string;
  onActiveTabChange: (tabId: string) => void;
  onClose: () => void;
}

function isTabDisabled<TData>(tab: ExpandTabEdge<TData>, row: TData) {
  return typeof tab.disabled === 'function' ? tab.disabled(row) : tab.disabled === true;
}

/** 按当前行过滤可用 tab，保证 disabled(row) 可以表达行级权限或状态限制。 */
export function getAvailableExpandTabs<TData>(expandConfig: ExpandConfigEdge<TData>, row: TData) {
  return expandConfig.tabs.filter((tab) => !isTabDisabled(tab, row));
}

export function DataTableExpandPanel<TData>({
  panelId,
  row,
  expandConfig,
  activeTab,
  onActiveTabChange,
  onClose
}: DataTableExpandPanelProps<TData>) {
  const availableTabs = getAvailableExpandTabs(expandConfig, row);
  const tabsListRef = React.useRef<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({ opacity: 0 });

  const updateTabIndicator = React.useCallback(() => {
    // 指示器不参与布局，只跟随当前 active trigger 的位置和尺寸。
    const tabsList = tabsListRef.current;
    const activeTrigger = Array.from(
      tabsList?.querySelectorAll<HTMLElement>('[data-expand-tab-trigger]') ?? []
    ).find((trigger) => trigger.dataset.expandTabTrigger === activeTab);

    if (!tabsList || !activeTrigger) {
      setIndicatorStyle((current) =>
        current.opacity === 0 ? current : { ...current, opacity: 0 }
      );
      return;
    }

    const listRect = tabsList.getBoundingClientRect();
    const triggerRect = activeTrigger.getBoundingClientRect();
    const nextStyle: React.CSSProperties = {
      width: triggerRect.width,
      height: triggerRect.height,
      transform: `translate(${triggerRect.left - listRect.left}px, ${
        triggerRect.top - listRect.top
      }px)`,
      opacity: 1
    };

    setIndicatorStyle((current) =>
      current.width === nextStyle.width &&
      current.height === nextStyle.height &&
      current.transform === nextStyle.transform &&
      current.opacity === nextStyle.opacity
        ? current
        : nextStyle
    );
  }, [activeTab]);

  React.useLayoutEffect(() => {
    // 每次布局后同步一次，覆盖 activeTab 变化和首屏挂载。
    updateTabIndicator();
  });

  React.useEffect(() => {
    const tabsList = tabsListRef.current;
    if (!tabsList) return;

    window.addEventListener('resize', updateTabIndicator);

    // tab 文案、换行或容器尺寸变化时，ResizeObserver 会重新定位指示器。
    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', updateTabIndicator);
      };
    }

    const resizeObserver = new ResizeObserver(updateTabIndicator);
    resizeObserver.observe(tabsList);

    return () => {
      window.removeEventListener('resize', updateTabIndicator);
      resizeObserver.disconnect();
    };
  }, [updateTabIndicator]);

  return (
    <div
      id={panelId}
      data-slot='data-table-expand-panel'
      className='bg-background flex flex-col overflow-hidden rounded-lg border'
    >
      <Tabs value={activeTab} onValueChange={onActiveTabChange} className='flex flex-col gap-0'>
        <div className='flex items-center gap-3 border-b px-4 py-2'>
          <TabsList ref={tabsListRef} className='relative isolate h-auto flex-wrap gap-1 p-1'>
            <span
              aria-hidden='true'
              className='bg-background pointer-events-none absolute top-0 left-0 rounded-md border border-transparent shadow-sm transition-[width,transform,opacity] duration-200 ease-out motion-reduce:transition-none dark:border-input dark:bg-input/30'
              style={indicatorStyle}
            />
            {availableTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                data-expand-tab-trigger={tab.id}
                className='relative z-10 min-w-20 flex-none data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent'
              >
                {tab.icon}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='ml-auto h-8 w-8'
            data-slot='data-table-expand-panel-close'
            onClick={onClose}
            aria-label='关闭详情面板'
          >
            <Icons.close className='size-4' />
          </Button>
        </div>
        <div className='px-4 py-4'>
          {availableTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className='mt-0 min-w-0 outline-none'>
              {tab.render(row)}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
