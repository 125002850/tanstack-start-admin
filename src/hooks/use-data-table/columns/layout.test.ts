import { describe, expect, it } from 'vitest';
import { getDeclaredColumnIds } from './layout';

describe('declared column IDs', () => {
  it('normalizes accessorKey dots and preserves explicit IDs', () => {
    expect(
      getDeclaredColumnIds([
        { accessorKey: 'user.profile.name' },
        { id: 'user.name', accessorKey: 'user.name' }
      ])
    ).toEqual(['user_profile_name', 'user.name']);
  });
});
