import { NavGroup } from '@/types';

/**
 * Navigation configuration
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 * Items are organized into groups, each rendered with a SidebarGroupLabel.
 */
export const navGroups: NavGroup[] = [
  {
    label: '概览',
    items: [
      {
        id: 'dashboard-overview',
        title: '仪表盘',
        url: '/dashboard/overview',
        icon: 'dashboard',
        shortcut: ['d', 'd'],
        items: []
      },
      {
        id: 'dashboard-product',
        title: '产品',
        url: '/dashboard/product',
        icon: 'product',
        shortcut: ['p', 'p'],
        items: []
      },
      {
        id: 'dashboard-users',
        title: '用户',
        url: '/dashboard/users',
        icon: 'teams',
        shortcut: ['u', 'u'],
        items: []
      },
      {
        id: 'dashboard-kanban',
        title: '看板',
        url: '/dashboard/kanban',
        icon: 'kanban',
        shortcut: ['k', 'k'],
        items: []
      },
      {
        id: 'dashboard-chat',
        title: '聊天',
        url: '/dashboard/chat',
        icon: 'chat',
        shortcut: ['c', 'c'],
        items: []
      }
    ]
  },
  {
    label: '组件',
    items: [
      {
        id: 'dashboard-forms',
        title: '表单',
        url: '/dashboard/forms',
        icon: 'forms',
        linkable: false,
        items: [
          {
            id: 'dashboard-forms-basic',
            title: '基础表单',
            url: '/dashboard/forms/basic',
            icon: 'forms',
            shortcut: ['f', 'f']
          },
          {
            id: 'dashboard-forms-multi-step',
            title: '多步骤表单',
            url: '/dashboard/forms/multi-step',
            icon: 'forms'
          },
          {
            id: 'dashboard-forms-sheet-form',
            title: '抽屉与弹窗',
            url: '/dashboard/forms/sheet-form',
            icon: 'forms'
          },
          {
            id: 'dashboard-forms-advanced',
            title: '高级模式',
            url: '/dashboard/forms/advanced',
            icon: 'forms'
          }
        ]
      },
      {
        id: 'dashboard-react-query',
        title: 'React Query',
        url: '/dashboard/react-query',
        icon: 'code',
        items: []
      },
      {
        id: 'dashboard-elements-icons',
        title: '图标',
        url: '/dashboard/elements/icons',
        icon: 'palette',
        items: []
      }
    ]
  },
  {
    label: '',
    items: [
      {
        id: 'account',
        title: '账户',
        url: '/dashboard/notifications',
        icon: 'account',
        linkable: false,
        items: [
          {
            id: 'dashboard-notifications',
            title: '通知',
            url: '/dashboard/notifications',
            icon: 'notification',
            shortcut: ['n', 'n']
          }
        ]
      }
    ]
  }
];
