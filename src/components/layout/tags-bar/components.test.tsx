import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { PinnedHomeTag } from './components';

afterEach(cleanup);

it.each(['关闭标签', '关闭其他标签', '关闭所有标签'])(
  'supports keyboard selection of %s without hiding or blocking the remaining page',
  async (action) => {
    const user = userEvent.setup();
    const selected = vi.fn();
    const pageClick = vi.fn();
    function Harness() {
      const [showTag, setShowTag] = React.useState(true);
      const [showOther, setShowOther] = React.useState(true);
      const run = (label: string) => {
        selected(label);
        if (label !== '关闭其他标签') setShowTag(false);
        if (label !== '关闭标签') setShowOther(false);
      };
      return (
        <main data-testid='workspace'>
          {showTag && (
            <PinnedHomeTag
              id='/test'
              title='测试页'
              dirty={false}
              closable
              isActive
              registerTabRef={() => {}}
              prepareActivate={() => {}}
              activate={() => {}}
              handleKeyDown={() => {}}
              handleClose={() => {}}
              handleClosePointerDown={() => {}}
              refresh={() => {}}
              close={() => run('关闭标签')}
              closeOther={() => run('关闭其他标签')}
              closeAll={() => run('关闭所有标签')}
            />
          )}
          {showOther && <span>其他标签</span>}
          <button onClick={pageClick}>剩余页面操作</button>
        </main>
      );
    }
    render(<Harness />);
    fireEvent.contextMenu(screen.getByRole('tab', { name: '测试页' }));
    const item = await screen.findByRole('menuitem', { name: action });
    // A tab menu must not hide the underlying workspace even before the tab unmounts.
    expect(screen.getByTestId('workspace').closest('[aria-hidden="true"]')).toBeNull();
    item.focus();
    await user.keyboard('{Enter}');
    expect(selected).toHaveBeenCalledExactlyOnceWith(action);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(screen.getByTestId('workspace').closest('[aria-hidden="true"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe('none');
    if (action !== '关闭其他标签') expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    if (action !== '关闭标签') expect(screen.queryByText('其他标签')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '剩余页面操作' }));
    expect(pageClick).toHaveBeenCalledOnce();
  }
);

it('keeps inactive tab close buttons out of sequential keyboard navigation', async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  const props = {
    dirty: false,
    closable: true,
    registerTabRef: () => {},
    prepareActivate: () => {},
    activate: () => {},
    handleKeyDown: () => {},
    handleClose: close,
    handleClosePointerDown: () => {},
    refresh: () => {},
    close: () => {},
    closeOther: () => {},
    closeAll: () => {}
  };
  render(
    <>
      <PinnedHomeTag {...props} id='/active' title='活动页' isActive />
      <PinnedHomeTag {...props} id='/inactive' title='非活动页' isActive={false} />
      <button>后续操作</button>
    </>
  );
  screen.getByRole('tab', { name: '活动页' }).focus();
  await user.tab();
  expect(screen.getByRole('button', { name: '关闭：活动页' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: '后续操作' })).toHaveFocus();
});
