import React, { useId } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toRem } from '../utils/units';

/* Dashboard charts. Colours come from CSS (`.sila-chart …` rules in components.css) so marks
   follow the design tokens. Multi-series charts use a validated 3-slot categorical order:
   series 1 = brand blue, 2 = orange, 3 = aqua (aqua is below 3:1 on white, so every
   multi-series chart also shows a legend with totals and a tooltip). */

/* ------------------------------------------------------------------ Formatting */

/** "2026-04" → "Apr" (with the year on January and on the first point). */
export const formatMonth = (month: string, withYear = false): string => {
  const [year, m] = month.split('-').map(Number);
  if (!year || !m) return month;
  const date = new Date(year, m - 1, 1);
  const name = date.toLocaleString(undefined, { month: 'short' });
  return withYear || m === 1 ? `${name} ’${String(year).slice(2)}` : name;
};

const defaultFormat = (value: number) => value.toLocaleString();

/** Bar length as a percentage of `max`; any non-zero value stays visible at 2%. */
const barPercent = (value: number, max: number): string =>
  max > 0 ? `${Math.max((value / max) * 100, value > 0 ? 2 : 0)}%` : '0%';

/* Motion. 'auto' lets Recharts skip animation when the OS asks for reduced motion. */
const BAR_ANIMATION = { isAnimationActive: 'auto', animationDuration: 700, animationEasing: 'ease-out' } as const;
const TOOLTIP_ANIMATION = { isAnimationActive: 'auto', animationDuration: 150, animationEasing: 'ease-out' } as const;
/** Delay between series in a grouped chart, so the columns rise one after another. */
const SERIES_STAGGER_MS = 120;

/* ------------------------------------------------------------------ Card */

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Shown instead of the chart when there is nothing to plot. */
  empty?: boolean;
  emptyText?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, actions, empty, emptyText = 'No data to show yet.', className = '', children }) => {
  const titleId = useId();
  return (
    <section className={`sila-card sila-chart-card ${className}`.trim()} aria-labelledby={titleId}>
      <div className="sila-card-header">
        <div>
          <h2 id={titleId} className="sila-card-title">{title}</h2>
          {subtitle && <p className="sila-card-subtitle">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="sila-chart-body">{empty ? <p className="sila-chart-empty">{emptyText}</p> : children}</div>
    </section>
  );
};

/* ------------------------------------------------------------------ Tooltip */

interface TooltipRow {
  label: string;
  value: string;
  seriesIndex?: number;
}

const TooltipBox: React.FC<{ title: string; rows: TooltipRow[]; note?: string }> = ({ title, rows, note }) => (
  <div className="sila-chart-tooltip">
    <div className="sila-chart-tooltip-label">{title}</div>
    {rows.map((row) => (
      <div key={row.label} className="sila-chart-tooltip-row">
        {row.seriesIndex !== undefined && <span className={`sila-chart-swatch sila-series-${row.seriesIndex + 1}`} aria-hidden="true" />}
        <span>{row.label}</span>
        <strong>{row.value}</strong>
      </div>
    ))}
    {note && <div className="sila-chart-tooltip-note">{note}</div>}
  </div>
);

/* ------------------------------------------------------------------ Single-series columns */

export interface ChartDatum {
  key: string;
  label: string;
  value: number;
  /** Extra line in the tooltip, e.g. the budget behind a count. */
  note?: string;
  /** De-emphasised bar, e.g. a "past" bucket next to upcoming ones. */
  muted?: boolean;
}

export interface ColumnChartProps {
  data: ChartDatum[];
  /** Unit name used in the tooltip and accessible summary, e.g. "RFQs". */
  valueLabel: string;
  height?: number;
  formatValue?: (value: number) => string;
}

/** Vertical bars for a handful of ordered buckets, with values labelled on each bar. */
export const ColumnChart: React.FC<ColumnChartProps> = ({ data, valueLabel, height = 220, formatValue = defaultFormat }) => {
  const summary = data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(', ');
  return (
    <figure className="sila-chart" style={{ '--sila-chart-height': toRem(height) } as React.CSSProperties} role="img" aria-label={`${valueLabel} — ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} className="sila-chart-grid-line" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} className="sila-chart-axis" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} className="sila-chart-axis" domain={[0, (max: number) => Math.max(max, 4)]} />
          <Tooltip
            cursor={{ className: 'sila-chart-cursor' }}
            {...TOOLTIP_ANIMATION}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const datum = payload[0].payload as ChartDatum;
              return <TooltipBox title={datum.label} rows={[{ label: valueLabel, value: formatValue(datum.value) }]} note={datum.note} />;
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} {...BAR_ANIMATION}>
            {data.map((d) => (
              <Cell key={d.key} className={d.muted ? 'sila-chart-bar sila-chart-bar--muted' : 'sila-chart-bar'} />
            ))}
            <LabelList dataKey="value" position="top" className="sila-chart-value" formatter={(v: unknown) => (Number(v) > 0 ? formatValue(Number(v)) : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
};

/* ------------------------------------------------------------------ Multi-series columns */

export interface ChartSeries {
  key: string;
  label: string;
}

export interface GroupedColumnChartProps {
  /** Rows keyed by `categoryKey` plus one numeric field per series key. */
  data: Array<Record<string, string | number>>;
  categoryKey: string;
  series: ChartSeries[];
  formatCategory?: (category: string, index: number) => string;
  /** Extra tooltip line per row, e.g. the budget of that month. */
  noteFor?: (row: Record<string, string | number>) => string | undefined;
  height?: number;
}

/**
 * Side-by-side bars per category (max 3 series). The legend doubles as a totals summary,
 * giving every series a visible label as well as its colour.
 */
export const GroupedColumnChart: React.FC<GroupedColumnChartProps> = ({
  data,
  categoryKey,
  series,
  formatCategory = (c) => c,
  noteFor,
  height = 260,
}) => {
  const totals = series.map((s) => data.reduce((sum, row) => sum + Number(row[s.key] ?? 0), 0));
  const summary = series.map((s, i) => `${s.label} ${totals[i]}`).join(', ');
  const labelled = data.map((row, index) => ({ ...row, __label: formatCategory(String(row[categoryKey]), index) }));

  return (
    <div className="sila-chart-stack">
      <ul className="sila-chart-legend" aria-label="Series totals">
        {series.map((s, i) => (
          <li key={s.key}>
            <span className={`sila-chart-swatch sila-series-${i + 1}`} aria-hidden="true" />
            <span>{s.label}</span>
            <strong>{totals[i].toLocaleString()}</strong>
          </li>
        ))}
      </ul>
      <figure className="sila-chart" style={{ '--sila-chart-height': toRem(height) } as React.CSSProperties} role="img" aria-label={`${summary} over ${data.length} periods`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={labelled} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%" barGap={2}>
            <CartesianGrid vertical={false} className="sila-chart-grid-line" />
            <XAxis dataKey="__label" tickLine={false} axisLine={false} tickMargin={8} interval={0} className="sila-chart-axis" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} className="sila-chart-axis" domain={[0, (max: number) => Math.max(max, 4)]} />
            <Tooltip
              cursor={{ className: 'sila-chart-cursor' }}
              {...TOOLTIP_ANIMATION}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0].payload as Record<string, string | number>;
                return (
                  <TooltipBox
                    title={String(row.__label)}
                    rows={series.map((s, i) => ({ label: s.label, value: Number(row[s.key] ?? 0).toLocaleString(), seriesIndex: i }))}
                    note={noteFor?.(row)}
                  />
                );
              }}
            />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} className={`sila-series-${i + 1}`} radius={[3, 3, 0, 0]} maxBarSize={18} {...BAR_ANIMATION} animationBegin={i * SERIES_STAGGER_MS} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </figure>
    </div>
  );
};

/* ------------------------------------------------------------------ Horizontal bar list */

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  /** Text shown at the end of the bar; defaults to the formatted value. */
  display?: string;
  /** Secondary line under the label, e.g. "4 RFQs". */
  detail?: React.ReactNode;
}

export interface BarListProps {
  items: BarListItem[];
  formatValue?: (value: number) => string;
  /** Keep the given order instead of sorting largest first (e.g. lifecycle stages). */
  preserveOrder?: boolean;
}

/** Ranked horizontal bars in plain HTML: label, proportional bar, direct value label. */
export const BarList: React.FC<BarListProps> = ({ items, formatValue = defaultFormat, preserveOrder = false }) => {
  const max = Math.max(...items.map((item) => item.value), 0);
  const rows = preserveOrder ? items : [...items].sort((a, b) => b.value - a.value);
  return (
    <ul className="sila-bar-list">
      {rows.map((item, index) => {
        const shown = item.display ?? formatValue(item.value);
        return (
          <li key={item.key} className="sila-bar-list-row" style={{ '--sila-i': index } as React.CSSProperties} title={`${item.label}: ${shown}`}>
            <div className="sila-bar-list-text">
              <span className="sila-bar-list-label">{item.label}</span>
              {item.detail && <span className="sila-bar-list-detail">{item.detail}</span>}
            </div>
            <div className="sila-bar-list-track" aria-hidden="true">
              <span className="sila-bar-list-fill" style={{ '--sila-bar-value': barPercent(item.value, max) } as React.CSSProperties} />
            </div>
            <span className="sila-bar-list-value">{shown}</span>
          </li>
        );
      })}
    </ul>
  );
};

/* ------------------------------------------------------------------ Funnel */

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  /** Optional money/detail line under the count. */
  detail?: string;
}

/** Stage-to-stage conversion: each step's bar is relative to the first step. */
export const FunnelChart: React.FC<{ steps: FunnelStep[] }> = ({ steps }) => {
  const first = steps[0]?.count ?? 0;
  return (
    <ol className="sila-funnel">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].count : 0;
        const conversion = index > 0 && previous > 0 ? Math.round((step.count / previous) * 100) : null;
        return (
          <li key={step.key} className="sila-funnel-step" style={{ '--sila-i': index } as React.CSSProperties}>
            <div className="sila-funnel-head">
              <span className="sila-funnel-label">{step.label}</span>
              {conversion !== null && <span className="sila-funnel-rate">{conversion}% of {steps[index - 1].label.toLowerCase()}</span>}
            </div>
            <div className="sila-funnel-bar-row">
              <div className="sila-funnel-track" aria-hidden="true">
                <span className="sila-funnel-fill" style={{ '--sila-bar-value': barPercent(step.count, first) } as React.CSSProperties} />
              </div>
              <span className="sila-funnel-count">{step.count.toLocaleString()}</span>
            </div>
            {step.detail && <span className="sila-funnel-detail">{step.detail}</span>}
          </li>
        );
      })}
    </ol>
  );
};
