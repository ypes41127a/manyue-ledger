import { useMemo, useState } from 'react';
import { computeLedger, prevDecemberNetWorth } from '../core/ledger';
import type { LedgerYear } from '../core/ledger';
import { MONTHS, SECTION_LABEL } from '../core/types';
import type { Section } from '../core/types';
import { useStore } from '../db/store';
import { Donut, foldSeries, GroupedBars, LinesChart, monthRows, SERIES, ShareBars, StackedArea } from './charts';
import { fmtMoney, fmtNum, fmtPct, fmtSigned, monthLabel } from './format';
import { Button, Card, Kpi, Segmented } from './kit';
import { monthStatus } from './status';
import { YearTable } from './YearTable';
import type { TRow, TSection } from './YearTable';

export function useLedger(): LedgerYear {
  const { data, book } = useStore();
  return useMemo(
    () => computeLedger(book, data.settings, prevDecemberNetWorth(data.years, book.year, data.settings)),
    [data, book],
  );
}

const STATUS_STYLE = {
  done: 'bg-brand text-white border-brand',
  todo: 'bg-warnbg text-warnink border-transparent',
  future: 'bg-surface text-muted border-line',
  none: 'bg-surface text-muted border-line',
} as const;
export const STATUS_TEXT = { done: '已完成', todo: '未完成', future: '未到', none: '—' } as const;

export function MonthStrip({ onFill }: { onFill: (m: number) => void }) {
  const { book, data } = useStore();
  const hasPrev = !!data.years[book.year - 1];
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
      {MONTHS.map((m) => {
        const st = monthStatus(book, m, hasPrev);
        return (
          <button key={m} type="button" onClick={() => onFill(m)} className={`rounded-xl border px-1 py-1.5 text-center ${STATUS_STYLE[st]}`} aria-label={`${monthLabel(m)} ${STATUS_TEXT[st]}`}>
            <div className="text-sm font-medium">{monthLabel(m)}</div>
            <div className="text-[11px]">{STATUS_TEXT[st]}</div>
          </button>
        );
      })}
    </div>
  );
}

export function LedgerPage({ onFill }: { onFill: (m?: number) => void }) {
  const { book, data } = useStore();
  const l = useLedger();
  const [range, setRange] = useState<'month' | 'year'>('month');
  const cur = l.last;
  const has = cur >= 0;
  const label = has ? monthLabel(cur) : '本月';

  const netRows = monthRows((m) => ({ net: l.active[m] ? l.netWorth[m] : null }));
  const assetGroups = foldSeries(l.groups.asset.map((g) => ({ label: g.group, values: g.values })));
  const assetRows = monthRows((m) => Object.fromEntries(assetGroups.defs.map((d) => [d.key, l.active[m] ? assetGroups.values[d.key][m] : null])));
  const flowRows = monthRows((m) => ({
    income: l.active[m] ? l.totals.income[m] : null,
    expense: l.active[m] ? l.totals.expense[m] : null,
    rate: l.savingsRate[m],
  }));
  const expenseItems = l.groups.expense.flatMap((g) => g.items);

  const sections: Section[] = ['asset', 'income', 'expense', 'invest'];
  if (data.settings.liabilitiesEnabled) sections.push('liability');
  const headLabel: Record<Section, string> = { asset: '資產總計', income: '收入總計', expense: '支出總計', invest: '投資總計', liability: '負債總計' };
  const balance = (s: Section) => s === 'asset' || s === 'liability';
  const money = (v: number[]) => MONTHS.map((m) => (l.active[m] ? fmtMoney(v[m]) : ''));

  const tableSections: TSection[] = sections.map((s) => {
    const rows: TRow[] = [];
    for (const g of l.groups[s]) {
      if (l.groups[s].length > 1 && g.items.length > 1) rows.push({ key: `${s}-${g.group}`, label: `${g.group} 小計`, cells: money(g.values), strong: true });
      for (const it of g.items) {
        const fx = it.kind === 'fx';
        rows.push({
          key: it.id,
          label: fx ? `${it.name}（${it.currency}）` : it.name,
          cells: MONTHS.map((m) => {
            if (!l.active[m]) return '';
            const twd = fmtMoney(l.itemValues[it.id][m]);
            return fx ? `${twd} (${fmtNum(book.months[m].values[it.id] ?? 0)})` : twd;
          }),
          total: balance(s) ? fmtSigned(l.itemTotal[it.id]) : fmtMoney(l.itemTotal[it.id]),
          pct: fmtPct(l.itemPct[it.id], 1, balance(s)),
        });
        if (it.note && book.months.some((e) => e.notes[it.id]))
          rows.push({ key: `${it.id}-note`, label: `　${it.name} 備註`, cells: MONTHS.map((m) => book.months[m].notes[it.id] ?? ''), note: true });
      }
    }
    return {
      key: s,
      head: {
        key: s,
        label: headLabel[s],
        cells: money(l.totals[s]),
        total: balance(s) ? fmtSigned(l.sectionTotal[s]) : fmtMoney(l.sectionTotal[s]),
        pct: balance(s) ? fmtPct(l.sectionPct[s], 1, true) : '',
      },
      rows,
    };
  });

  const footer: TRow[] = [
    { key: 'net', label: '個人淨值', cells: money(l.netWorth), total: has ? fmtSigned(l.netWorthChange) : '', pct: fmtPct(l.netWorthChangePct, 1, true) },
    { key: 'growth', label: '淨值月成長率', cells: MONTHS.map((m) => (l.active[m] ? fmtPct(l.growth[m], 1, true) : '')) },
    { key: 'saving', label: '儲蓄率', cells: MONTHS.map((m) => (l.active[m] ? fmtPct(l.savingsRate[m]) : '')), pct: fmtPct(l.sectionTotal.income ? (l.sectionTotal.income - l.sectionTotal.expense) / l.sectionTotal.income : null) },
  ];

  return (
    <div className="space-y-4">
      <Card title={`${book.year} 年填寫狀態`} action={<Button variant="primary" onClick={() => onFill()}>填寫本月</Button>}>
        <MonthStrip onFill={onFill} />
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`${label}淨值`} value={has ? fmtMoney(l.netWorth[cur]) : '—'} sub={has ? `資產 ${fmtMoney(l.totals.asset[cur])}` : '尚未填寫'} />
        <Kpi label="淨值月成長率" value={has ? fmtPct(l.growth[cur], 1, true) : '—'} sub={has && cur > 0 && l.active[cur - 1] ? `較上月 ${fmtSigned(l.netWorth[cur] - l.netWorth[cur - 1])}` : '需要上個月資料'} />
        <Kpi label="年初至今淨值成長" value={has ? fmtSigned(l.netWorthChange) : '—'} sub={fmtPct(l.netWorthChangePct, 1, true)} />
        <Kpi label={`${label}儲蓄率`} value={has ? fmtPct(l.savingsRate[cur]) : '—'} sub={has ? `收入 ${fmtMoney(l.totals.income[cur])}・支出 ${fmtMoney(l.totals.expense[cur])}` : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="淨值趨勢">
          <LinesChart data={netRows} series={[{ key: 'net', label: '個人淨值', color: SERIES[0] }]} />
        </Card>
        <Card title="每月收入與支出">
          <GroupedBars
            data={flowRows}
            syncId="flow"
            height={190}
            series={[
              { key: 'income', label: '收入', color: SERIES[0] },
              { key: 'expense', label: '支出', color: SERIES[1] },
            ]}
          />
          <div className="mt-3 mb-1 text-xs text-ink2">儲蓄率</div>
          <LinesChart data={flowRows} syncId="flow" height={110} percent series={[{ key: 'rate', label: '儲蓄率', color: SERIES[2] }]} />
        </Card>
        <Card title="資產配置走勢">
          <StackedArea data={assetRows} series={assetGroups.defs} />
        </Card>
        <Card title={`${label}資產配置`}>
          <Donut slices={has ? l.groups.asset.map((g) => ({ label: g.group, value: g.values[cur] })) : []} />
        </Card>
        <Card
          className="lg:col-span-2"
          title="支出類別占比"
          action={
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: 'month', label: label },
                { value: 'year', label: '全年' },
              ]}
            />
          }
        >
          <ShareBars slices={expenseItems.map((it) => ({ label: it.name, value: range === 'year' ? l.itemTotal[it.id] : has ? l.itemValues[it.id][cur] : 0 }))} />
        </Card>
      </div>

      <Card title={`${book.year} 年度總表`}>
        <YearTable sections={tableSections} footer={footer} totalLabel="Total" onMonth={onFill} />
        <p className="mt-2 text-xs text-muted">
          {SECTION_LABEL.asset}的 Total 為最近一個月與年初的差額，% 為成長率；收入、支出、投資的 Total 為全年加總，% 為占該區塊的比例。外幣括號內為原幣金額。個人淨值 ＝ 資產總計 − 當月支出總計
          {data.settings.liabilitiesEnabled ? ' − 負債總計' : ''}。
        </p>
      </Card>
    </div>
  );
}
