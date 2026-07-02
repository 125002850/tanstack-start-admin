import * as React from 'react';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';

interface UseDebouncedInputOptions {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

export function useDebouncedInput({
  value: externalValue,
  onChange,
  debounceMs = 300,
}: UseDebouncedInputOptions) {
  const [localValue, setLocalValue] = React.useState(externalValue);
  const isComposingRef = React.useRef(false);
  const debouncedOnChange = useDebouncedCallback(onChange, debounceMs);

  React.useEffect(() => {
    if (!isComposingRef.current) {
      setLocalValue(externalValue);
    }
  }, [externalValue]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const next = e.target.value;
      setLocalValue(next);
      if (!isComposingRef.current) {
        debouncedOnChange(next);
      }
    },
    [debouncedOnChange]
  );

  const handleCompositionStart = React.useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = React.useCallback(
    (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      isComposingRef.current = false;
      debouncedOnChange(e.currentTarget.value);
    },
    [debouncedOnChange]
  );

  return {
    value: localValue,
    onChange: handleChange,
    onCompositionStart: handleCompositionStart,
    onCompositionEnd: handleCompositionEnd,
  };
}
