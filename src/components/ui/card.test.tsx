import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card, CardContent } from './card';

describe('Card', () => {
  it('keeps height ownership in the surrounding layout', () => {
    const { container } = render(
      <Card>
        <CardContent>卡片内容</CardContent>
      </Card>
    );

    expect(container.firstElementChild).not.toHaveClass('h-full');
    expect(container.querySelector('[data-slot="card-content"]')).not.toHaveClass('h-full');
  });
});
