import { Icons } from '@/components/icons';

export interface NavItem {
  id: string;
  title: string;
  url: string;
  linkable?: boolean;
  shortcut?: [string, string];
  icon?: keyof typeof Icons;
  items?: NavItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface NavItemWithOptionalChildren extends NavItem {
  items?: NavItemWithChildren[];
}

