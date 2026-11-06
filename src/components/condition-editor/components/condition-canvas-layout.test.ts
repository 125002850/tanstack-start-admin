import { expect, it } from 'vitest';
import type { GroupCondition } from '../model/condition-model';
import {
  getConditionCanvasPath,
  layoutConditionCanvas,
  projectConditionCanvas,
  ROUTING_CANVAS_START_NODE_ID
} from './condition-canvas-layout';

it('嵌套条件投影保持父子路径，自动布局产生有限且分离的坐标', () => {
  const condition: GroupCondition = {
    clientId: 'root',
    type: 'GROUP',
    logic: 'AND',
    children: [
      { clientId: 'a', type: 'CONDITION', field: 'amount', operator: 'NUM_GT', value: '1' },
      {
        clientId: 'nested',
        type: 'GROUP',
        logic: 'OR',
        children: [
          { clientId: 'b', type: 'CONDITION', field: 'region', operator: 'EQ', value: 'CN' }
        ]
      }
    ]
  };
  const projection = projectConditionCanvas(condition);
  expect([...getConditionCanvasPath(projection.parentById, 'b')]).toEqual([
    'b',
    'nested',
    'root',
    ROUTING_CANVAS_START_NODE_ID
  ]);
  const layout = layoutConditionCanvas(projection);
  expect(layout).toHaveLength(5);
  expect(
    layout.every(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y))
  ).toBe(true);
  expect(new Set(layout.map(({ position }) => `${position.x}:${position.y}`)).size).toBe(5);
});
