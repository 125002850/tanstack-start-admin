import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ExpandConfigEdge, ExpandTabEdge } from '@/types/data-table';
import { Icons } from '@/components/icons';

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

  return (
    <div
      id={panelId}
      data-slot='data-table-expand-panel'
      className='bg-background flex h-full min-h-0 flex-col overflow-hidden rounded-lg border'
    >
      <Tabs value={activeTab} onValueChange={onActiveTabChange} className='flex min-h-0 flex-1 flex-col gap-0'>
        <div className='flex items-center gap-3 border-b px-4 py-3'>
          <TabsList className='h-auto flex-wrap gap-1 p-1'>
            {availableTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className='min-w-20'>
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
        <div className='min-h-0 flex-1 overflow-auto px-4 py-4'>
          {availableTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className='mt-0 h-full outline-none'>
              {tab.render(row)}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
