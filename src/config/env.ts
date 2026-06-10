function getEnvVar(name: string, defaultValue: string = ''): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const val = (import.meta.env as Record<string, string | undefined>)[name];
      if (val !== undefined) return val;
    }
  } catch {
    // import.meta unavailable (e.g. test environment without ESM)
  }
  return defaultValue;
}

function getEnvBool(name: string, defaultValue: boolean): boolean {
  const raw = getEnvVar(name, defaultValue ? '1' : '0');
  return raw === '1' || raw === 'true';
}

/** 所有 VITE_* 环境变量集中定义于此，禁止其他文件直接读取 import.meta.env.VITE_* */
export const env = {
  /** 是否启用工作区页签（默认开启） */
  workspaceTabsEnabled: getEnvBool('VITE_ENABLE_WORKSPACE_TABS', true),

  /** 是否启用产品表格虚拟滚动（默认开启） */
  productTableVirtualization: getEnvBool('VITE_ENABLE_PRODUCT_TABLE_VIRTUALIZATION', true),
  ssoClientID: getEnvVar('APP_SSO_CLIENT_ID'),
  ssoServiceID: getEnvVar('APP_SSO_SERVICE_ID'),
  ssoServiceCode: getEnvVar('APP_SSO_SERVICE_CODE')
} as const;
