import type { ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCompact, fmtMoney, fmtPct, monthLabel } from './format';

/** 類別色：固定順序、依項目指派，不循環使用（第 9 個以後併入「其他」） */
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
const OTHER_COLOR = 'var(--muted)';

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}
type Row = { m: string } & Record<string, number | null | string>;
type Fmt = (v: number) => string;

export function monthRows(build: (m: number) => Record<string, number | null>): Row[] {
  return Array.from({ length: 12 }, (_, m) => ({ m: monthLabel(m), ...build(m) }));
}

/** 超過 8 個類別時，保留金額最大的 7 個，其餘合併為「其他」 */
export function foldSeries(entries: { label: string; values: number[] }[]): { defs: SeriesDef[]; values: Record<string, number[]> } {
  const size = (e: { values: number[] }) => e.values.reduce((t, v) => t + Math.abs(v), 0);
  let list = entries;
  if (entries.length > SERIES.length) {
    const keep = new Set([...entries].sort((a, b) => size(b) - size(a)).slice(0, SERIES.length - 1));
    const rest = entries.filter((e) => !keep.has(e));
    list = [...entries.filter((e) => keep.has(e)), { label: '其他', values: rest[0].values.map((_, i) => rest.reduce((t, e) => t + e.values[i], 0)) }];
  }
  const defs: SeriesDef[] = [];
  const values: Record<string, number[]> = {};
  list.forEach((e, i) => {
    const key = `k${i}`;
    defs.push({ key, label: e.label, color: e.label === '其他' && entries.length > SERIES.length ? OTHER_COLOR : SERIES[i] });
    values[key] = e.values;
  });
  return { defs, values };
}

const axis = { tick: { fill: 'var(--muted)', fontSize: 10 }, tickLine: false as const };

export function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink2">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tip({ active, payload, label, series, fmt, total }: { active?: boolean; payload?: readonly { dataKey?: unknown; value?: unknown }[]; label?: unknown; series: SeriesDef[]; fmt: Fmt; total?: boolean }) {
  if (!active || !payload?.length) return null;
  const rows = series
    .map((s) => ({ s, v: payload.find((p) => p.dataKey === s.key)?.value }))
    .filter((r): r is { s: SeriesDef; v: number } => typeof r.v === 'number');
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-ink">{String(label)}</div>
      {rows.map(({ s, v }) => (
        <div key={s.key} className="flex items-center justify-between gap-4 text-ink2">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="tnum text-ink">{fmt(v)}</span>
        </div>
      ))}
      {total && rows.length > 1 && (
        <div className="mt-1 flex justify-between gap-4 border-t border-line pt-1 text-ink2">
          <span>合計</span>
          <span className="tnum text-ink">{fmt(rows.reduce((t, r) => t + r.v, 0))}</span>
        </div>
      )}
    </div>
  );
}

function Frame({ height = 240, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const margin = { top: 8, right: 14, bottom: 0, left: 0 };
const grid = <CartesianGrid stroke="var(--line)" vertical={false} />;
const xAxis = <XAxis dataKey="m" {...axis} axisLine={{ stroke: 'var(--axis)' }} interval={0} />;
const yAxis = (fmt: Fmt, width = 48) => <YAxis {...axis} axisLine={false} width={width} tickFormatter={fmt} />;
const dot = { r: 4, strokeWidth: 2, stroke: 'var(--surface)' };
const pctAxis: Fmt = (v) => fmtPct(v, 0);

export function LinesChart({ data, series, percent, height, syncId }: { data: Row[]; series: SeriesDef[]; percent?: boolean; height?: number; syncId?: string }) {
  const fmt: Fmt = percent ? (v) => fmtPct(v) : fmtMoney;
  return (
    <>
      <Legend series={series} />
      <Frame height={height}>
        <LineChart data={data} margin={margin} syncId={syncId}>
          {grid}
          {xAxis}
          {yAxis(percent ? pctAxis : fmtCompact)}
          {percent && <ReferenceLine y={0} stroke="var(--axis)" />}
          <Tooltip content={(p) => <Tip {...p} series={series} fmt={fmt} />} cursor={{ stroke: 'var(--axis)' }} />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={{ ...dot, fill: s.color }} activeDot={{ ...dot, r: 5, fill: s.color }} isAnimationActive={false} />
          ))}
        </LineChart>
      </Frame>
    </>
  );
}

export function StackedArea({ data, series }: { data: Row[]; series: SeriesDef[] }) {
  return (
    <>
      <Legend series={series} />
      <Frame>
        <AreaChart data={data} margin={margin}>
          {grid}
          {xAxis}
          {yAxis(fmtCompact)}
          <Tooltip content={(p) => <Tip {...p} series={series} fmt={fmtMoney} total />} cursor={{ stroke: 'var(--axis)' }} />
          {series.map((s) => (
            // 2px 的底色描邊充當相鄰色塊之間的間隙
            <Area key={s.key} dataKey={s.key} name={s.label} stackId="a" type="linear" fill={s.color} fillOpacity={0.85} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false} />
          ))}
        </AreaChart>
      </Frame>
    </>
  );
}

export function GroupedBars({ data, series, syncId, height }: { data: Row[]; series: SeriesDef[]; syncId?: string; height?: number }) {
  return (
    <>
      <Legend series={series} />
      <Frame height={height}>
        <BarChart data={data} margin={margin} barGap={2} syncId={syncId}>
          {grid}
          {xAxis}
          {yAxis(fmtCompact)}
          <Tooltip content={(p) => <Tip {...p} series={series} fmt={fmtMoney} />} cursor={{ fill: 'var(--sunken)' }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={14} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </Frame>
    </>
  );
}

/** 正負值長條：獲利與虧損各用一個顏色，並附圖例 */
export function SignedBars({ data, dataKey, positive, negative }: { data: Row[]; dataKey: string; positive: string; negative: string }) {
  const series: SeriesDef[] = [
    { key: 'pos', label: positive, color: SERIES[0] },
    { key: 'neg', label: negative, color: SERIES[1] },
  ];
  const tipSeries: SeriesDef[] = [{ key: dataKey, label: '金額', color: 'var(--muted)' }];
  return (
    <>
      <Legend series={series} />
      <Frame>
        <BarChart data={data} margin={margin}>
          {grid}
          {xAxis}
          {yAxis(fmtCompact)}
          <ReferenceLine y={0} stroke="var(--axis)" />
          <Tooltip content={(p) => <Tip {...p} series={tipSeries} fmt={fmtMoney} />} cursor={{ fill: 'var(--sunken)' }} />
          <Bar dataKey={dataKey} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((r, i) => (
              <Cell key={i} fill={Number(r[dataKey]) < 0 ? SERIES[1] : SERIES[0]} />
            ))}
          </Bar>
        </BarChart>
      </Frame>
    </>
  );
}

/** 長條＋折線共用同一個金額座標軸 */
export function BarsWithLine({ data, bar, line }: { data: Row[]; bar: SeriesDef; line: SeriesDef }) {
  const series = [bar, line];
  return (
    <>
      <Legend series={series} />
      <Frame>
        <ComposedChart data={data} margin={margin}>
          {grid}
          {xAxis}
          {yAxis(fmtCompact)}
          <Tooltip content={(p) => <Tip {...p} series={series} fmt={fmtMoney} />} cursor={{ fill: 'var(--sunken)' }} />
          <Bar dataKey={bar.key} fill={bar.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Line dataKey={line.key} stroke={line.color} strokeWidth={2} dot={{ ...dot, fill: line.color }} isAnimationActive={false} />
        </ComposedChart>
      </Frame>
    </>
  );
}

export interface Slice {
  label: string;
  value: number;
}

function foldSlices(slices: Slice[]): (Slice & { color: string })[] {
  const pos = slices.filter((s) => s.value > 0);
  if (pos.length <= SERIES.length) return pos.map((s, i) => ({ ...s, color: SERIES[i] }));
  const sorted = [...pos].sort((a, b) => b.value - a.value);
  const keep = new Set(sorted.slice(0, SERIES.length - 1));
  const other = sorted.slice(SERIES.length - 1).reduce((t, s) => t + s.value, 0);
  return [...pos.filter((s) => keep.has(s)).map((s, i) => ({ ...s, color: SERIES[i] })), { label: '其他', value: other, color: OTHER_COLOR }];
}

export function Donut({ slices, empty = '這個月還沒有資料' }: { slices: Slice[]; empty?: string }) {
  const data = foldSlices(slices);
  const total = data.reduce((t, s) => t + s.value, 0);
  if (total <= 0) return <p className="py-10 text-center text-sm text-muted">{empty}</p>;
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="100%" paddingAngle={data.length > 1 ? 2 : 0} stroke="var(--surface)" strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
              {data.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full min-w-0 space-y-1 text-sm">
        {data.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-ink2">
              <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tnum shrink-0 text-ink">
              {fmtMoney(s.value)}
              <span className="ml-2 inline-block w-12 text-right text-ink2">{fmtPct(s.value / total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 占比橫條：類別多時比圓餅圖好讀 */
export function ShareBars({ slices, empty = '還沒有資料' }: { slices: Slice[]; empty?: string }) {
  const data = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const total = data.reduce((t, s) => t + s.value, 0);
  if (total <= 0) return <p className="py-10 text-center text-sm text-muted">{empty}</p>;
  const max = data[0].value;
  return (
    <ul className="space-y-2 text-sm">
      {data.map((s) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-ink2">{s.label}</span>
            <span className="tnum shrink-0 text-ink">
              {fmtMoney(s.value)}
              <span className="ml-2 inline-block w-12 text-right text-ink2">{fmtPct(s.value / total)}</span>
            </span>
          </div>
          <div className="mt-1 h-2 rounded-r bg-transparent">
            <div className="h-2 rounded-r" style={{ width: `${Math.max(1, (s.value / max) * 100)}%`, background: 'var(--s1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
