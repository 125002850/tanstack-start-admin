import { describe, expect, it } from 'vitest';

import { createRedirectWithSearch } from './redirect-search';

describe('createRedirectWithSearch', () => {
  it('keeps the current route search object when creating redirect options', () => {
    const search = {
      customerCode: 'C001',
      source: 'sso'
    };

    expect(createRedirectWithSearch('/dashboard/overview', { search })).toEqual({
      to: '/dashboard/overview',
      search
    });
  });
});
