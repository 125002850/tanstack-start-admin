import { PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

const DEFAULT_MOUSE_DISTANCE_PX = 10;
const DEFAULT_TOUCH_DELAY_MS = 250;
const DEFAULT_TOUCH_TOLERANCE_PX = 5;

export interface DndClickDragSensorOptions {
  mouseDistance?: number;
  touchDelay?: number;
  touchTolerance?: number;
}

/**
 * Radix Trigger 会取消兼容 mousedown，因此非触摸指针从 pointerdown 观察移动距离。
 * 触摸事件交给 TouchSensor，避免同一次手势被两个 sensor 竞争处理。
 */
class ClickDragPointerSensor extends PointerSensor {
  static activators: typeof PointerSensor.activators = [
    {
      eventName: 'onPointerDown',
      handler: ({ nativeEvent: event }, { onActivation }) => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === 'touch') {
          return false;
        }

        onActivation?.({ event });
        return true;
      }
    }
  ];
}

/**
 * 为同一主表面上的点击与拖拽提供统一激活策略。
 * 鼠标移动超过距离阈值才开始拖拽；触摸继续使用长按，避免与滚动过早竞争。
 */
export function useDndClickDragSensors({
  mouseDistance = DEFAULT_MOUSE_DISTANCE_PX,
  touchDelay = DEFAULT_TOUCH_DELAY_MS,
  touchTolerance = DEFAULT_TOUCH_TOLERANCE_PX
}: DndClickDragSensorOptions = {}) {
  return useSensors(
    useSensor(ClickDragPointerSensor, {
      activationConstraint: {
        distance: mouseDistance
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: touchDelay,
        tolerance: touchTolerance
      }
    })
  );
}
