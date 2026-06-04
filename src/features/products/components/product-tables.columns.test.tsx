import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';

import { columns } from './product-tables/columns';

describe('product table columns', () => {
  it('renders the photo cell with a fixed-size thumbnail wrapper', () => {
    const photoColumn = columns.find(
      (column) => 'accessorKey' in column && column.accessorKey === 'photo_url'
    );
    expect(photoColumn?.cell).toBeTypeOf('function');

    const renderPhotoCell = photoColumn?.cell as (context: {
      row: {
        getValue: (key: string) => unknown;
      };
    }) => React.ReactNode;

    render(
      <table>
        <tbody>
          <tr>
            <td>
              {renderPhotoCell({
                row: {
                  getValue: (key) => {
                    if (key === 'photo_url') return 'https://example.com/photo.jpg';
                    if (key === 'name') return 'Product 1';
                    return undefined;
                  }
                }
              })}
            </td>
          </tr>
        </tbody>
      </table>
    );

    const thumbnail = screen.getByRole('img', { name: 'Product 1' });

    expect(thumbnail.parentElement).toHaveClass(
      'relative',
      'size-[40px]',
      'shrink-0',
      'overflow-hidden',
      'rounded-lg'
    );
    expect(thumbnail).toHaveClass('size-full', 'object-cover');
  });
});
