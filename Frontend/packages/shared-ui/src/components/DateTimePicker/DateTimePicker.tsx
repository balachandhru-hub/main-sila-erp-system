import React, { useEffect, useMemo, useRef, useState } from 'react';
import './DateTimePicker.css';

export type DateTimePickerMode = 'date' | 'datetime';

export interface DateTimePickerProps {
  /** Current value. "YYYY-MM-DD" for mode="date", "YYYY-MM-DDTHH:mm" for mode="datetime". */
  value: string;
  /** Called with a value in the same format as `value`. */
  onChange: (value: string) => void;
  mode?: DateTimePickerMode;
  /** Same format as `value`. Dates/times before this are disabled. */
  min?: string;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
  /** Pre-formatted text to show in the trigger instead of the raw value. */
  displayValue?: string;
  id?: string;
}

interface ParsedValue {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i);

const pad2 = (n: number) => String(n).padStart(2, '0');

const parseValue = (value: string | undefined): ParsedValue | null => {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart) return null;
  const [yStr, mStr, dStr] = datePart.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const day = parseInt(dStr, 10);
  if (!year || !month || !day) return null;
  let hour = 0;
  let minute = 0;
  if (timePart) {
    const [hStr, minStr] = timePart.split(':');
    hour = parseInt(hStr, 10) || 0;
    minute = parseInt(minStr, 10) || 0;
  }
  return { year, month, day, hour, minute };
};

const formatDateOnly = (p: { year: number; month: number; day: number }) =>
  `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;

const formatDateTime = (p: ParsedValue) => `${formatDateOnly(p)}T${pad2(p.hour)}:${pad2(p.minute)}`;

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const firstWeekday = (year: number, month: number) => new Date(year, month - 1, 1).getDay();

const to24Hour = (hour12: number, ampm: 'AM' | 'PM') => {
  if (ampm === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
};

const to12Hour = (hour24: number): { hour12: number; ampm: 'AM' | 'PM' } => {
  const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return { hour12, ampm };
};

const CalendarIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const ChevronIcon: React.FC<{ direction: 'left' | 'right' }> = ({ direction }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
  </svg>
);

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  mode = 'datetime',
  min,
  disabled = false,
  error = false,
  placeholder = 'Select',
  displayValue,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedValue = useMemo(() => parseValue(value), [value]);
  const parsedMin = useMemo(() => parseValue(min), [min]);

  const now = new Date();
  const initialSource = parsedValue || parsedMin;
  const [viewYear, setViewYear] = useState(initialSource?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialSource?.month ?? now.getMonth() + 1);

  useEffect(() => {
    if (!isOpen) return;
    const source = parsedValue || parsedMin;
    if (source) {
      setViewYear(source.year);
      setViewMonth(source.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const minDatePart = min ? min.split('T')[0] : undefined;
  const minHour24 = mode === 'datetime' && parsedMin ? parsedMin.hour : undefined;
  const minMinute = mode === 'datetime' && parsedMin ? parsedMin.minute : undefined;

  const isDayDisabled = (year: number, month: number, day: number) => {
    if (!min) return false;
    const dayStr = formatDateOnly({ year, month, day });
    if (mode === 'date') return dayStr < (minDatePart as string);
    return `${dayStr}T23:59` < min;
  };

  const selectedDayStr = parsedValue ? formatDateOnly(parsedValue) : null;
  const isSelectedDayAtMin = mode === 'datetime' && !!selectedDayStr && selectedDayStr === minDatePart;

  const currentAmpm: 'AM' | 'PM' = parsedValue ? to12Hour(parsedValue.hour).ampm : 'AM';
  const currentHour12 = parsedValue ? to12Hour(parsedValue.hour).hour12 : undefined;

  const isAmpmDisabled = (ampm: 'AM' | 'PM') => {
    if (!isSelectedDayAtMin || minHour24 === undefined) return false;
    return ampm === 'AM' && minHour24 >= 12;
  };

  const isHourDisabled = (hour12: number) => {
    if (!isSelectedDayAtMin || minHour24 === undefined) return false;
    return to24Hour(hour12, currentAmpm) < minHour24;
  };

  const isMinuteDisabled = (minute: number) => {
    if (!isSelectedDayAtMin || minHour24 === undefined || minMinute === undefined || !parsedValue) return false;
    if (parsedValue.hour !== minHour24) return false;
    return minute < minMinute;
  };

  const getDefaultTime = (dayStr: string): { hour: number; minute: number } => {
    if (parsedValue) return { hour: parsedValue.hour, minute: parsedValue.minute };
    if (min && dayStr === minDatePart && parsedMin) return { hour: parsedMin.hour, minute: parsedMin.minute };
    return { hour: 9, minute: 0 };
  };

  const commitDay = (day: number) => {
    if (mode === 'date') {
      onChange(formatDateOnly({ year: viewYear, month: viewMonth, day }));
      setIsOpen(false);
      return;
    }
    const dayStr = formatDateOnly({ year: viewYear, month: viewMonth, day });
    let { hour, minute } = getDefaultTime(dayStr);
    if (dayStr === minDatePart && minHour24 !== undefined && minMinute !== undefined) {
      if (hour < minHour24 || (hour === minHour24 && minute < minMinute)) {
        hour = minHour24;
        minute = minMinute;
      }
    }
    onChange(formatDateTime({ year: viewYear, month: viewMonth, day, hour, minute }));
  };

  const commitHour = (hour12: number) => {
    if (!parsedValue) return;
    const hour24 = to24Hour(hour12, currentAmpm);
    let minute = parsedValue.minute;
    if (isSelectedDayAtMin && minHour24 !== undefined && hour24 === minHour24 && minute < (minMinute || 0)) {
      minute = minMinute || 0;
    }
    onChange(formatDateTime({ ...parsedValue, hour: hour24, minute }));
  };

  const commitMinute = (minute: number) => {
    if (!parsedValue) return;
    onChange(formatDateTime({ ...parsedValue, minute }));
  };

  const commitAmpm = (ampm: 'AM' | 'PM') => {
    if (!parsedValue) return;
    const hour24 = to24Hour(currentHour12 || 12, ampm);
    let minute = parsedValue.minute;
    if (isSelectedDayAtMin && minHour24 !== undefined && hour24 === minHour24 && minute < (minMinute || 0)) {
      minute = minMinute || 0;
    }
    onChange(formatDateTime({ ...parsedValue, hour: hour24, minute }));
  };

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const totalDays = daysInMonth(viewYear, viewMonth);
  const leadingBlanks = firstWeekday(viewYear, viewMonth);
  const dayCells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const triggerLabel = displayValue !== undefined ? displayValue : value;
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <div className="vosox-dtp-container" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        id={id}
        className={`vosox-dtp-trigger${error ? ' vosox-dtp-trigger-error' : ''}${disabled ? ' vosox-dtp-trigger-disabled' : ''}${isOpen ? ' vosox-dtp-trigger-open' : ''}`}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-invalid={error || undefined}
      >
        <span className="vosox-dtp-trigger-text">
          {triggerLabel || <span className="vosox-dtp-placeholder">{placeholder}</span>}
        </span>
        <span className="vosox-dtp-icon">
          <CalendarIcon />
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="vosox-dtp-panel" role="dialog" aria-label={mode === 'date' ? 'Choose date' : 'Choose date and time'}>
          <div className="vosox-dtp-body">
          <div className="vosox-dtp-calendar">
            <div className="vosox-dtp-cal-header">
              <button type="button" className="vosox-dtp-nav-btn" onClick={goPrevMonth} aria-label="Previous month">
                <ChevronIcon direction="left" />
              </button>
              <span className="vosox-dtp-cal-title" aria-live="polite">
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </span>
              <button type="button" className="vosox-dtp-nav-btn" onClick={goNextMonth} aria-label="Next month">
                <ChevronIcon direction="right" />
              </button>
            </div>
            <div className="vosox-dtp-weekdays" aria-hidden="true">
              {WEEKDAYS.map((wd) => (
                <span key={wd}>{wd}</span>
              ))}
            </div>
            <div className="vosox-dtp-days-grid">
              {dayCells.map((day, idx) => {
                if (day === null) {
                  return <span key={`blank-${idx}`} className="vosox-dtp-day-cell vosox-dtp-day-blank" />;
                }
                const isSelected =
                  !!parsedValue && parsedValue.year === viewYear && parsedValue.month === viewMonth && parsedValue.day === day;
                const isToday = viewYear === todayYear && viewMonth === todayMonth && day === todayDay;
                return (
                  <button
                    type="button"
                    key={day}
                    className={`vosox-dtp-day-cell${isSelected ? ' vosox-dtp-day-selected' : ''}${isToday ? ' vosox-dtp-day-today' : ''}`}
                    disabled={isDayDisabled(viewYear, viewMonth, day)}
                    onClick={() => commitDay(day)}
                    aria-pressed={isSelected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${MONTH_NAMES[viewMonth - 1]} ${day}, ${viewYear}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === 'datetime' && (
            <div className="vosox-dtp-time">
              <div className="vosox-dtp-time-col">
                <div className="vosox-dtp-time-col-label">Hour</div>
                <div className="vosox-dtp-time-col-list" role="group" aria-label="Hour">
                  {HOURS_12.map((h) => (
                    <button
                      type="button"
                      key={h}
                      className={`vosox-dtp-time-cell${currentHour12 === h ? ' vosox-dtp-time-selected' : ''}`}
                      aria-pressed={currentHour12 === h}
                      disabled={!parsedValue || isHourDisabled(h)}
                      onClick={() => commitHour(h)}
                    >
                      {pad2(h)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="vosox-dtp-time-col">
                <div className="vosox-dtp-time-col-label">Minute</div>
                <div className="vosox-dtp-time-col-list" role="group" aria-label="Minute">
                  {MINUTES_60.map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={`vosox-dtp-time-cell${parsedValue?.minute === m ? ' vosox-dtp-time-selected' : ''}`}
                      aria-pressed={parsedValue?.minute === m}
                      disabled={!parsedValue || isMinuteDisabled(m)}
                      onClick={() => commitMinute(m)}
                    >
                      {pad2(m)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="vosox-dtp-time-col vosox-dtp-time-col-ampm">
                <div className="vosox-dtp-time-col-label">AM/PM</div>
                <div className="vosox-dtp-time-col-list" role="group" aria-label="AM/PM">
                  {(['AM', 'PM'] as const).map((ap) => (
                    <button
                      type="button"
                      key={ap}
                      className={`vosox-dtp-time-cell${!!parsedValue && currentAmpm === ap ? ' vosox-dtp-time-selected' : ''}`}
                      aria-pressed={!!parsedValue && currentAmpm === ap}
                      disabled={!parsedValue || isAmpmDisabled(ap)}
                      onClick={() => commitAmpm(ap)}
                    >
                      {ap}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>

          <div className="vosox-dtp-footer">
            <button type="button" className="vosox-dtp-done-btn" onClick={() => setIsOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateTimePicker;
