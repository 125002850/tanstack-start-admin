import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOverlayPortalContainer } from './use-overlay-portal-container';

afterEach(cleanup);

describe('useOverlayPortalContainer', () => {
  it('trigger 移入或移出弹窗后按当前 DOM 解析容器，不缓存已离开的弹窗', () => {
    const { result } = renderHook(() => useOverlayPortalContainer<HTMLButtonElement>());
    const inline = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.dataset.slot = 'dialog-content';
    const anotherDialog = document.createElement('div');
    anotherDialog.setAttribute('role', 'dialog');
    const trigger = document.createElement('button');
    inline.append(trigger);
    act(() => result.current.setTriggerNode(trigger));
    expect(result.current.getContainer()).toBeUndefined();
    dialog.append(trigger);
    expect(result.current.getContainer()).toBe(dialog);
    expect(result.current.getContainer()).toBe(dialog);
    anotherDialog.append(trigger);
    expect(result.current.getContainer()).toBe(anotherDialog);
    inline.append(trigger);
    expect(result.current.getContainer()).toBeUndefined();
  });

  it('初次位于弹窗中时使用最近容器并保留 trigger 引用', () => {
    const { result } = renderHook(() => useOverlayPortalContainer<HTMLButtonElement>());
    const dialog = document.createElement('div');
    dialog.dataset.slot = 'dialog-content';
    const inner = document.createElement('div');
    inner.setAttribute('role', 'dialog');
    dialog.append(inner);
    const trigger = document.createElement('button');
    inner.append(trigger);
    act(() => result.current.setTriggerNode(trigger));
    expect(result.current.container).toBe(inner);
    expect(result.current.triggerRef.current).toBe(trigger);
    expect(result.current.getContainer()).toBe(inner);
  });
});
