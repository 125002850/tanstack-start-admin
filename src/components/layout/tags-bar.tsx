import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icons } from '@/components/icons'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useWorkspaceTags } from '@/features/workspace-tabs/hooks/use-workspace-tags'
import type { WorkspaceTabId } from '@/features/workspace-tabs/types'
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs'

export default function TagsBar() {
  const { tabs, activeId, openedOrder, lifecycleSnapshots, openOrActivate, close, closeOther, closeAll, refresh } =
    useWorkspaceTags()
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map())
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)

  const updateEdgeFades = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const hasOverflow = maxScrollLeft > 1

    setShowLeftFade(hasOverflow && viewport.scrollLeft > 1)
    setShowRightFade(hasOverflow && viewport.scrollLeft < maxScrollLeft - 1)
  }, [])

  const scrollToTab = useCallback((id: WorkspaceTabId) => {
    const tabEl = tabsRef.current.get(id)
    if (!tabEl) return
    requestAnimationFrame(() => {
      if (typeof tabEl.scrollIntoView !== 'function') return
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    })
  }, [])

  useEffect(() => {
    if (activeId) scrollToTab(activeId)
  }, [activeId, scrollToTab])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    updateEdgeFades()

    const handleViewportChange = () => {
      updateEdgeFades()
    }

    viewport.addEventListener('scroll', handleViewportChange, { passive: true })

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(handleViewportChange)
      resizeObserver.observe(viewport)

      const content = viewport.firstElementChild
      if (content instanceof HTMLElement) {
        resizeObserver.observe(content)
      }

      return () => {
        viewport.removeEventListener('scroll', handleViewportChange)
        resizeObserver.disconnect()
      }
    }

    window.addEventListener('resize', handleViewportChange)

    return () => {
      viewport.removeEventListener('scroll', handleViewportChange)
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [openedOrder, updateEdgeFades])

  const activate = useCallback(
    (id: WorkspaceTabId) => {
      const tab = tabs[id]
      if (tab && id !== activeId) {
        openOrActivate(tab)
      }
      scrollToTab(id)
    },
    [tabs, activeId, openOrActivate, scrollToTab],
  )

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent, id: WorkspaceTabId) => {
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
        scrollToTab(next)
      }
    },
    [openedOrder, activate, close, scrollToTab],
  )

  const handleClose = useCallback(
    (e: React.MouseEvent, id: WorkspaceTabId) => {
      e.stopPropagation()
      close(id)
    },
    [close],
  )

  if (!isWorkspaceTabsEnabled()) return null

  return (
    <ScrollArea
      className={cn(
        'relative flex-1 min-w-0 [&>[data-slot=scroll-area-scrollbar][data-orientation=horizontal]]:hidden',
        showLeftFade &&
          'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-6 before:bg-linear-to-r before:from-background before:to-transparent',
        showRightFade &&
          'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-6 after:bg-linear-to-l after:from-background after:to-transparent',
      )}
      viewportProps={{ className: '[&>div]:flex [&>div]:min-w-0' }}
      viewportRef={viewportRef}
    >
      <div className='flex min-w-0 items-center gap-px pr-2 py-px' role='tablist' aria-label='Workspace tabs'>
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
                  data-tab-id={id}
                  role='tab'
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => activate(id)}
                  onKeyDown={(e) => handleKeyDown(e, id)}
                  className={cn(
                    'group inline-flex h-7 shrink-0 items-center gap-1 rounded-sm px-2.5 text-xs transition-colors',
                    'hover:text-foreground',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    isActive
                      ? 'bg-card text-card-foreground shadow-[inset_0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.12)]'
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
                        'opacity-40 group-hover:opacity-100 transition-opacity',
                        'hover:text-foreground',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      )}
                    >
                      <Icons.close className='size-3 cursor-pointer' />
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
    </ScrollArea>
  )
}
