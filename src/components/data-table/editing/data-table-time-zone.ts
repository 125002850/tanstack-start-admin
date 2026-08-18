import type { DataTableResolvedTimeZone, DataTableTimeZoneSource } from './types';

const TIME_ZONE_FALLBACK_CHAIN = 'column → table → app';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface DataTableDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export type DataTableZonedDateTimeResolution =
  | { status: 'unique'; epochMilliseconds: number }
  | { status: 'gap' }
  | { status: 'overlap'; epochMilliseconds: [number, number] };

const formatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

function getTimeZoneFormatter(timeZone: string) {
  const cached = formatterByTimeZone.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US-u-ca-iso8601', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  formatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

function createUtcEpochMilliseconds(parts: DataTableDateTimeParts) {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, parts.second, 0);
  return date.getTime();
}

function hasSameParts(left: DataTableDateTimeParts, right: DataTableDateTimeParts) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function getTimeZoneOffsetMilliseconds(epochMilliseconds: number, timeZone: string) {
  const alignedEpochMilliseconds = Math.trunc(epochMilliseconds / 1000) * 1000;
  return (
    createUtcEpochMilliseconds(
      formatDataTableInstantInTimeZone(alignedEpochMilliseconds, timeZone)
    ) - alignedEpochMilliseconds
  );
}

function describeTarget(tableId?: string, columnId?: string) {
  return `DataTable "${tableId ?? '<unknown>'}" column "${columnId ?? '<unknown>'}"`;
}

export function isValidDataTableTimeZone(timeZone: string) {
  try {
    getTimeZoneFormatter(timeZone).format(0);
    return true;
  } catch {
    formatterByTimeZone.delete(timeZone);
    return false;
  }
}

export function resolveDataTableTimeZone({
  columnTimeZone,
  tableTimeZone,
  appTimeZone,
  tableId,
  columnId
}: {
  columnTimeZone?: string;
  tableTimeZone?: string;
  appTimeZone?: string;
  tableId?: string;
  columnId?: string;
}): DataTableResolvedTimeZone {
  const configured = [
    ['column', columnTimeZone],
    ['table', tableTimeZone],
    ['app', appTimeZone]
  ] as const satisfies ReadonlyArray<readonly [DataTableTimeZoneSource, string | undefined]>;
  const selected = configured.find((entry) => entry[1] !== undefined);
  if (!selected) {
    throw new Error(
      `${describeTarget(tableId, columnId)} requires an explicit IANA time zone; checked ${TIME_ZONE_FALLBACK_CHAIN}.`
    );
  }
  const [source, timeZone] = selected;
  if (timeZone === undefined) {
    throw new Error('DataTable time zone resolution reached an unreachable state.');
  }
  if (!isValidDataTableTimeZone(timeZone)) {
    throw new Error(
      `${describeTarget(tableId, columnId)} has invalid ${source} time zone "${timeZone}"; checked ${TIME_ZONE_FALLBACK_CHAIN}.`
    );
  }
  return { timeZone, source };
}

export function formatDataTableInstantInTimeZone(
  epochMilliseconds: number,
  timeZone: string
): DataTableDateTimeParts {
  const values = new Map(
    getTimeZoneFormatter(timeZone)
      .formatToParts(new Date(epochMilliseconds))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.get('year')!,
    month: values.get('month')!,
    day: values.get('day')!,
    hour: values.get('hour')!,
    minute: values.get('minute')!,
    second: values.get('second')!
  };
}

export function resolveDataTableZonedDateTime(
  parts: DataTableDateTimeParts,
  timeZone: string
): DataTableZonedDateTimeResolution {
  const wallClockEpoch = createUtcEpochMilliseconds(parts);
  const offsets = new Set<number>();
  const probeEpochs = [
    wallClockEpoch - 2 * ONE_DAY_MS,
    wallClockEpoch - ONE_DAY_MS,
    wallClockEpoch,
    wallClockEpoch + ONE_DAY_MS,
    wallClockEpoch + 2 * ONE_DAY_MS
  ];

  let candidate = wallClockEpoch;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const offset = getTimeZoneOffsetMilliseconds(candidate, timeZone);
    offsets.add(offset);
    candidate = wallClockEpoch - offset;
    probeEpochs.push(candidate - ONE_DAY_MS, candidate, candidate + ONE_DAY_MS);
  }
  for (const probeEpoch of probeEpochs) {
    offsets.add(getTimeZoneOffsetMilliseconds(probeEpoch, timeZone));
  }

  const candidates = [...offsets]
    .map((offset) => wallClockEpoch - offset)
    .filter((epochMilliseconds) =>
      hasSameParts(formatDataTableInstantInTimeZone(epochMilliseconds, timeZone), parts)
    )
    .filter((epochMilliseconds, index, values) => values.indexOf(epochMilliseconds) === index)
    .toSorted((left, right) => left - right);

  if (candidates.length === 0) return { status: 'gap' };
  if (candidates.length === 1) {
    return { status: 'unique', epochMilliseconds: candidates[0]! };
  }
  return {
    status: 'overlap',
    epochMilliseconds: [candidates[0]!, candidates[1]!]
  };
}
