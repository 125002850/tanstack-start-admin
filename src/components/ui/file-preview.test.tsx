import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { FilePreview } from './file-preview';

afterEach(cleanup);

it('retains the full filename and only shows its tooltip when visually truncated', async () => {
  const user = userEvent.setup();
  const name = 'production-infrastructure-report-2026.pdf';
  const onRemove = vi.fn();
  render(
    <FilePreview files={[{ id: 'report', name, type: 'application/pdf' }]} onRemove={onRemove} />
  );
  const filename = screen.getByText(name);
  Object.defineProperties(filename, { clientWidth: { value: 100 }, scrollWidth: { value: 300 } });
  await user.hover(filename);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(name);
  await user.click(screen.getByRole('button', { name: `Remove ${name}` }));
  expect(onRemove).toHaveBeenCalledWith('report');
});
