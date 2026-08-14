import { describe, expect, it } from 'vitest';

import {
  formatDataTableInstantInTimeZone,
  resolveDataTableTimeZone,
  resolveDataTableZonedDateTime
} from './data-table-time-zone';

describe('data-table-time-zone', () => {
  it('resolves column, table, and app time zones in strict priority order', () => {
    expect(
      resolveDataTableTimeZone({
        columnTimeZone: 'Asia/Shanghai',
        tableTimeZone: 'Europe/Paris',
        appTimeZone: 'UTC',
        tableId: 'orders',
        columnId: 'executeAt'
      })
    ).toEqual({ timeZone: 'Asia/Shanghai', source: 'column' });
    expect(
      resolveDataTableTimeZone({
        tableTimeZone: 'Europe/Paris',
        appTimeZone: 'UTC',
        tableId: 'orders',
        columnId: 'executeAt'
      })
    ).toEqual({ timeZone: 'Europe/Paris', source: 'table' });
    expect(
      resolveDataTableTimeZone({
        appTimeZone: 'UTC',
        tableId: 'orders',
        columnId: 'executeAt'
      })
    ).toEqual({ timeZone: 'UTC', source: 'app' });
  });

  it('throws contextual errors for missing or invalid configured time zones', () => {
    expect(() =>
      resolveDataTableTimeZone({
        tableId: 'orders',
        columnId: 'executeAt'
      })
    ).toThrow(
      'DataTable "orders" column "executeAt" requires an explicit IANA time zone; checked column → table → app.'
    );
    expect(() =>
      resolveDataTableTimeZone({
        columnTimeZone: 'Mars/Olympus',
        tableTimeZone: 'UTC',
        tableId: 'orders',
        columnId: 'executeAt'
      })
    ).toThrow(
      'DataTable "orders" column "executeAt" has invalid column time zone "Mars/Olympus"; checked column → table → app.'
    );
  });

  it('formats an instant with the resolved IANA wall-clock fields', () => {
    expect(
      formatDataTableInstantInTimeZone(Date.parse('2026-07-30T04:05:06Z'), 'Asia/Shanghai')
    ).toEqual({
      year: 2026,
      month: 7,
      day: 30,
      hour: 12,
      minute: 5,
      second: 6
    });
  });

  it('resolves a unique local wall time without using the environment time zone', () => {
    expect(
      resolveDataTableZonedDateTime(
        {
          year: 2026,
          month: 7,
          day: 30,
          hour: 12,
          minute: 5,
          second: 0
        },
        'Asia/Shanghai'
      )
    ).toEqual({
      status: 'unique',
      epochMilliseconds: Date.parse('2026-07-30T04:05:00Z')
    });
  });

  it('rejects DST gaps and exposes both candidates for DST overlaps', () => {
    expect(
      resolveDataTableZonedDateTime(
        {
          year: 2026,
          month: 3,
          day: 8,
          hour: 2,
          minute: 30,
          second: 0
        },
        'America/New_York'
      )
    ).toEqual({ status: 'gap' });

    expect(
      resolveDataTableZonedDateTime(
        {
          year: 2026,
          month: 11,
          day: 1,
          hour: 1,
          minute: 30,
          second: 0
        },
        'America/New_York'
      )
    ).toEqual({
      status: 'overlap',
      epochMilliseconds: [Date.parse('2026-11-01T05:30:00Z'), Date.parse('2026-11-01T06:30:00Z')]
    });
  });
});
