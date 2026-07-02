import * as React from 'react';

type AutocompleteInputOpenStateOptions = {
  disabled?: boolean;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

export function useAutocompleteInputOpenState({
  disabled = false,
  onBlur,
  onClick,
  onFocus,
  onKeyDown
}: AutocompleteInputOpenStateOptions) {
  const [open, setOpen] = React.useState(false);
  const blurCloseTimerRef = React.useRef(0);

  React.useEffect(() => () => window.clearTimeout(blurCloseTimerRef.current), []);

  const closeAfterBlur = React.useCallback(() => {
    window.clearTimeout(blurCloseTimerRef.current);
    blurCloseTimerRef.current = window.setTimeout(() => setOpen(false), 0);
  }, []);

  const handleBlur = React.useCallback<React.FocusEventHandler<HTMLInputElement>>(
    (event) => {
      onBlur?.(event);
      closeAfterBlur();
    },
    [closeAfterBlur, onBlur]
  );

  const handleFocus = React.useCallback<React.FocusEventHandler<HTMLInputElement>>(
    (event) => {
      onFocus?.(event);
      if (!disabled) setOpen(true);
    },
    [disabled, onFocus]
  );

  const handleClick = React.useCallback<React.MouseEventHandler<HTMLInputElement>>(
    (event) => {
      onClick?.(event);
      if (!disabled) {
        event.preventDefault();
        setOpen(true);
      }
    },
    [disabled, onClick]
  );

  const handleKeyDown = React.useCallback<React.KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
      if (event.key === 'Escape') setOpen(false);
      onKeyDown?.(event);
    },
    [onKeyDown]
  );

  return {
    open,
    setOpen,
    inputHandlers: {
      onBlur: handleBlur,
      onClick: handleClick,
      onFocus: handleFocus,
      onKeyDown: handleKeyDown
    }
  };
}
