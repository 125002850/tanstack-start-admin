export interface LoginUserRsp {
  rspCode: string;
  msg: string;
  data: LoginUserData;
  success: boolean;
}

export interface LoginUserData {
  userId: string;
  phone: string;
  userName: string;
  realName: string;
  menuData: MenuDatum[];
  loginUrl: string;
  logoutUrl: string;
}

export interface MenuDatum {
  code: string;
  hiddenFlag: string;
  num: number;
  icon: string;
  parentId: string;
  url: string;
  nodeParentId: string;
  menuTips: string;
  children: MenuDatum[];
  appId: string;
  name: string;
  id: string;
  nodeId: string;
  levels: number;
  linkedList: unknown[];
}
