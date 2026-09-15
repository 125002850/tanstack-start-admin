import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  document.documentElement.removeAttribute('data-theme-mode-transition');
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(document.documentElement, 'animate');
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ThemeModeToggle', () => {
  it('从鼠标点击坐标展开新主题快照', async () => {
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
    vi.stubGlobal('devicePixelRatio', 2);
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: startViewTransition
    });
    Object.defineProperty(document.documentElement, 'animate', {
      configurable: true,
      value: animate
    });

    render(<ThemeModeToggle />);
    fireEvent.click(screen.getByRole('button', { name: '切换主题模式' }), {
      clientX: 120,
      clientY: 80,
      detail: 1
    });

    expect(theme.setTheme).toHaveBeenCalledWith('dark');
    await waitFor(() => expect(animate).toHaveBeenCalledTimes(1));
    expect(animate).toHaveBeenCalledWith(
      {
        clipPath: [
          'circle(0px at 240px 160px)',
          expect.stringMatching(/^circle\(.+px at 240px 160px\)$/)
        ],
        opacity: [0.7, 1],
        transformOrigin: ['240px 160px', '240px 160px']
      },
      {
        duration: 400,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)'
      }
    );
  });
});
