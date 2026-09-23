import { Icons } from '@/components/icons';
import { useThemeMode } from './use-theme-mode';
import * as React from 'react';
import { flushSync } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';

function getTransitionOrigin(event: React.MouseEvent<HTMLButtonElement>) {
  if (event.detail > 0) {
    return { x: event.clientX, y: event.clientY };
  }

  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2
  };
}

export function ThemeModeToggle() {
  const { toggleThemeMode } = useThemeMode();

  const handleThemeToggle = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const root = document.documentElement;
      const reducesMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (reducesMotion || typeof document.startViewTransition !== 'function') {
        toggleThemeMode();
        return;
      }

      const { x, y } = getTransitionOrigin(event);
      const snapshotScale = window.devicePixelRatio || 1;
      const animationX = x * snapshotScale;
      const animationY = y * snapshotScale;
      const radius =
        Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) *
        snapshotScale;
      root.setAttribute('data-theme-mode-transition', 'true');

      try {
        const transition = document.startViewTransition(() => {
          flushSync(() => toggleThemeMode());
        });

        void transition.ready
          .then(() => {
            root.animate(
              {
                clipPath: [
                  `circle(0px at ${animationX}px ${animationY}px)`,
                  `circle(${radius}px at ${animationX}px ${animationY}px)`
                ],
                opacity: [0.7, 1],
                transformOrigin: [
                  `${animationX}px ${animationY}px`,
                  `${animationX}px ${animationY}px`
                ]
              },
              {
                duration: 400,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-new(root)'
              }
            );
          })
          .catch(() => undefined);
        const cleanup = () => {
          root.removeAttribute('data-theme-mode-transition');
        };
        void transition.finished.then(cleanup, cleanup);
      } catch {
        root.removeAttribute('data-theme-mode-transition');
        toggleThemeMode();
      }
    },
    [toggleThemeMode]
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='secondary'
          size='icon'
          className='group/toggle size-8'
          onClick={handleThemeToggle}
        >
          <Icons.brightness />
          <span className='sr-only'>切换主题模式</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        切换主题模式 <Kbd>D D</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
