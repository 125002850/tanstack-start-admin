import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { Button } from './button';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('defaults native buttons to type="button"', () => {
    render(<Button>Open</Button>);

    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('type', 'button');
  });

  it('preserves explicit submit type', () => {
    render(<Button type='submit'>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('defaults loading-aware buttons to type="button"', () => {
    render(<Button isLoading={false}>Refresh</Button>);

    expect(screen.getByRole('button', { name: /Refresh/ })).toHaveAttribute('type', 'button');
  });

  it('does not inject a default type when rendering via asChild', () => {
    render(
      <Button asChild>
        <a href='/docs'>Docs</a>
      </Button>
    );

    expect(screen.getByRole('link', { name: 'Docs' })).not.toHaveAttribute('type');
  });
});
