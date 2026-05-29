import { AlertModal } from '@/components/modal/alert-modal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { deleteUserMutation } from '../../api/mutations'
import type { User } from '../../api/types'
import { Icons } from '@/components/icons'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { UserFormSheet } from '../user-form-sheet'

interface CellActionProps {
  data: User
}

export function CellAction({ data }: CellActionProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const deleteMutation = useMutation({
    ...deleteUserMutation,
    onSuccess: () => {
      toast.success('用户已删除')
      setDeleteOpen(false)
    },
    onError: () => {
      toast.error('删除用户失败')
    }
  })

  const actions = [
    {
      label: '编辑',
      icon: <Icons.edit className='size-4' />,
      onClick: () => setEditOpen(true),
    },
    {
      label: '删除',
      icon: <Icons.trash className='size-4' />,
      onClick: () => setDeleteOpen(true),
    },
  ]

  const visibleActions = actions.slice(0, 3)
  const moreActions = actions.slice(3)

  return (
    <>
      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate(data.id)}
        loading={deleteMutation.isPending}
        title='确认删除'
        description={`确定要删除用户 ${data.first_name} ${data.last_name} 吗？此操作不可撤销。`}
        cancelText='取消'
        confirmText='删除'
      />
      <UserFormSheet user={data} open={editOpen} onOpenChange={setEditOpen} />
      <div className='flex items-center gap-0.5'>
        {visibleActions.map((action) => (
          <Button
            key={action.label}
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={action.onClick}
            aria-label={action.label}
          >
            {action.icon}
          </Button>
        ))}
        {moreActions.length > 0 && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='h-8 w-8 p-0' aria-label='更多操作'>
                <Icons.ellipsis className='size-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              {moreActions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onClick={action.onClick}
                >
                  {action.icon}
                  <span className='ml-2'>{action.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  )
}
