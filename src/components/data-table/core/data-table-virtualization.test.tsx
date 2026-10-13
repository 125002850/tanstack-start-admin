import { describe, it, expect } from 'vitest';
import { resolveDataTableVirtualizationOptions } from '@/config/data-table';

describe('DataTable virtualization option resolution', () => {
  it.each([undefined, true, {}, { enabled: true }])(
    'defaults column virtualization to auto for %j while preserving row auto mode',
    (virtualization) => {
      const resolved = resolveDataTableVirtualizationOptions(virtualization);

      expect(resolved.value?.enabled).toBe(true);
      expect(resolved.value?.rowCountThreshold).toBeUndefined();
      expect(resolved.value?.column.enabled).toBe(true);
      expect(resolved.value?.column.columnCountThreshold).toBe(20);
      expect(resolved.value?.column.overscan).toBe(3);
    }
  );

  it('forces column virtualization candidate mode independently of row threshold', () => {
    const resolved = resolveDataTableVirtualizationOptions({
      columnVirtualizationMode: 'on',
      rowCountThreshold: 100,
      columnCountThreshold: 40,
      columnOverscan: 5
    });

    expect(resolved.value?.enabled).toBe(true);
    expect(resolved.value?.rowCountThreshold).toBe(100);
    expect(resolved.value?.column.enabled).toBe(true);
    expect(resolved.value?.column.columnCountThreshold).toBe(0);
    expect(resolved.value?.column.overscan).toBe(5);
  });

  it('supports auto column thresholds and explicit column overscan', () => {
    const resolved = resolveDataTableVirtualizationOptions({
      columnVirtualizationMode: 'auto',
      columnCountThreshold: 32,
      columnOverscan: 7
    });

    expect(resolved.value?.column.enabled).toBe(true);
    expect(resolved.value?.column.columnCountThreshold).toBe(32);
    expect(resolved.value?.column.overscan).toBe(7);
  });

  it('allows column virtualization to be explicitly disabled without disabling rows', () => {
    const resolved = resolveDataTableVirtualizationOptions({
      enabled: true,
      rowCountThreshold: 10,
      columnVirtualizationMode: 'off',
      columnCountThreshold: 1
    });

    expect(resolved.value?.enabled).toBe(true);
    expect(resolved.value?.rowCountThreshold).toBe(10);
    expect(resolved.value?.column.enabled).toBe(false);
  });

  it.each([false, { enabled: false }, { mode: 'off' as const }])(
    'keeps %j as a full row and column opt-out',
    (virtualization) => {
      const resolved = resolveDataTableVirtualizationOptions(virtualization);

      expect(resolved.value?.enabled).toBe(false);
      expect(resolved.value?.column.enabled).toBe(false);
    }
  );
});
