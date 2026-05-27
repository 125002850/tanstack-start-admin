import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Hello() {
  return <h1>Hello, test</h1>;
}

describe('Vitest + Testing Library smoke', () => {
  it('renders a React component and asserts DOM', () => {
    render(<Hello />);
    expect(screen.getByRole('heading', { name: /hello, test/i })).toBeInTheDocument();
  });
});
