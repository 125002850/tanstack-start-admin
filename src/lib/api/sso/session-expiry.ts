import { createStore } from 'zustand/vanilla';

export const sessionExpiryStore = createStore<{
  expired: boolean;
  logoutUrl: string | null;
  redirecting: boolean;
}>(() => ({ expired: false, logoutUrl: null, redirecting: false }));

export class SessionExpiredError extends Error {
  readonly status = 401;
  constructor() {
    super('登录状态已失效，请重新登录。');
    this.name = 'SessionExpiredError';
  }
}

export function assertSessionActive() {
  if (sessionExpiryStore.getState().expired) throw new SessionExpiredError();
}
