import { toast } from 'sonner';
import { LoginRequiredError } from './sso/errors';
import { SessionExpiredError, sessionExpiryStore } from './sso/session-expiry';
import { createStore } from 'zustand/vanilla';

import {
  isApiRequestAbort,
  normalizeApiError,
  type ApiErrorInfo,
  type ApiErrorNormalizationOptions
} from './error-normalizer';

export interface ApiErrorPresentation extends ApiErrorInfo {
  readonly summary: string;
}

export const apiErrorDetailsStore = createStore<{ error: ApiErrorPresentation | null }>(() => ({
  error: null
}));

const MAX_TOAST_MESSAGE_LENGTH = 80;

/** Toast 和内联提示共用的安全展示信息；取消和会话异常由原有出口处理。 */
export function getApiErrorPresentation(
  error: unknown,
  options: ApiErrorNormalizationOptions = {}
): ApiErrorPresentation | null {
  if (
    isApiRequestAbort(error) ||
    error instanceof LoginRequiredError ||
    error instanceof SessionExpiredError
  )
    return null;
  const info = normalizeApiError(error, options);
  if (info.code === 'UNAUTHORIZED' && sessionExpiryStore.getState().expired) return null;
  if (info.message.length <= MAX_TOAST_MESSAGE_LENGTH && !/[\r\n]/u.test(info.message)) {
    return { ...info, summary: info.message };
  }

  return { ...info, summary: '操作失败，请查看详情。' };
}

/** 请求错误的统一通知出口；详情只持有归一化后的公开信息。 */
export function showApiError(error: unknown, options: ApiErrorNormalizationOptions = {}) {
  const details = getApiErrorPresentation(error, options);
  if (details === null) return;
  if (details.summary === details.message) {
    toast.error(details.summary);
    return;
  }

  toast.error(details.summary, {
    action: {
      label: '查看详情',
      onClick: () => apiErrorDetailsStore.setState({ error: details })
    }
  });
}
