import * as React from 'react';

import { useCallbackRef } from '@/hooks/use-callback-ref';

export type DebouncedCallback<T extends (...args: never[]) => unknown> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
};

export function useDebouncedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number
): DebouncedCallback<T> {
  const handleCallback = useCallbackRef(callback);
  const debounceTimerRef = React.useRef(0);
  const pendingArgsRef = React.useRef<Parameters<T> | null>(null);

  const cancel = React.useCallback(() => {
    window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = 0;
    pendingArgsRef.current = null;
  }, []);

  const flush = React.useCallback(() => {
    const pendingArgs = pendingArgsRef.current;
    if (!pendingArgs) return undefined;

    window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = 0;
    pendingArgsRef.current = null;
    return handleCallback(...pendingArgs) as ReturnType<T>;
  }, [handleCallback]);

  React.useEffect(() => cancel, [cancel]);

  const setValue = React.useCallback(
    (...args: Parameters<T>) => {
      window.clearTimeout(debounceTimerRef.current);
      pendingArgsRef.current = args;
      debounceTimerRef.current = window.setTimeout(flush, delay);
    },
    [delay, flush]
  );

  return React.useMemo(() => Object.assign(setValue, { cancel, flush }), [cancel, flush, setValue]);
}
