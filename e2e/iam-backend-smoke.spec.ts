import { test, expect } from '@playwright/test';

const LOGIN = '/api/iam/auth/login';
const ME = '/api/iam/auth/me';
const PASSWORD_CHANGE = '/api/iam/auth/password/change';
const REFRESH = '/api/iam/auth/refresh';
const STAFF_PASSWORD_RESET = '/api/iam/staff/password/reset';

const ACCOUNT = {
  username: process.env.IAM_E2E_USERNAME?.trim() || 'admin',
  password: process.env.IAM_E2E_PASSWORD || 'Admin@123456'
};
const NEW_PASSWORD = process.env.IAM_E2E_NEW_PASSWORD || 'NewPass@123456';
const allowStateMutation = process.env.IAM_E2E_ALLOW_STATE_MUTATION === '1';

interface R<T = unknown> {
  code: number;
  msg: string;
  data: T | null;
}

interface LoginData {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
  staff?: {
    staffId?: number;
    [key: string]: unknown;
  };
  roles?: Array<Record<string, unknown>>;
}

interface MeData {
  staff: Record<string, unknown>;
  dept: Record<string, unknown>;
  roles: Array<Record<string, unknown>>;
  permissions: string[];
  menus: Array<{
    menuCode: string;
    menuKey: string;
    children?: MeData['menus'];
  }>;
  dataScopeSummary: Record<string, unknown>;
  mustChangePassword: boolean;
  permissionFingerprint: string;
}

test.describe.serial('IAM 后端验收 @iam-backend', () => {
  test.skip(
    !allowStateMutation,
    '该验收流程会修改并恢复默认管理员密码；需显式设置 IAM_E2E_ALLOW_STATE_MUTATION=1'
  );

  let token = '';
  let refreshToken = '';
  let staffId: number | null = null;
  let passwordChanged = false;

  test.afterAll(async ({ request }) => {
    if (!passwordChanged) return;
    if (!token || !staffId) {
      throw new Error('IAM 验收清理失败：缺少管理员 token 或 staffId，默认账号状态可能已被修改。');
    }

    const res = await request.post(STAFF_PASSWORD_RESET, {
      headers: { Authorization: `Bearer ${token}` },
      data: { staffId, newPassword: ACCOUNT.password }
    });
    const body: R = await res.json();

    if (res.status() !== 200 || body.code !== 200) {
      throw new Error(
        `IAM 验收清理失败：无法恢复默认管理员密码（HTTP ${res.status()}, code ${body.code}, msg ${body.msg}）。`
      );
    }

    passwordChanged = false;
  });

  test('POST /login 默认账号登录返回 mustChangePassword=true', async ({ request }) => {
    const res = await request.post(LOGIN, { data: ACCOUNT });
    expect(res.status()).toBe(200);
    const body: R<LoginData> = await res.json();
    expect(body.code).toBe(200);
    expect(body.msg).toBe('ok');
    expect(body.data).not.toBeNull();
    expect(body.data!.mustChangePassword).toBe(true);
    expect(body.data!.accessToken).toBeTruthy();
    expect(body.data!.refreshToken).toBeTruthy();
    expect(body.data!.staff).toBeTruthy();
    expect(body.data!.staff?.staffId).toBeTruthy();
    expect(body.data!.roles).toBeTruthy();
    token = body.data!.accessToken;
    refreshToken = body.data!.refreshToken;
    staffId = body.data!.staff!.staffId!;
  });

  test('mustChangePassword 访问非白名单接口返回 code=2001007 msg=必须修改密码', async ({
    request
  }) => {
    const res = await request.post('/api/iam/staff/list', {
      headers: { Authorization: `Bearer ${token}` },
      data: {}
    });
    const body: R = await res.json();
    expect(body.code).toBe(2001007);
    expect(body.msg).toBe('必须修改密码');
  });

  test('POST /password/change 强制改密成功，返回新令牌 mustChangePassword=false', async ({
    request
  }) => {
    const res = await request.post(PASSWORD_CHANGE, {
      headers: { Authorization: `Bearer ${token}` },
      data: { oldPassword: ACCOUNT.password, newPassword: NEW_PASSWORD }
    });
    expect(res.status()).toBe(200);
    const body: R<LoginData> = await res.json();
    if (body.code === 200) {
      passwordChanged = true;
      token = body.data?.accessToken ?? token;
      refreshToken = body.data?.refreshToken ?? refreshToken;
    }
    expect(body.code).toBe(200);
    expect(body.data!.mustChangePassword).toBe(false);
    expect(body.data!.accessToken).toBeTruthy();
    expect(body.data!.refreshToken).toBeTruthy();
  });

  test('改密后用旧密码登录返回 code=2001001', async ({ request }) => {
    const res = await request.post(LOGIN, {
      data: { username: ACCOUNT.username, password: ACCOUNT.password }
    });
    expect(res.status()).toBe(200);
    const body: R = await res.json();
    expect(body.code).toBe(2001001);
    expect(body.msg).toBe('用户名或密码错误');
  });

  test('POST /auth/me 返回完整权限快照字段', async ({ request }) => {
    const res = await request.post(ME, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.status()).toBe(200);
    const body: R<MeData> = await res.json();
    expect(body.code).toBe(200);

    const data = body.data!;
    expect(data).toHaveProperty('staff');
    expect(data).toHaveProperty('dept');
    expect(data).toHaveProperty('roles');
    expect(data).toHaveProperty('permissions');
    expect(data).toHaveProperty('menus');
    expect(data).toHaveProperty('dataScopeSummary');
    expect(data).toHaveProperty('mustChangePassword');
    expect(data).toHaveProperty('permissionFingerprint');
    expect(data.mustChangePassword).toBe(false);
  });

  test('/auth/me permissions 为 permissionCode 字符串数组', async ({ request }) => {
    const res = await request.post(ME, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body: R<MeData> = await res.json();
    const permissions = body.data!.permissions;
    expect(permissions.length).toBeGreaterThan(0);
    for (const permission of permissions) {
      expect(typeof permission).toBe('string');
      expect(permission).toMatch(/^[a-z]+:/);
    }
  });

  test('/auth/me menus 中 menuCode 与 menuKey 相等且不为空', async ({ request }) => {
    const res = await request.post(ME, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body: R<MeData> = await res.json();
    const verify = (menus: MeData['menus']) => {
      for (const menu of menus) {
        expect(menu.menuCode).toBeTruthy();
        expect(menu.menuKey).toBeTruthy();
        expect(menu.menuCode).toEqual(menu.menuKey);
        if (menu.children?.length) verify(menu.children);
      }
    };
    verify(body.data!.menus);
  });

  test('/auth/me 包含 permissionFingerprint', async ({ request }) => {
    const res = await request.post(ME, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const body: R<MeData> = await res.json();
    expect(body.data!.permissionFingerprint).toBeTruthy();
    expect(typeof body.data!.permissionFingerprint).toBe('string');
  });

  test('POST /auth/refresh 刷新会话成功', async ({ request }) => {
    const res = await request.post(REFRESH, {
      data: { refreshToken }
    });
    expect(res.status()).toBe(200);
    const body: R<LoginData> = await res.json();
    expect(body.code).toBe(200);
    expect(body.data!.accessToken).toBeTruthy();
    expect(body.data!.refreshToken).toBeTruthy();
    token = body.data!.accessToken;
    refreshToken = body.data!.refreshToken;
  });

  test('无 token 访问 /auth/me 返回 401', async ({ request }) => {
    const res = await request.post(ME);
    expect(res.status()).toBe(401);
    const body: R = await res.json();
    expect(body.code).toBe(401);
    expect(body.msg).toBe('未登录');
  });

  test('无效 token 访问 /auth/me 返回 401', async ({ request }) => {
    const res = await request.post(ME, {
      headers: { Authorization: 'Bearer invalid-token-xxx' }
    });
    expect(res.status()).toBe(401);
    const body: R = await res.json();
    expect(body.code).toBe(401);
  });

  test('POST /login 新密码登录成功，mustChangePassword=false', async ({ request }) => {
    const res = await request.post(LOGIN, {
      data: { username: ACCOUNT.username, password: NEW_PASSWORD }
    });
    expect(res.status()).toBe(200);
    const body: R<LoginData> = await res.json();
    expect(body.code).toBe(200);
    expect(body.data!.mustChangePassword).toBe(false);
    token = body.data!.accessToken;
    refreshToken = body.data!.refreshToken;
  });
});
