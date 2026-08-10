import { TouchSensor } from '@dnd-kit/core';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDndClickDragSensors } from '@/hooks/use-dnd-click-drag-sensors';

type PointerActivator = (
  event: {
    nativeEvent: {
      isPrimary: boolean;
      button: number;
      pointerType: string;
    };
  },
  options: {
    onActivation?: (payload: { event: unknown }) => void;
  }
) => boolean;

describe('useDndClickDragSensors', () => {
  it('uses the shared distance and long-press defaults', () => {
    const { result } = renderHook(() => useDndClickDragSensors());

    expect(result.current).toHaveLength(2);
    expect(result.current[0]?.options).toEqual({
      activationConstraint: { distance: 10 }
    });
    expect(result.current[1]).toEqual({
      sensor: TouchSensor,
      options: {
        activationConstraint: {
          delay: 250,
          tolerance: 5
        }
      }
    });
  });

  it('allows a consumer to override activation thresholds', () => {
    const { result } = renderHook(() =>
      useDndClickDragSensors({
        mouseDistance: 12,
        touchDelay: 300,
        touchTolerance: 7
      })
    );

    expect(result.current[0]?.options).toEqual({
      activationConstraint: { distance: 12 }
    });
    expect(result.current[1]?.options).toEqual({
      activationConstraint: {
        delay: 300,
        tolerance: 7
      }
    });
  });

  it('activates only primary non-touch pointer gestures', () => {
    const { result } = renderHook(() => useDndClickDragSensors());
    const activate = result.current[0]?.sensor.activators[0]?.handler as PointerActivator;
    const onActivation = vi.fn();
    const mouseEvent = {
      isPrimary: true,
      button: 0,
      pointerType: 'mouse'
    };

    expect(activate({ nativeEvent: mouseEvent }, { onActivation })).toBe(true);
    expect(onActivation).toHaveBeenCalledWith({ event: mouseEvent });

    expect(
      activate({ nativeEvent: { ...mouseEvent, pointerType: 'touch' } }, { onActivation })
    ).toBe(false);
    expect(activate({ nativeEvent: { ...mouseEvent, button: 2 } }, { onActivation })).toBe(false);
    expect(activate({ nativeEvent: { ...mouseEvent, isPrimary: false } }, { onActivation })).toBe(
      false
    );
    expect(onActivation).toHaveBeenCalledOnce();
  });
});
