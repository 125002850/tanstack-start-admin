import * as React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFormErrorNavigation } from './use-form-error-navigation';

afterEach(cleanup);

describe('useFormErrorNavigation', () => {
  it('普通表单无需分区即可聚焦错误字段', async () => {
    function Form() {
      const inputRef = React.useRef<HTMLInputElement>(null);
      const navigation = useFormErrorNavigation({
        issues: [{ path: 'name' }],
        fields: [{ path: 'name' }],
        onFocus: () => inputRef.current?.focus()
      });
      return (
        <>
          <input aria-label='名称' ref={inputRef} />
          <button onClick={() => navigation.navigateToFirstError()}>提交</button>
        </>
      );
    }
    render(<Form />);
    fireEvent.click(screen.getByText('提交'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: '名称' })).toHaveFocus());
  });

  it('先按字段展示顺序激活分区，等条件字段挂载后聚焦', async () => {
    function Steps() {
      const [step, setStep] = React.useState('last');
      const inputRef = React.useRef<HTMLInputElement>(null);
      const navigation = useFormErrorNavigation({
        issues: [{ path: 'body' }, { path: 'name' }],
        fields: [
          { path: 'name', section: 'first' },
          { path: 'body', section: 'last' }
        ],
        onActivateSection: setStep,
        onFocus: () => inputRef.current?.focus()
      });
      return (
        <>
          {step === 'first' ? <input aria-label='名称' ref={inputRef} /> : <p>最后一步</p>}
          <button onClick={() => navigation.navigateToFirstError()}>提交</button>
        </>
      );
    }
    render(<Steps />);
    fireEvent.click(screen.getByText('提交'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: '名称' })).toHaveFocus());
  });

  it('匹配嵌套字段但不误匹配同前缀字段，并在修正后更新计数而不自动导航', async () => {
    const onFocus = vi.fn();
    const onActivateSection = vi.fn();
    const { result, rerender } = renderHook(
      ({ issues }) =>
        useFormErrorNavigation({
          issues,
          fields: [{ path: 'items', section: 'details' }],
          onFocus,
          onActivateSection
        }),
      {
        initialProps: {
          issues: [{ path: 'items.0.name' }, { path: 'items[1].name' }, { path: 'itemsCount' }]
        }
      }
    );
    expect(result.current.sectionErrorCounts.get('details')).toBe(2);
    expect(onFocus).not.toHaveBeenCalled();
    await act(async () => result.current.navigateToFirstError());
    expect(onActivateSection).toHaveBeenCalledWith('details');
    expect(onFocus).toHaveBeenCalledWith({ path: 'items.0.name' });
    rerender({ issues: [] });
    expect(result.current.sectionErrorCounts.size).toBe(0);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('可直接接收当次校验结果，等待控件可用后只聚焦一次', async () => {
    const onFocus = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFormErrorNavigation({
          issues: [],
          fields: [{ path: 'name' }],
          onFocus,
          enabled
        }),
      { initialProps: { enabled: false } }
    );
    act(() => result.current.navigateToFirstError([{ path: 'name' }]));
    expect(onFocus).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(onFocus).toHaveBeenCalledTimes(1));
    rerender({ enabled: true });
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('取消导航或未知错误不会残留待聚焦请求', () => {
    const onFocus = vi.fn();
    const onActivateSection = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useFormErrorNavigation({
          issues: [{ path: 'name' }],
          fields: [{ path: 'name', section: 'basic' }],
          onFocus,
          onActivateSection,
          enabled
        }),
      { initialProps: { enabled: false } }
    );
    act(() => result.current.navigateToFirstError());
    act(() => result.current.cancelNavigation());
    rerender({ enabled: true });
    act(() => result.current.navigateToFirstError([{ path: 'unknown' }]));
    expect(onFocus).not.toHaveBeenCalled();
    expect(onActivateSection).toHaveBeenCalledTimes(1);
  });
});
