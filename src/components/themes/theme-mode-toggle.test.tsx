import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const theme = vi.hoisted(() => ({
  setTheme: vi.fn(),
  resolvedTheme: 'light'
}));

vi.mock('next-themes', () => ({
  useTheme: () => theme
}));

import { ThemeModeToggle } from './theme-mode-toggle';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme-mode-transition');
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(document.documentElement, 'animate');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each([1, 1.25, 2, 3])('ThemeModeToggle (DPR %s)', (devicePixelRatio) => {
  it.each(['鼠标', '键盘'])('%s 触发时以 CSS 像素计算原点和覆盖视口的半径', async (input) => {
    const animate = vi.fn();
    const ready = Promise.resolve();
    const finished = Promise.resolve();
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { ready, finished };
    });

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false }))
    );
    vi.stubGlobal('devicePixelRatio', devicePixelRatio);
    vi.stubGlobal('innerWidth', 920);
    vi.stubGlobal('innerHeight', 680);
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      value: animate
    });

    render(<ThemeModeToggle />);
    const toggle = screen.getByRole('button', { name: '切换主题模式' });
    vi.spyOn(toggle, 'getBoundingClientRect').mockReturnValue(new DOMRect(104, 64, 32, 32));
    fireEvent.click(
      toggle,
      input === '鼠标'
        ? { clientX: 120, clientY: 80, detail: 1 }
        : { clientX: 0, clientY: 0, detail: 0 }
    );

    expect(theme.setTheme).toHaveBeenCalledWith('dark');
    await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
    expect(animate).toHaveBeenCalledWith(
      {
        clipPath: ['circle(0px at 120px 80px)', 'circle(1000px at 120px 80px)'],
        opacity: [0.7, 1],
        transformOrigin: ['120px 80px', '120px 80px']
      },
      {
        duration: 400,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)'
      }
    );
  });
});
