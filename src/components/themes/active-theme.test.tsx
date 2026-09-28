import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ActiveThemeProvider, useThemeConfig } from './active-theme';
import { DEFAULT_THEME } from './theme.config';

function ThemeControl() {
  const { activeTheme, setActiveTheme } = useThemeConfig();
  return <button onClick={() => setActiveTheme('zen')}>{activeTheme}</button>;
}

// Node 环境下公共 setup 可能使用 Storage mock，保留与运行时相同的对象身份。
function storageEvent({ storageArea, ...init }: StorageEventInit) {
  const event = new StorageEvent('storage', init);
  Object.defineProperty(event, 'storageArea', { value: storageArea });
  return event;
}

function storageSpyTarget() {
  return localStorage instanceof Storage ? Storage.prototype : localStorage;
}

function receiveStorage(key: string | null, newValue: string | null, storageArea = localStorage) {
  if (key === null) storageArea.clear();
  else if (newValue === null) storageArea.removeItem(key);
  else storageArea.setItem(key, newValue);
  act(() => {
    window.dispatchEvent(storageEvent({ key, newValue, storageArea }));
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

it('applies theme changes without remounting or writing cookies', () => {
  const writeCookie = vi.spyOn(document, 'cookie', 'set');
  render(
    <ActiveThemeProvider initialTheme='vercel'>
      <ThemeControl />
    </ActiveThemeProvider>
  );
  receiveStorage('active_theme', 'claude');
  expect(screen.getByRole('button')).toHaveTextContent('claude');
  expect(document.documentElement).toHaveAttribute('data-theme', 'claude');
  fireEvent.click(screen.getByRole('button'));
  expect(document.documentElement).toHaveAttribute('data-theme', 'zen');
  expect(localStorage.getItem('active_theme')).toBe('zen');
  expect(writeCookie).not.toHaveBeenCalled();
});

it.each([
  ['active_theme', null],
  ['active_theme', 'unknown-theme'],
  [null, null]
])('restores the default for storage key %s with value %s', (key, value) => {
  render(
    <ActiveThemeProvider initialTheme='claude'>
      <ThemeControl />
    </ActiveThemeProvider>
  );
  receiveStorage(key, value);
  expect(screen.getByRole('button')).toHaveTextContent(DEFAULT_THEME);
  expect(document.documentElement).toHaveAttribute('data-theme', DEFAULT_THEME);
});

it('ignores unrelated keys and session storage, and removes the listener on unmount', () => {
  const { unmount } = render(
    <ActiveThemeProvider initialTheme='claude'>
      <ThemeControl />
    </ActiveThemeProvider>
  );
  receiveStorage('theme', 'dark');
  receiveStorage('active_theme', 'zen', sessionStorage);
  expect(document.documentElement).toHaveAttribute('data-theme', 'claude');
  unmount();
  receiveStorage('active_theme', 'zen');
  expect(document.documentElement).toHaveAttribute('data-theme', 'claude');
});

it('uses the latest stored theme for delayed events without writing it back', () => {
  render(
    <ActiveThemeProvider initialTheme='vercel'>
      <ThemeControl />
    </ActiveThemeProvider>
  );
  localStorage.setItem('active_theme', 'zen');
  const write = vi.spyOn(storageSpyTarget(), 'setItem');
  act(() => {
    window.dispatchEvent(
      storageEvent({
        key: 'active_theme',
        newValue: 'claude',
        storageArea: localStorage
      })
    );
  });
  expect(screen.getByRole('button')).toHaveTextContent('zen');
  expect(document.documentElement).toHaveAttribute('data-theme', 'zen');
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem('active_theme')).toBe('zen');
});

it('does not recreate a deleted stored preference', () => {
  render(
    <ActiveThemeProvider initialTheme='claude'>
      <ThemeControl />
    </ActiveThemeProvider>
  );
  receiveStorage('active_theme', null);
  expect(document.documentElement).toHaveAttribute('data-theme', DEFAULT_THEME);
  expect(localStorage.getItem('active_theme')).toBeNull();
});

it('still switches locally when local storage writes throw', () => {
  render(
    <ActiveThemeProvider initialTheme='claude'>
      <ThemeControl />
    </ActiveThemeProvider>
  );
  vi.spyOn(storageSpyTarget(), 'setItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  fireEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('button')).toHaveTextContent('zen');
  expect(document.documentElement).toHaveAttribute('data-theme', 'zen');
});

it('retains the current theme when reading storage fails', () => {
  render(
    <ActiveThemeProvider initialTheme='claude'>
      <ThemeControl />
    </ActiveThemeProvider>
  );
  vi.spyOn(storageSpyTarget(), 'getItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  receiveStorage('active_theme', 'zen');
  expect(screen.getByRole('button')).toHaveTextContent('claude');
  expect(document.documentElement).toHaveAttribute('data-theme', 'claude');
});
