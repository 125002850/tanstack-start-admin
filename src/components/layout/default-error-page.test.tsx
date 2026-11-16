import type * as React from 'react';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Icons } from '@/components/icons';
import { ActiveThemeProvider } from '@/components/themes/active-theme';
import { DefaultErrorPage } from './default-error-page';

function renderWithTheme(ui: React.ReactElement, activeTheme: string) {
  return render(<ActiveThemeProvider initialTheme={activeTheme}>{ui}</ActiveThemeProvider>);
}

describe('DefaultErrorPage', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('renders a 404 state from the default botanical illustration family', () => {
    render(
      <DefaultErrorPage
        code='404'
        title='页面不存在'
        description='访问的页面不存在或已被移动。'
        alertTitle='路由未匹配'
        alertDescription='请检查地址是否正确。'
      />
    );

    expect(screen.getByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
    expect(screen.getByTestId('default-error-illustration')).toHaveAttribute(
      'data-error-illustration',
      '404'
    );
    expect(screen.getByTestId('default-error-illustration')).toHaveAttribute(
      'data-error-illustration-family',
      'botanical'
    );
    expect(screen.getByText('HTTP 错误代码：404')).toHaveClass('sr-only');
    expect(screen.getByText('路由未匹配')).toBeInTheDocument();
  });

  it('uses the botanical WebP illustration family for green themes', () => {
    renderWithTheme(
      <DefaultErrorPage
        code='403'
        title='无权限访问'
        description='当前账号暂未开通本系统的权限。'
        alertTitle='登录受限'
        alertDescription='没有访问该资源的权限'
      />,
      'light-green'
    );

    const illustration = screen.getByTestId('default-error-illustration');
    expect(illustration).toHaveAttribute('data-error-illustration', '403');
    expect(illustration).toHaveAttribute('data-error-illustration-family', 'botanical');
    expect(illustration.tagName).toBe('IMG');
  });

  it('uses the dark botanical asset in dark mode', async () => {
    document.documentElement.classList.add('dark');

    renderWithTheme(
      <DefaultErrorPage
        code='404'
        title='页面不存在'
        description='访问的页面不存在或已被移动。'
        alertTitle='路由未匹配'
        alertDescription='请检查地址是否正确。'
      />,
      'light-green'
    );

    const illustration = screen.getByTestId('default-error-illustration');
    expect(illustration).toHaveAttribute('data-error-illustration-mode', 'dark');
    await waitFor(() =>
      expect(illustration.getAttribute('src')).toContain('empty-state-botanical-dark-404.webp')
    );
  });

  it('falls back to the monochrome illustration family for unknown themes', () => {
    renderWithTheme(
      <DefaultErrorPage
        code='404'
        title='页面不存在'
        description='访问的页面不存在或已被移动。'
        alertTitle='路由未匹配'
        alertDescription='请检查地址是否正确。'
      />,
      'unknown-theme'
    );

    expect(screen.getByTestId('default-error-illustration')).toHaveAttribute(
      'data-error-illustration-family',
      'monochrome'
    );
  });

  it('uses the zen illustration family for zen themes', () => {
    renderWithTheme(
      <DefaultErrorPage
        code='500'
        title='系统异常'
        description='页面加载时遇到异常。'
        alertTitle='运行异常'
        alertDescription='Unexpected error'
      />,
      'zen'
    );

    const illustration = screen.getByTestId('default-error-illustration');
    expect(illustration).toHaveAttribute('data-error-illustration', '500');
    expect(illustration).toHaveAttribute('data-error-illustration-family', 'zen');
    expect(illustration.tagName).toBe('IMG');
  });

  it('uses the brutal illustration family for wasteland themes', () => {
    renderWithTheme(
      <DefaultErrorPage
        code='404'
        title='页面不存在'
        description='访问的页面不存在或已被移动。'
        alertTitle='路由未匹配'
        alertDescription='请检查地址是否正确。'
      />,
      'neobrutualism'
    );

    const illustration = screen.getByTestId('default-error-illustration');
    expect(illustration).toHaveAttribute('data-error-illustration', '404');
    expect(illustration).toHaveAttribute('data-error-illustration-family', 'brutal');
    expect(illustration.tagName).toBe('IMG');
  });

  it('uses the astro illustration family for astro themes', () => {
    renderWithTheme(
      <DefaultErrorPage
        code='404'
        title='页面不存在'
        description='访问的页面不存在或已被移动。'
        alertTitle='路由未匹配'
        alertDescription='请检查地址是否正确。'
      />,
      'astro-vista'
    );

    const illustration = screen.getByTestId('default-error-illustration');
    expect(illustration).toHaveAttribute('data-error-illustration', '404');
    expect(illustration).toHaveAttribute('data-error-illustration-family', 'astro');
    expect(illustration.tagName).toBe('IMG');
    expect(screen.getByText('HTTP 404')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders action buttons for retryable 500 states', () => {
    const onRetry = vi.fn();

    render(
      <DefaultErrorPage
        code='500'
        title='系统异常'
        description='页面加载时遇到异常。'
        alertTitle='运行异常'
        alertDescription='Unexpected error'
        action={{
          label: '重试',
          icon: Icons.rotateClockwise,
          onClick: onRetry
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /重试/ }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders a business state with an action without HTTP codes or error illustrations', () => {
    const onReturn = vi.fn();
    renderWithTheme(
      <DefaultErrorPage
        layout='contained'
        title='当前版本不可编辑'
        description='仅草稿版本支持编辑。'
        alertTitle='编辑受限'
        alertDescription='请从场景列表创建或选择草稿后继续编辑。'
        action={{ label: '返回列表', onClick: onReturn }}
      />,
      'astro-vista'
    );

    expect(screen.getByRole('heading', { name: '当前版本不可编辑' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('编辑受限');
    expect(screen.queryByText(/HTTP/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('default-error-illustration')).not.toBeInTheDocument();
    expect(
      screen.getByRole('main').querySelector('[data-slot="error-illustration"]')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回列表' }));
    expect(onReturn).toHaveBeenCalledOnce();
  });

  it.each([undefined, '403'] as const)(
    'prioritizes a custom illustration over HTTP code %s',
    (code) => {
      render(
        <DefaultErrorPage
          code={code}
          illustration={<svg role='img' aria-label='自定义插画' />}
          title='访问受限'
          description='当前页面暂不可用。'
          alertTitle='访问提示'
          alertDescription='请返回列表。'
        />
      );

      expect(screen.getByRole('img', { name: '自定义插画' })).toBeInTheDocument();
      expect(screen.queryByTestId('default-error-illustration')).not.toBeInTheDocument();
      if (code) expect(screen.getByText(`HTTP 错误代码：${code}`)).toHaveClass('sr-only');
    }
  );

  it('allows explicitly hiding the code illustration with null', () => {
    render(
      <DefaultErrorPage
        code='403'
        illustration={null}
        title='无权限访问'
        description='当前账号暂未开通本系统的权限。'
        alertTitle='访问受限'
        alertDescription='请联系管理员。'
      />
    );

    expect(screen.getByText('HTTP 错误代码：403')).toHaveClass('sr-only');
    expect(screen.queryByTestId('default-error-illustration')).not.toBeInTheDocument();
    expect(
      screen.getByRole('main').querySelector('[data-slot="error-illustration"]')
    ).not.toBeInTheDocument();
  });
});
