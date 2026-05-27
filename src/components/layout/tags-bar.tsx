import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icons } from '@/components/icons'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkspaceTags } from '@/features/workspace-tabs/hooks/use-workspace-tags'
import type { WorkspaceTagId } from '@/features/workspace-tabs/types'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'

export default function TagsBar() {
  const { tabs, activeId, openedOrder, lifecycleSnapshots, openOrActivate, close, closeOther, closeAll, refresh } =
    useWorkspaceTags()
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map())

  const activate = useCallback(
    (id: WorkspaceTagId) => {
      const tab = tabs[id]
      if (tab && id !== activeId) {
        openOrActivate({
          id: tab.id,
          href: tab.href,
          title: tab.title,
          closable: tab.closable,
          keepAlive: tab.keepAlive,
        })
      }
    },
    [tabs, activeId, openOrActivate],
  )

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent, id: WorkspaceTagId) => {
      const ids = openedOrder
      const idx = ids.indexOf(id)
      let next: string | undefined

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          next = ids[Math.max(0, idx - 1)]
          break
        case 'ArrowRight':
          e.preventDefault()
          next = ids[Math.min(ids.length - 1, idx + 1)]
          break
        case 'Enter':
          e.preventDefault()
          activate(id)
          return
        case 'Delete':
          e.preventDefault()
          close(id)
          return
        default:
          return
      }

      if (next && next !== id) {
        const btn = tabsRef.current.get(next)
        btn?.focus()
      }
    },
    [openedOrder, activate, close],
  )

  const handleClose = useCallback(
    (e: React.MouseEvent, id: WorkspaceTagId) => {
      e.stopPropagation()
      close(id)
    },
    [close],
  )

  if (!isWorkspaceTabsEnabled()) return null

  return (
    <ScrollArea className='flex-1' viewportProps={{ className: '[&>div]:flex' }}>
      <div className='flex items-center gap-0.5 pr-2' role='tablist' aria-label='Workspace tabs'>
        {openedOrder.map((id) => {
          const tab = tabs[id]
          if (!tab) return null
          const isActive = id === activeId

          return (
            <ContextMenu key={id}>
              <ContextMenuTrigger asChild>
                <button
                  ref={(el) => {
                    if (el) tabsRef.current.set(id, el)
                    else tabsRef.current.delete(id)
                  }}
                  role='tab'
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => activate(id)}
                  onKeyDown={(e) => handleKeyDown(e, id)}
                  className={cn(
                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  <span className='max-w-[120px] truncate'>{tab.title}</span>
                  {lifecycleSnapshots[id]?.dirty && (
                    <span
                      className='size-1.5 shrink-0 rounded-full bg-yellow-400'
                      aria-label={`${tab.title} has unsaved changes`}
                    />
                  )}
                  {tab.closable && (
                    <span
                      role='button'
                      aria-label={`Close ${tab.title}`}
                      onClick={(e) => handleClose(e, id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          close(id)
                        }
                      }}
                      tabIndex={-1}
                      className={cn(
                        'ml-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm',
                        'hover:bg-muted-foreground/20',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      )}
                    >
                      <Icons.close className='size-3' />
                    </span>
                  )}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className='w-48'>
                <ContextMenuItem onClick={() => refresh(id)}>
                  刷新页面
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => close(id)} disabled={!tab.closable}>
                  关闭标签
                </ContextMenuItem>
                <ContextMenuItem onClick={() => closeOther(id)}>
                  关闭其他标签
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={closeAll}>
                  关闭所有标签
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </div>
      <ScrollBar orientation='horizontal' className='h-1.5' />
    </ScrollArea>
  )
}
