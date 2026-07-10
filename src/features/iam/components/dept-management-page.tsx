import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { getIamMeQueryOptions } from '@/lib/api/iam/queries';
import { hasIamPermission } from '@/lib/api/iam/permissions';
import {
  iamDeptCreate,
  iamDeptDelete,
  iamDeptStatusUpdate,
  iamDeptUpdate,
  type DeptCreateReqDTO,
  type DeptRspDTO,
  type DeptUpdateReqDTO
} from '@/lib/api/clients/service';
import { iamDeptTreeQueryOptions } from '../api/query-options';
import { IAM_PERMISSIONS } from '../lib/constants';
import { nextStatus } from '../lib/format';
import { flattenDeptTree } from '../lib/tree';
import DeptDataTable from './dept-data-table';
import DeptDetailSheet from './dept-detail-sheet';
import DeptFormSheet from './dept-form-sheet';

const EMPTY_DEPT_TREE: DeptRspDTO[] = [];

function invalidateDeptTree(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    queryKey: ['service', 'iam-dept'],
    exact: false
  });
}

export default function DeptManagementPage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(getIamMeQueryOptions());
  const [keyword, setKeyword] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingDept, setEditingDept] = React.useState<DeptRspDTO | null>(null);
  const [parentDept, setParentDept] = React.useState<DeptRspDTO | null>(null);
  const [detailDept, setDetailDept] = React.useState<DeptRspDTO | null>(null);
  const query = useQuery(iamDeptTreeQueryOptions({ keyword: keyword.trim() || undefined }));
  const { isFetching: isDeptTreeFetching, refetch: refetchDeptTree } = query;
  const rows = query.data ?? EMPTY_DEPT_TREE;
  const totalCount = React.useMemo(() => flattenDeptTree(rows).length, [rows]);
  const canManageDept = hasIamPermission(me, IAM_PERMISSIONS.dept.manage);

  const createMutation = useMutation({
    mutationFn: (request: DeptCreateReqDTO) => iamDeptCreate(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门已创建');
    }
  });
  const updateMutation = useMutation({
    mutationFn: (request: DeptUpdateReqDTO) => iamDeptUpdate(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门已更新');
    }
  });
  const statusMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamDeptStatusUpdate>[0]) =>
      iamDeptStatusUpdate(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门状态已更新');
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (request: Parameters<typeof iamDeptDelete>[0]) => iamDeptDelete(request),
    onSuccess: async () => {
      await invalidateDeptTree(queryClient);
      toast.success('部门已删除');
    }
  });

  const handleToggleStatus = React.useCallback(
    async (dept: DeptRspDTO) => {
      if (!dept.deptId) return;
      await statusMutation.mutateAsync({
        deptId: dept.deptId,
        status: nextStatus(dept.status)
      });
    },
    [statusMutation]
  );

  const handleDeleteDept = React.useCallback(
    async (dept: DeptRspDTO) => {
      if (!dept.deptId) return;
      await deleteMutation.mutateAsync({ deptId: dept.deptId });
    },
    [deleteMutation]
  );

  return (
    <>
      <Card>
        <CardContent className='px-0'>
          <DeptDataTable
            rows={rows}
            totalCount={totalCount}
            isFetching={isDeptTreeFetching}
            keyword={keyword}
            onKeywordChange={setKeyword}
            canManageDept={canManageDept}
            onRefresh={async () => {
              await refetchDeptTree();
            }}
            onAddDept={(parent) => {
              setEditingDept(null);
              setParentDept(parent ?? null);
              setFormOpen(true);
            }}
            onEditDept={(dept) => {
              setEditingDept(dept);
              setParentDept(null);
              setFormOpen(true);
            }}
            onToggleStatus={handleToggleStatus}
            onDeleteDept={handleDeleteDept}
            onViewDetail={setDetailDept}
          />
        </CardContent>
      </Card>
      <DeptFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        dept={editingDept}
        parent={parentDept}
        tree={rows}
        onSubmit={async (payload) => {
          if ('deptId' in payload) {
            await updateMutation.mutateAsync(payload);
          } else {
            await createMutation.mutateAsync(payload);
          }
        }}
      />
      <DeptDetailSheet
        open={!!detailDept}
        onOpenChange={(open) => !open && setDetailDept(null)}
        dept={detailDept}
      />
    </>
  );
}
