import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FieldLegend, FieldSet } from './field';

afterEach(cleanup);

describe('FieldLegend', () => {
  it('renders a visual required marker without changing the accessible name', () => {
    render(
      <FieldSet>
        <FieldLegend required>值班成员</FieldLegend>
      </FieldSet>
    );

    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('group', { name: '值班成员' })).toBeInTheDocument();
  });

  it('does not render a required marker by default', () => {
    render(
      <FieldSet>
        <FieldLegend>值班成员</FieldLegend>
      </FieldSet>
    );

    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });
});
