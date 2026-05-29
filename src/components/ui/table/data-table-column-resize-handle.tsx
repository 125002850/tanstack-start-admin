import { useCallback, useMemo } from 'react'
import type { Header } from '@tanstack/react-table'

interface DataTableColumnResizeHandleProps<TData> {
  header: Header<TData, unknown>
}

export function DataTableColumnResizeHandle<TData>({
  header,
}: DataTableColumnResizeHandleProps<TData>) {
  const resizeHandler = useMemo(() => header.getResizeHandler(), [header])

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'

      const cleanup = () => {
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
        document.removeEventListener('mouseup', cleanup)
      }
      document.addEventListener('mouseup', cleanup, { once: true })

      resizeHandler(event)
    },
    [resizeHandler],
  )

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      event.stopPropagation()

      const cleanup = () => {
        document.body.style.userSelect = ''
        document.removeEventListener('touchend', cleanup)
        document.removeEventListener('touchcancel', cleanup)
      }
      document.addEventListener('touchend', cleanup, { once: true })
      document.addEventListener('touchcancel', cleanup, { once: true })

      resizeHandler(event)
    },
    [resizeHandler],
  )

  if (!header.column.getCanResize()) return null

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- resize handle is mouse/touch-only; TanStack Table does not support keyboard column resize
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className='absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none touch-none z-10
        before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-px before:w-px
        hover:before:bg-border
        data-[resizing=true]:before:bg-primary/30'
      data-resizing={header.column.getIsResizing()}
    />
  )
}
