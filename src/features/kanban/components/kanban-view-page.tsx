import PageContainer from '@/components/layout/page-container';
import { KanbanBoard } from './kanban-board';
import NewTaskDialog from './new-task-dialog';

export function KanbanManagementPage() {
  return (
    <div className='flex flex-col gap-4'>
      <div className='flex justify-end'>
        <NewTaskDialog />
      </div>
      <KanbanBoard />
    </div>
  );
}

export default function KanbanScreen() {
  return (
    <PageContainer>
      <KanbanManagementPage />
    </PageContainer>
  );
}
