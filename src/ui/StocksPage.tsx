import { MARKET_LABEL, MARKETS, MONTHS } from '../core/types';
import { useStore } from '../db/store';
import { BarsWithLine, Donut, LinesChart, monthRows, SERIES, SignedBars, StackedArea } from './charts';
import { fmtMoney, fmtNum, fmtPct, fmtSigned, monthLabel } from './format';
import { Button, Card, Kpi } from './kit';
import { useLedger } from './LedgerPage';
import { YearTable } from './YearTable';
import type { TRow, TSection } from './YearTable';

export function StocksPage({ onFill }: { onFill: (m?: number) => void }) {
  const { book } = useStore();
  const s = useLedger().stocks;
  const cur = s.last;
  const has = cur >= 0;
  const a = s.annual;

  if (book.holdings.length === 0) {
    return (
      <Card title="還沒有持股">
        <p className="text-sm text-ink2">到「設定 → 持股」新增你持有的台股或美股，之後每月填寫股數與月底收盤價，這裡就會自動算出市值、損益與股息。</p>
        <p className="mt-2 text-sm text-ink2">沒有投資股票的話，可以不用理會這個分頁。</p>
      </Card>
    );
  }

  const on = (v: number[]) => (m: number) => (s.active[m] ? v[m] : null);
  const valueRows = monthRows((m) => ({ tw: on(s.market.TW.value)(m), us: on(s.market.US.value)(m) }));
  const rateRows = monthRows((m) => ({
    all: s.active[m] ? s.unrealRate[m] : null,
    tw: s.active[m] ? s.market.TW.plRate[m] : null,
    us: s.active[m] ? s.market.US.plRate[m] : null,
  }));
  const realizedRows = monthRows((m) => ({ v: on(s.realized)(m) }));
  const divRows = monthRows((m) => ({ div: on(s.cashDiv)(m), cum: on(s.cashDivCumulative)(m) }));

  const money = (v: number[]) => MONTHS.map((m) => (s.active[m] ? fmtMoney(v[m]) : ''));
  const signed = (v: number[]) => MONTHS.map((m) => (s.active[m] ? fmtSigned(v[m]) : ''));
  const pct = (v: (number | null)[]) => MONTHS.map((m) => (s.active[m] ? fmtPct(v[m], 1, true) : ''));
  const text = (pick: (m: number) => string | undefined) => MONTHS.map((m) => pick(m) ?? '');

  const inventory: TRow[] = book.holdings.flatMap((h) => [
    { key: `${h.id}-v`, label: `${h.code} ${h.name}`, cells: money(s.holdingValue[h.id]), strong: true, total: has ? fmtMoney(s.holdingValue[h.id][cur]) : '', pct: has ? fmtPct(a.value ? s.holdingValue[h.id][cur] / a.value : null) : '' },
    { key: `${h.id}-s`, label: '　股數', cells: MONTHS.map((m) => (s.active[m] ? fmtNum(book.months[m].shares[h.id] ?? 0) : '')) },
    { key: `${h.id}-p`, label: `　收盤價${h.market === 'US' ? '（美元）' : ''}`, cells: MONTHS.map((m) => (s.active[m] ? fmtNum(book.months[m].prices[h.id] ?? 0) : '')) },
  ]);

  const unreal: TRow[] = MARKETS.flatMap((mk) => {
    const c = s.market[mk];
    const y = s.annualByMarket[mk];
    const n = MARKET_LABEL[mk];
    return [
      { key: `${mk}-v`, label: `${n} 總現值`, cells: money(c.value), total: fmtMoney(y.value) },
      { key: `${mk}-c`, label: `${n} 總付出成本`, cells: money(c.cost), total: fmtMoney(y.cost) },
      { key: `${mk}-pl`, label: `${n} 損益`, cells: signed(c.pl), total: fmtSigned(y.unrealPl), strong: true },
      { key: `${mk}-r`, label: `${n} 獲利率`, cells: pct(c.plRate), total: fmtPct(y.unrealRate, 1, true) },
      { key: `${mk}-n`, label: `${n} 備註`, cells: text((m) => book.months[m].stock[mk].unrealNote), note: true },
    ];
  });

  const realized: TRow[] = [
    ...MARKETS.flatMap((mk): TRow[] => {
      const c = s.market[mk];
      const y = s.annualByMarket[mk];
      const n = MARKET_LABEL[mk];
      return [
        { key: `${mk}-s`, label: `${n} 總賣出`, cells: money(c.sell), total: fmtMoney(y.sell) },
        { key: `${mk}-b`, label: `${n} 總買進`, cells: money(c.buy), total: fmtMoney(y.buy) },
        { key: `${mk}-pl`, label: `${n} 損益`, cells: signed(c.realized), total: fmtSigned(y.realized), strong: true },
        { key: `${mk}-r`, label: `${n} 報酬率`, cells: pct(c.realizedRate), total: fmtPct(y.realizedRate, 1, true) },
        { key: `${mk}-n`, label: `${n} 備註`, cells: text((m) => book.months[m].stock[mk].realNote), note: true },
      ];
    }),
    { key: 'all-r', label: '合計已實現報酬率', cells: pct(s.realizedRate), total: fmtPct(a.realizedRate, 1, true), strong: true },
  ];

  const costs: TRow[] = MARKETS.flatMap((mk) => {
    const c = s.market[mk];
    const n = MARKET_LABEL[mk];
    const sumOf = (v: number[]) => fmtMoney(v.reduce((t, x) => t + x, 0));
    return [
      { key: `${mk}-f`, label: `${n} 手續費（減項）`, cells: money(c.fee), total: sumOf(c.fee) },
      { key: `${mk}-rb`, label: `${n} 電子折讓（加項）`, cells: money(c.rebate), total: sumOf(c.rebate) },
      { key: `${mk}-t`, label: `${n} 證交稅（減項）`, cells: money(c.tax), total: sumOf(c.tax) },
    ];
  });

  const withDiv = (key: 'cashDiv' | 'stockDiv') => book.holdings.filter((h) => book.months.some((e) => e[key][h.id]));
  const dividends: TRow[] = [
    ...withDiv('cashDiv').map((h) => ({ key: `${h.id}-c`, label: `現金股利 ${h.name}`, cells: MONTHS.map((m) => (s.holdingCashDiv[h.id][m] ? fmtMoney(s.holdingCashDiv[h.id][m]) : '')), total: fmtMoney(s.holdingCashDiv[h.id].reduce((t, x) => t + x, 0)) })),
    ...withDiv('stockDiv').map((h) => ({ key: `${h.id}-s`, label: `股票股利 ${h.name}（股）`, cells: MONTHS.map((m) => (book.months[m].stockDiv[h.id] ? fmtNum(book.months[m].stockDiv[h.id]) : '')), total: fmtNum(book.months.reduce((t, e) => t + (e.stockDiv[h.id] ?? 0), 0)) })),
  ];

  const sections: TSection[] = [
    { key: 'inv', head: { key: 'inv', label: '持股現值總計', cells: money(s.totalValue), total: fmtMoney(a.value) }, rows: inventory },
    { key: 'unreal', head: { key: 'unreal', label: '未實現損益', cells: signed(s.unrealPl), total: fmtSigned(a.unrealPl), pct: fmtPct(a.unrealRate, 1, true) }, rows: unreal },
    { key: 'real', head: { key: 'real', label: '已實現損益', cells: signed(s.realized), total: fmtSigned(a.realized), pct: fmtPct(a.realizedRate, 1, true) }, rows: realized },
    { key: 'cost', head: { key: 'cost', label: '交易成本總計', cells: money(s.netCost), total: fmtMoney(a.netCost) }, rows: costs },
    { key: 'div', head: { key: 'div', label: '股息總計', cells: money(s.cashDiv), total: fmtMoney(a.cashDiv) }, rows: dividends },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="持股總現值" value={has ? fmtMoney(a.value) : '—'} sub={has ? `${monthLabel(cur)}・台幣` : '尚未填寫'} />
        <Kpi label="未實現損益" value={has ? fmtSigned(a.unrealPl) : '—'} sub={`獲利率 ${fmtPct(a.unrealRate, 1, true)}`} />
        <Kpi label="今年已實現損益" value={fmtSigned(a.realized)} sub={`報酬率 ${fmtPct(a.realizedRate, 1, true)}`} />
        <Kpi label="今年股息累計" value={fmtMoney(a.cashDiv)} />
        <Kpi label="今年交易成本累計" value={fmtMoney(a.netCost)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="持股市值走勢">
          <StackedArea
            data={valueRows}
            series={[
              { key: 'tw', label: '台股', color: SERIES[0] },
              { key: 'us', label: '美股', color: SERIES[1] },
            ]}
          />
        </Card>
        <Card title="未實現獲利率走勢">
          <LinesChart
            data={rateRows}
            percent
            series={[
              { key: 'all', label: '合計', color: SERIES[2] },
              { key: 'tw', label: '台股', color: SERIES[0] },
              { key: 'us', label: '美股', color: SERIES[1] },
            ]}
          />
        </Card>
        <Card title="每月已實現損益">
          <SignedBars data={realizedRows} dataKey="v" positive="獲利" negative="虧損" />
        </Card>
        <Card title="每月股息與累計">
          <BarsWithLine data={divRows} bar={{ key: 'div', label: '當月現金股利', color: SERIES[0] }} line={{ key: 'cum', label: '今年累計', color: SERIES[1] }} />
        </Card>
        <Card className="lg:col-span-2" title={`${has ? monthLabel(cur) : '本月'}持股占比`}>
          <Donut slices={has ? book.holdings.map((h) => ({ label: `${h.code} ${h.name}`, value: s.holdingValue[h.id][cur] })) : []} />
        </Card>
      </div>

      <Card title={`${book.year} 年股票總表`} action={<Button variant="ghost" onClick={() => onFill()}>填寫本月</Button>}>
        <YearTable sections={sections} totalLabel="年度" onMonth={onFill} />
        <p className="mt-2 text-xs text-muted">金額皆為台幣；美股以當月美元匯率換算。未實現的「年度」欄為最近一個月的數字，其餘為全年加總。持股列的 % 為占持股總現值的比例。</p>
      </Card>
    </div>
  );
}
