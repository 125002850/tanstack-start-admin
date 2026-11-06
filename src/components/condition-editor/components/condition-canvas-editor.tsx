import * as React from 'react';
import type { ConditionCanvasProps } from './condition-canvas-types';

const ConditionCanvas = React.lazy(async () => {
  const module = await import('./condition-canvas');
  return { default: module.ConditionCanvas };
});

export function ConditionCanvasEditor(props: ConditionCanvasProps) {
  return <ConditionCanvas {...props} />;
}
