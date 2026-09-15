import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { WORK_CALENDAR_MAX_YEAR, WORK_CALENDAR_MIN_YEAR } from '../model/work-calendar-model';

interface WorkCalendarYearControlProps {
  year: number;
  onYearChange: (year: number) => void;
}

export function WorkCalendarYearControl({ year, onYearChange }: WorkCalendarYearControlProps) {
  const [yearInput, setYearInput] = React.useState(String(year));
  const inputYear = parseYearInput(yearInput);
  const stepBaseYear = inputYear ?? year;

  React.useEffect(() => setYearInput(String(year)), [year]);

  function requestYearChange(nextYear: number) {
    setYearInput(String(year));
    if (nextYear !== year) onYearChange(nextYear);
  }

  function commitYear() {
    if (inputYear === null) {
      setYearInput(String(year));
      return;
    }
    requestYearChange(inputYear);
  }

  function stepYear(delta: -1 | 1) {
    requestYearChange(
      Math.min(WORK_CALENDAR_MAX_YEAR, Math.max(WORK_CALENDAR_MIN_YEAR, stepBaseYear + delta))
    );
  }

  function handleControlBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    commitYear();
  }

  return (
    <div className='flex items-center gap-2' onBlur={handleControlBlur}>
      <Button
        type='button'
        size='icon'
        variant='outline'
        aria-label='上一年'
        disabled={stepBaseYear <= WORK_CALENDAR_MIN_YEAR}
        onClick={() => stepYear(-1)}
      >
        <Icons.chevronLeft className='size-4' />
      </Button>
      <Input
        className='w-28 text-center tabular-nums'
        type='text'
        inputMode='numeric'
        pattern='[0-9]*'
        maxLength={4}
        aria-label='工作日历年份'
        value={yearInput}
        onChange={(event) => {
          if (/^\d{0,4}$/.test(event.target.value)) setYearInput(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitYear();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setYearInput(String(year));
          }
        }}
      />
      <Button
        type='button'
        size='icon'
        variant='outline'
        aria-label='下一年'
        disabled={stepBaseYear >= WORK_CALENDAR_MAX_YEAR}
        onClick={() => stepYear(1)}
      >
        <Icons.chevronRight className='size-4' />
      </Button>
    </div>
  );
}

function parseYearInput(value: string) {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= WORK_CALENDAR_MIN_YEAR && year <= WORK_CALENDAR_MAX_YEAR ? year : null;
}
