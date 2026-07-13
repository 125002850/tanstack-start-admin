import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TableBody, TableCell, TableRow } from './table';

describe('TableRow', () => {
  it('leaves row dividers to the surrounding table sections', () => {
    render(
      <table>
        <TableBody>
          <TableRow>
            <TableCell>内容</TableCell>
          </TableRow>
        </TableBody>
      </table>
    );

    expect(screen.getByRole('row')).not.toHaveClass('border-b');
  });
});
