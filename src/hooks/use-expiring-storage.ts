import * as React from 'react';

const EXPIRING_STORAGE_FORMAT = 'oig-expiring-storage';
const EXPIRING_STORAGE_VERSION = 1;

type Awaitable<T> = T | Promise<T>;

export type BrowserStorageKind = 'local' | 'session';

/**
 * 最小键值存储端口。Web Storage 可同步实现，IndexedDB adapter 可异步实现。
 */
export interface ExpiringStorageAdapter {
  getItem(key: string): Awaitable<string | null>;
  setItem(key: string, value: string): Awaitable<void>;
  removeItem(key: string): Awaitable<void>;
}

export type ExpiringStorageTarget = BrowserStorageKind | ExpiringStorageAdapter;

export interface ExpiringStorageOptions<T> {
  readonly key: string;
  readonly storage: ExpiringStorageTarget;
  readonly ttlMs: number;
  readonly isValue: (value: unknown) => value is T;
  readonly getCreatedAt: (value: T) => number;
  readonly migrate?: (value: unknown) => readonly T[] | null;
  readonly normalize?: (values: readonly T[]) => readonly T[];
  readonly now?: () => number;
}

export interface ExpiringStorageResult<T> {
  readonly success: boolean;
  readonly values: readonly T[];
}

export interface ExpiringStorageClient<T> {
  read(): Promise<ExpiringStorageResult<T>>;
  replace(values: readonly T[]): Promise<ExpiringStorageResult<T>>;
  update(updater: (values: readonly T[]) => readonly T[]): Promise<ExpiringStorageResult<T>>;
  clear(): Promise<ExpiringStorageResult<T>>;
}

interface ExpiringStorageEnvelopeEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

interface ExpiringStorageEnvelope<T> {
  readonly format: typeof EXPIRING_STORAGE_FORMAT;
  readonly version: typeof EXPIRING_STORAGE_VERSION;
  readonly entries: readonly ExpiringStorageEnvelopeEntry<T>[];
}

interface CanonicalSnapshot<T> {
  readonly raw: string | null;
  readonly values: readonly T[];
}

export function createBrowserStorageAdapter(kind: BrowserStorageKind): ExpiringStorageAdapter {
  return {
    getItem(key) {
      return resolveBrowserStorage(kind).getItem(key);
    },
    setItem(key, value) {
      resolveBrowserStorage(kind).setItem(key, value);
    },
    removeItem(key) {
      resolveBrowserStorage(kind).removeItem(key);
    }
  };
}

export function getExpiringStorageExpiresAt(createdAt: number, ttlMs: number): number | null {
  if (!isPositiveSafeInteger(createdAt) || !isPositiveSafeInteger(ttlMs)) return null;

  const expiresAt = createdAt + ttlMs;
  return Number.isSafeInteger(expiresAt) ? expiresAt : null;
}

export function isExpiringStorageTimestampRetained(
  createdAt: number,
  ttlMs: number,
  now = Date.now()
): boolean {
  const expiresAt = getExpiringStorageExpiresAt(createdAt, ttlMs);
  return expiresAt !== null && Number.isSafeInteger(now) && createdAt <= now && expiresAt > now;
}

export function createExpiringStorage<T>(
  options: ExpiringStorageOptions<T>
): ExpiringStorageClient<T> {
  validateOptions(options);

  const adapter =
    typeof options.storage === 'string'
      ? createBrowserStorageAdapter(options.storage)
      : options.storage;

  const persist = async (snapshot: CanonicalSnapshot<T>): Promise<void> => {
    if (snapshot.raw === null) {
      await adapter.removeItem(options.key);
      return;
    }

    await adapter.setItem(options.key, snapshot.raw);
  };

  const read = async (): Promise<ExpiringStorageResult<T>> => {
    let raw: string | null;
    try {
      raw = await adapter.getItem(options.key);
    } catch {
      return { success: false, values: [] };
    }

    if (raw === null) return { success: true, values: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      await removeBestEffort(adapter, options.key);
      return { success: true, values: [] };
    }

    try {
      const currentValues = readCurrentEnvelopeValues(parsed, options.isValue);
      const sourceValues =
        currentValues ?? options.migrate?.(parsed) ?? ([] satisfies readonly T[]);
      const snapshot = createCanonicalSnapshot(sourceValues, options);

      if (snapshot.raw !== raw) {
        try {
          await persist(snapshot);
        } catch {
          // 到期清理和旧格式迁移是尽力而为，写入失败不影响仍有效的数据读取。
        }
      }

      return { success: true, values: snapshot.values };
    } catch {
      return { success: false, values: [] };
    }
  };

  const persistMutation = async (
    previousValues: readonly T[],
    nextValues: readonly T[]
  ): Promise<ExpiringStorageResult<T>> => {
    let snapshot: CanonicalSnapshot<T>;
    try {
      snapshot = createCanonicalSnapshot(nextValues, options);
      await persist(snapshot);
    } catch {
      return { success: false, values: previousValues };
    }

    return { success: true, values: snapshot.values };
  };

  return {
    read,
    async replace(values) {
      const current = await read();
      if (!current.success) return current;
      return persistMutation(current.values, values);
    },
    async update(updater) {
      const current = await read();
      if (!current.success) return current;

      let nextValues: readonly T[];
      try {
        nextValues = updater(current.values);
      } catch {
        return { success: false, values: current.values };
      }

      return persistMutation(current.values, nextValues);
    },
    async clear() {
      const current = await read();
      try {
        await adapter.removeItem(options.key);
        return { success: true, values: [] };
      } catch {
        return { success: false, values: current.values };
      }
    }
  };
}

/**
 * 将 ExpiringStorageClient 接入 React 生命周期。client 应通过 useMemo 保持稳定。
 */
export function useExpiringStorage<T>(client: ExpiringStorageClient<T> | null) {
  const [values, setValues] = React.useState<readonly T[]>([]);
  const [valuesOwner, setValuesOwner] = React.useState(client);
  const [isLoading, setIsLoading] = React.useState(client !== null);
  const clientRef = React.useRef(client);
  const revisionRef = React.useRef(0);
  clientRef.current = client;

  const reload = React.useCallback(async (): Promise<ExpiringStorageResult<T>> => {
    const owner = client;
    const revision = ++revisionRef.current;
    if (owner === null) {
      setValues([]);
      setValuesOwner(null);
      setIsLoading(false);
      return { success: true, values: [] };
    }

    setIsLoading(true);
    const result = await owner.read();
    if (clientRef.current === owner && revisionRef.current === revision) {
      setValues(result.values);
      setValuesOwner(owner);
      setIsLoading(false);
    }
    return result;
  }, [client]);

  React.useEffect(() => {
    void reload();
    return () => {
      revisionRef.current += 1;
    };
  }, [reload]);

  const runMutation = React.useCallback(
    async (
      operation: (owner: ExpiringStorageClient<T>) => Promise<ExpiringStorageResult<T>>
    ): Promise<ExpiringStorageResult<T>> => {
      const owner = client;
      const revision = ++revisionRef.current;
      if (owner === null) return { success: false, values: [] };

      const result = await operation(owner);
      if (clientRef.current === owner && revisionRef.current === revision) {
        setValues(result.values);
        setValuesOwner(owner);
        setIsLoading(false);
      }
      return result;
    },
    [client]
  );

  const replace = React.useCallback(
    (nextValues: readonly T[]) => runMutation((owner) => owner.replace(nextValues)),
    [runMutation]
  );

  const update = React.useCallback(
    (updater: (currentValues: readonly T[]) => readonly T[]) =>
      runMutation((owner) => owner.update(updater)),
    [runMutation]
  );

  const clear = React.useCallback(() => runMutation((owner) => owner.clear()), [runMutation]);

  return {
    clear,
    isLoading: valuesOwner === client ? isLoading : client !== null,
    reload,
    replace,
    update,
    values: valuesOwner === client ? values : []
  } as const;
}

function createCanonicalSnapshot<T>(
  sourceValues: readonly T[],
  options: ExpiringStorageOptions<T>
): CanonicalSnapshot<T> {
  const now = options.now?.() ?? Date.now();
  if (!Number.isSafeInteger(now)) throw new Error('Expiring storage clock must return an integer.');

  const validValues = sourceValues.filter(options.isValue);
  const normalizedValues = options.normalize?.(validValues) ?? validValues;
  const entries: ExpiringStorageEnvelopeEntry<T>[] = [];

  for (const value of normalizedValues) {
    if (!options.isValue(value)) continue;

    const createdAt = options.getCreatedAt(value);
    const expiresAt = getExpiringStorageExpiresAt(createdAt, options.ttlMs);
    if (expiresAt === null || createdAt > now || expiresAt <= now) continue;

    entries.push({ value, expiresAt });
  }

  if (entries.length === 0) return { raw: null, values: [] };

  return {
    raw: JSON.stringify({
      format: EXPIRING_STORAGE_FORMAT,
      version: EXPIRING_STORAGE_VERSION,
      entries
    } satisfies ExpiringStorageEnvelope<T>),
    values: entries.map((entry) => entry.value)
  };
}

function readCurrentEnvelopeValues<T>(
  value: unknown,
  isValue: (value: unknown) => value is T
): readonly T[] | null {
  if (
    !isRecord(value) ||
    value.format !== EXPIRING_STORAGE_FORMAT ||
    value.version !== EXPIRING_STORAGE_VERSION ||
    !Array.isArray(value.entries)
  ) {
    return null;
  }

  return value.entries.flatMap((entry) => {
    if (!isRecord(entry) || !isValue(entry.value)) return [];
    return [entry.value];
  });
}

function validateOptions<T>(options: ExpiringStorageOptions<T>): void {
  if (options.key.trim().length === 0) {
    throw new Error('Expiring storage key must not be empty.');
  }
  if (!isPositiveSafeInteger(options.ttlMs)) {
    throw new Error('Expiring storage ttlMs must be a positive safe integer.');
  }
}

function resolveBrowserStorage(kind: BrowserStorageKind): Storage {
  const storage = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
  if (storage === undefined) throw new Error(kind + ' storage is unavailable.');
  return storage;
}

async function removeBestEffort(adapter: ExpiringStorageAdapter, key: string): Promise<void> {
  try {
    await adapter.removeItem(key);
  } catch {
    // 损坏数据清理失败时保持静默，不能影响业务主流程。
  }
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
