export type EnableStatus = 'ENABLED' | 'DISABLED';
export type MenuType = 'DIR' | 'MENU' | 'BUTTON';
export type DataScopeType = 'ALL' | 'DEPT_AND_CHILD' | 'DEPT_ONLY' | 'SELF' | 'CUSTOM_DEPT';

export interface ApiEnvelope<T> {
  code: number;
  msg: string;
  data: T;
}

export interface IamLoginReq {
  username: string;
  password: string;
}

export interface IamRefreshReq {
  refreshToken: string;
}

export interface IamLogoutReq {
  refreshToken?: string;
}

export interface IamPasswordChangeReq {
  oldPassword: string;
  newPassword: string;
}

export interface IamTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  tokenType: 'Bearer';
}

export interface IamPasswordChangeRsp extends IamTokenPair {
  mustChangePassword: false;
}

export interface IamCurrentStaff {
  staffId: number | string;
  username: string;
  staffCode?: string | null;
  staffName: string;
  avatar?: string | null;
  phone?: string | null;
  email?: string | null;
  status: EnableStatus;
  deptId?: number | string | null;
  deptName?: string | null;
}

export interface IamDeptSummary {
  deptId: number | string;
  deptCode?: string | null;
  deptName: string;
  parentId?: number | string | null;
  fullPath?: string | null;
  status?: EnableStatus;
}

export interface IamRoleSummary {
  roleId: number | string;
  roleCode: string;
  roleName: string;
  status: EnableStatus;
  dataScopeType?: DataScopeType;
  sortOrder?: number;
  systemBuiltIn?: boolean;
}

export interface IamMenuNode {
  menuId: number | string;
  parentId?: number | string | null;
  menuCode: string;
  menuKey?: string;
  menuName: string;
  menuType: MenuType;
  routePath?: string | null;
  componentPath?: string | null;
  icon?: string | null;
  sortOrder: number;
  hidden: boolean;
  cached: boolean;
  status: EnableStatus;
  permissionCode?: string | null;
  children?: IamMenuNode[];
}

export interface IamDataScopeRoleSummary {
  roleId: number | string;
  roleCode: string;
  roleName: string;
  scopeType: DataScopeType;
  deptIds?: Array<number | string>;
  deptNames?: string[];
}

export interface IamDataScopeSummary {
  effectiveType: DataScopeType | 'MIXED';
  deptIds?: Array<number | string>;
  deptNames?: string[];
  includeSelf: boolean;
  roleScopes?: IamDataScopeRoleSummary[];
  description: string;
}

export interface IamMe {
  staff: IamCurrentStaff;
  dept?: IamDeptSummary | null;
  roles: IamRoleSummary[];
  permissions: string[];
  menus: IamMenuNode[];
  dataScopeSummary: IamDataScopeSummary;
  dataScope: IamDataScopeSummary;
  mustChangePassword: boolean;
  permissionFingerprint?: string;
}

export interface IamLoginResult extends IamTokenPair {
  staff: IamCurrentStaff;
  mustChangePassword: boolean;
  dept?: IamDeptSummary | null;
  roles?: IamRoleSummary[];
  permissions?: string[];
  menus?: IamMenuNode[];
  dataScopeSummary?: IamDataScopeSummary;
  permissionFingerprint?: string;
}
