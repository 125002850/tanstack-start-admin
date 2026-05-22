import { useLocation } from '@tanstack/react-router';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

const segmentTitleMapping: Record<string, string> = {
  dashboard: '控制台',
  overview: '仪表盘',
  employee: '员工',
  product: '产品',
  users: '用户',
  kanban: '看板',
  chat: '聊天',
  notifications: '通知',
  forms: '表单',
  basic: '基础表单',
  'multi-step': '多步骤表单',
  'sheet-form': '抽屉与弹窗',
  advanced: '高级模式',
  'react-query': 'React Query',
  elements: '组件',
  icons: '图标'
};

// This allows to add custom title as well
const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: '控制台', link: '/dashboard' }],
  '/dashboard/employee': [
    { title: '控制台', link: '/dashboard' },
    { title: '员工', link: '/dashboard/employee' }
  ],
  '/dashboard/product': [
    { title: '控制台', link: '/dashboard' },
    { title: '产品', link: '/dashboard/product' }
  ]
  // Add more custom mappings as needed
};

export function useBreadcrumbs() {
  const { pathname } = useLocation();

  const breadcrumbs = useMemo(() => {
    // Check if we have a custom mapping for this exact path
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    // If no exact match, fall back to generating breadcrumbs from the path
    const segments = pathname.split('/').filter(Boolean);
    const items = segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        title: segmentTitleMapping[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });

    return items;
  }, [pathname]);

  return breadcrumbs;
}
