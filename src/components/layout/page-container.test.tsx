import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PageContainer from './page-container';

describe('PageContainer', () => {
  it('fills the remaining page height without constraining content-driven growth', () => {
    const { container } = render(
      <PageContainer>
        <div>页面内容</div>
      </PageContainer>
    );

    expect(container.firstElementChild).toHaveClass('flex', 'flex-1', 'flex-col', 'min-w-0');
    expect(container.firstElementChild).not.toHaveClass('min-h-0', 'overflow-hidden');

    const content = container.querySelector('[data-slot="page-content"]');
    expect(content).toHaveClass('grid', 'min-w-0', 'flex-1');
    expect(content).not.toHaveClass('min-h-0', 'overflow-hidden');
  });

  it('constrains contained content to the remaining page height', () => {
    const { container } = render(
      <PageContainer contentSizing='contained' pageTitle='页面标题'>
        <div>页面内容</div>
      </PageContainer>
    );

    expect(container.firstElementChild).toHaveClass('min-h-0', 'overflow-hidden');
    expect(container.querySelector('[data-slot="page-content"]')).toHaveClass(
      'grid',
      'min-h-0',
      'min-w-0',
      'flex-1',
      'overflow-hidden'
    );
  });
});
