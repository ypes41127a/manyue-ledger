import { useState } from 'react';
import type { ReactNode } from 'react';
import { addItem, prefillMonth, removeItem } from '../core/carry';
import { newId } from '../core/safe';
import { rateOf } from '../core/stocks';
import { MARKET_LABEL, MARKETS, MONTHS } from '../core/types';
import type { Item, Market, MarketMonth, MonthEntry, Section } from '../core/types';
import { useStore } from '../db/store';
import { exportBackup } from './actions';
import { HoldingsEditor } from './editors';
import { fmtDate, fmtMoney, fmtPct, fmtSigned, monthLabel } from './format';
import { Button, Card, NumInput, TextInput } from './kit';
import { STATUS_TEXT, useLedger } from './LedgerPage';
import { monthStatus } from './status';

const STEPS = ['月份', '匯率', '資產', '收入', '支出', '投資', '持股', '損益與股息', '確認'] as const;

function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_9.5rem] items-center gap-x-3 gap-y-0.5 py-1.5">
      <div className="min-w-0 text-sm text-ink">{label}</div>
      {children}
      {hint && <div className="col-span-2 text-right text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Wizard({ initialMonth, onClose }: { initialMonth: number; onClose: () => void }) {
  const { data, book, year, update } = useStore();
  const l = useLedger();
  const [month, setMonth] = useState(initialMonth);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const entry = book.months[month];
  const edit = (fn: (e: MonthEntry) => void) => update((d) => fn(d.years[year].months[month]));
  const setIn = (key: 'values' | 'rates' | 'shares' | 'prices' | 'cashDiv' | 'stockDiv', id: string) => (v: number | undefined) =>
    edit((e) => {
      if (v === undefined) delete e[key][id];
      else e[key][id] = v;
    });
  const setStock = (mk: Market, key: keyof MarketMonth) => (v: number | string | undefined) =>
    edit((e) => {
      if (v === undefined || v === '') delete e.stock[mk][key];
      else (e.stock[mk] as Record<string, number | string>)[key] = v;
    });

  const go = (to: number) => {
    // 離開「月份」步驟時帶入上個月數值（已填過的月份不會被覆蓋）
    if (step === 0 && to > 0) update((d) => prefillMonth(d.years[year], month, d.years[year - 1]));
    setStep(Math.max(0, Math.min(STEPS.length - 1, to)));
    document.getElementById('wizard-scroll')?.scrollTo(0, 0);
  };
  const finish = () => {
    update((d) => {
      const e = d.years[year].months[month];
      e.started = true;
      e.completed = true;
      e.completedAt = new Date().toISOString();
    });
    setDone(true);
  };

  const itemsOf = (s: Section) => book.items.filter((i) => i.section === s);
  const usd = rateOf(book, month, 'USD');

  function itemFields(section: Section) {
    const items = itemsOf(section);
    if (!items.length) return <p className="text-sm text-muted">這個區塊沒有項目，可到「設定」新增。</p>;
    const groups = [...new Set(items.map((i) => i.group))];
    // 支出項目可以直接在這裡增減
    const editable = section === 'expense';
    return groups.map((g) => (
      <Card key={g} title={g} className="mb-3">
        {items
          .filter((i) => i.group === g)
          .map((it) =>
            editable ? (
              <div key={it.id} className="flex items-start gap-1.5">
                <div className="min-w-0 flex-1">{itemField(it)}</div>
                <button
                  type="button"
                  aria-label={`刪除 ${it.name}`}
                  className="mt-2.5 size-9 shrink-0 rounded-lg border border-line text-danger hover:bg-sunken"
                  onClick={() =>
                    window.confirm(`確定刪除「${it.name}」？${year} 年各月已填的「${it.name}」金額也會一併刪除。`) && update((d) => removeItem(d.years[year], it.id))
                  }
                >
                  ✕
                </button>
              </div>
            ) : (
              itemField(it)
            ),
          )}
        {editable && <AddItem onAdd={(name) => update((d) => addItem(d.years[year], { id: newId('e'), section, group: g, name }))} />}
      </Card>
    ));
  }

  function itemField(it: Item) {
    const v = entry.values[it.id];
    if (it.kind === 'stockTW' || it.kind === 'stockUS') {
      return (
        <Field key={it.id} label={it.name} hint="由「持股」步驟的股數 × 收盤價自動計算">
          <div className="tnum pr-3 text-right text-ink2">{fmtMoney(l.itemValues[it.id]?.[month])}</div>
        </Field>
      );
    }
    if (it.kind === 'fx') {
      const r = rateOf(book, month, it.currency ?? '');
      return (
        <Field key={it.id} label={it.name} hint={`原幣金額 × 匯率 ${r} ＝ 台幣 ${fmtMoney((v ?? 0) * r)}`}>
          <NumInput label={it.name} value={v} onChange={setIn('values', it.id)} suffix={it.currency} />
        </Field>
      );
    }
    if (it.kind === 'interestDividend') {
      return (
        <Field key={it.id} label="銀行利息" hint={`加上股票現金股利 ${fmtMoney(l.stocks.cashDiv[month])}（自動）＝ ${fmtMoney(l.itemValues[it.id]?.[month])}`}>
          <NumInput label="銀行利息" value={v} onChange={setIn('values', it.id)} />
        </Field>
      );
    }
    return (
      <div key={it.id}>
        <Field label={it.name}>
          <NumInput label={it.name} value={v} onChange={setIn('values', it.id)} />
        </Field>
        {it.note && (
          <input
            aria-label={`${it.name} 備註`}
            placeholder={it.section === 'income' ? '備註，例如：中發票、二手拍賣' : '備註（寫個大概就好）'}
            value={entry.notes[it.id] ?? ''}
            onChange={(e) =>
              edit((x) => {
                if (e.target.value) x.notes[it.id] = e.target.value;
                else delete x.notes[it.id];
              })
            }
            className="mb-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3 placeholder:text-muted"
          />
        )}
      </div>
    );
  }

  const unit = (mk: Market) => (mk === 'US' ? 'USD' : undefined);
  const twdHint = (mk: Market, v: number | undefined) => (mk === 'US' && v ? `≈ 台幣 ${fmtMoney(v * usd)}` : undefined);

  let body: ReactNode;
  if (done) {
    body = (
      <Card title={`${monthLabel(month)}填寫完成 🎉`}>
        <p className="text-sm text-ink2">資料只存在這台裝置的瀏覽器裡。建議現在下載本月備份，存到雲端硬碟或傳給自己，萬一換手機或資料被清除時可以還原。</p>
        <p className="mt-2 text-sm text-ink2">上次備份：{fmtDate(data.settings.lastBackupAt)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => exportBackup(data, update)}>下載本月備份</Button>
          <Button onClick={onClose}>回到首頁</Button>
        </div>
      </Card>
    );
  } else if (step === 0) {
    body = (
      <Card title="要填寫哪個月？">
        <div className="grid grid-cols-4 gap-2">
          {MONTHS.map((m) => {
            const st = monthStatus(book, m, !!data.years[year - 1]);
            return (
              <button key={m} type="button" onClick={() => setMonth(m)} aria-pressed={m === month} className={`rounded-xl border px-1 py-2 text-center ${m === month ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink'}`}>
                <div className="font-medium">{monthLabel(m)}</div>
                <div className="text-[11px] opacity-80">{STATUS_TEXT[st]}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-ink2">
          {entry.started || entry.completed ? '這個月已經有資料，接下來可以直接修改。' : '第一次填這個月時，會先帶入上個月的資產餘額、持股、匯率與固定項目，你只需要改有變動的地方。'}
        </p>
      </Card>
    );
  } else if (step === 1) {
    body = (
      <Card title="本月匯率">
        {book.currencies.length === 0 && <p className="text-sm text-muted">沒有設定外幣，直接下一步。</p>}
        {book.currencies.map((c) => (
          <Field key={c.code} label={`${c.name}（${c.code}）`} hint={`1 ${c.code} ＝ ${rateOf(book, month, c.code)} 台幣`}>
            <NumInput label={`${c.name}匯率`} value={entry.rates[c.code]} placeholder={String(rateOf(book, month, c.code))} onChange={setIn('rates', c.code)} />
          </Field>
        ))}
        <p className="mt-2 text-xs text-muted">預設帶入上個月的匯率。可查銀行牌告或 Google 搜尋「美金 台幣」後修改。</p>
      </Card>
    );
  } else if (step === 2) {
    body = (
      <>
        {itemFields('asset')}
        {data.settings.liabilitiesEnabled && (
          <>
            <h3 className="mt-4 mb-2 text-sm font-semibold text-ink2">負債（本月底餘額）</h3>
            {itemFields('liability')}
          </>
        )}
      </>
    );
  } else if (step === 3) body = itemFields('income');
  else if (step === 4) body = itemFields('expense');
  else if (step === 5) {
    body = (
      <>
        <p className="mb-3 text-sm text-ink2">這些錢從存款轉成了投資資產，不算花掉，所以不計入支出總計。</p>
        {itemFields('invest')}
      </>
    );
  } else if (step === 6) {
    body = (
      <>
        {MARKETS.map((mk) => {
          const hs = book.holdings.filter((h) => h.market === mk);
          if (!hs.length) return null;
          return (
            <Card key={mk} title={`${MARKET_LABEL[mk]}持股`} className="mb-3">
              <div className="grid grid-cols-[1fr_6rem_6.5rem] gap-x-2 text-xs text-muted">
                <span />
                <span className="text-right">股數</span>
                <span className="text-right">月底收盤價{mk === 'US' ? '（美元）' : ''}</span>
              </div>
              {hs.map((h) => (
                <div key={h.id} className="grid grid-cols-[1fr_6rem_6.5rem] items-center gap-x-2 gap-y-0.5 py-1.5">
                  <div className="min-w-0 text-sm">
                    <div className="truncate">{h.name || h.code}</div>
                    <div className="text-xs text-muted">{h.code}</div>
                  </div>
                  <NumInput label={`${h.name} 股數`} value={entry.shares[h.id]} onChange={setIn('shares', h.id)} />
                  <NumInput label={`${h.name} 收盤價`} value={entry.prices[h.id]} onChange={setIn('prices', h.id)} />
                  <div className="col-span-3 text-right text-xs text-muted">市值 台幣 {fmtMoney(l.stocks.holdingValue[h.id]?.[month])}</div>
                </div>
              ))}
              <div className="mt-1 border-t border-line pt-2 text-right text-sm">
                {MARKET_LABEL[mk]}總現值 <span className="tnum font-semibold">{fmtMoney(l.stocks.market[mk].value[month])}</span>
              </div>
            </Card>
          );
        })}
        <Card title="新增或調整持股">
          <HoldingsEditor />
        </Card>
      </>
    );
  } else if (step === 7) {
    body =
      book.holdings.length === 0 ? (
        <p className="text-sm text-muted">沒有持股，直接下一步。</p>
      ) : (
        <>
          {MARKETS.filter((mk) => book.holdings.some((h) => h.market === mk)).map((mk) => {
            const st = entry.stock[mk];
            const c = l.stocks.market[mk];
            const num = (key: 'cost' | 'sell' | 'buy' | 'fee' | 'rebate' | 'tax', label: string) => (
              <Field label={label} hint={twdHint(mk, st[key])}>
                <NumInput label={`${MARKET_LABEL[mk]} ${label}`} value={st[key]} onChange={setStock(mk, key)} suffix={unit(mk)} />
              </Field>
            );
            const note = (key: 'unrealNote' | 'realNote') => (
              <input aria-label="備註" placeholder="備註（寫個大概就好）" value={st[key] ?? ''} onChange={(e) => setStock(mk, key)(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 placeholder:text-muted" />
            );
            return (
              <Card key={mk} title={`${MARKET_LABEL[mk]}${mk === 'US' ? '（以美元輸入）' : ''}`} className="mb-3">
                <h4 className="text-xs font-semibold text-ink2">未實現損益</h4>
                {num('cost', '目前持股的總付出成本')}
                <p className="text-right text-xs text-ink2">
                  現值 {fmtMoney(c.value[month])}・損益 {fmtSigned(c.pl[month])}・獲利率 {fmtPct(c.plRate[month], 1, true)}
                </p>
                {note('unrealNote')}
                <h4 className="mt-4 text-xs font-semibold text-ink2">本月已實現損益（有賣出才填）</h4>
                {num('sell', '總賣出金額')}
                {num('buy', '賣出部位的總買進金額')}
                <p className="text-right text-xs text-ink2">
                  損益 {fmtSigned(c.realized[month])}・報酬率 {fmtPct(c.realizedRate[month], 1, true)}
                </p>
                {note('realNote')}
                <h4 className="mt-4 text-xs font-semibold text-ink2">本月交易成本</h4>
                {num('fee', '手續費')}
                {num('rebate', '電子折讓（退回）')}
                {num('tax', '證交稅')}
                <p className="text-right text-xs text-ink2">淨成本 台幣 {fmtMoney(c.netCost[month])}</p>
              </Card>
            );
          })}
          <Card title="本月收到的股息">
            <div className="grid grid-cols-[1fr_6.5rem_5.5rem] gap-x-2 text-xs text-muted">
              <span />
              <span className="text-right">現金股利</span>
              <span className="text-right">股票股利（股）</span>
            </div>
            {book.holdings.map((h) => (
              <div key={h.id} className="grid grid-cols-[1fr_6.5rem_5.5rem] items-center gap-x-2 py-1.5">
                <div className="min-w-0 truncate text-sm">
                  {h.name || h.code}
                  {h.market === 'US' && <span className="ml-1 text-xs text-muted">USD</span>}
                </div>
                <NumInput label={`${h.name} 現金股利`} value={entry.cashDiv[h.id]} onChange={setIn('cashDiv', h.id)} />
                <NumInput label={`${h.name} 股票股利`} value={entry.stockDiv[h.id]} onChange={setIn('stockDiv', h.id)} />
              </div>
            ))}
            <p className="mt-1 text-right text-sm">
              現金股利合計 台幣 <span className="tnum font-semibold">{fmtMoney(l.stocks.cashDiv[month])}</span>
            </p>
            <p className="text-right text-xs text-muted">會自動計入收入的「利息/股利」</p>
          </Card>
        </>
      );
  } else {
    const line = (label: string, value: string, strong = false) => (
      <div className={`flex justify-between py-1.5 text-sm ${strong ? 'font-semibold' : 'text-ink2'}`}>
        <span>{label}</span>
        <span className="tnum text-ink">{value}</span>
      </div>
    );
    const prev = month > 0 && l.active[month - 1] ? l.netWorth[month - 1] : null;
    body = (
      <Card title={`${year} 年 ${monthLabel(month)}總結`}>
        {line('資產總計', fmtMoney(l.totals.asset[month]))}
        {data.settings.liabilitiesEnabled && line('負債總計', fmtMoney(l.totals.liability[month]))}
        {line('收入總計', fmtMoney(l.totals.income[month]))}
        {line('支出總計', fmtMoney(l.totals.expense[month]))}
        {line('支出轉資產（投資）', fmtMoney(l.totals.invest[month]))}
        {book.holdings.length > 0 && line('持股總現值', fmtMoney(l.stocks.totalValue[month]))}
        {book.holdings.length > 0 && line('未實現損益', `${fmtSigned(l.stocks.unrealPl[month])}（${fmtPct(l.stocks.unrealRate[month], 1, true)}）`)}
        <div className="my-1 border-t border-line" />
        {line('個人淨值', fmtMoney(l.netWorth[month]), true)}
        {line('較上月', prev === null ? '—' : `${fmtSigned(l.netWorth[month] - prev)}（${fmtPct(prev ? (l.netWorth[month] - prev) / prev : null, 1, true)}）`)}
        {line('儲蓄率', fmtPct(l.totals.income[month] ? (l.totals.income[month] - l.totals.expense[month]) / l.totals.income[month] : null))}
        <p className="mt-3 text-xs text-muted">數字不對可以點上方步驟回去修改。確認後按「完成本月」。</p>
      </Card>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <header className="flex items-center justify-between bg-brand px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 text-white">
        <h1 className="text-base font-semibold">
          填寫 {year} 年 {monthLabel(month)}
        </h1>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm hover:bg-white/10">
          關閉
        </button>
      </header>
      {!done && (
        <nav className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2" aria-label="填寫步驟">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} className={`shrink-0 rounded-full px-3 py-1 text-xs ${i === step ? 'bg-brand text-white' : i < step ? 'bg-sunken text-ink' : 'text-muted'}`}>
              {i + 1}. {s}
            </button>
          ))}
        </nav>
      )}
      <div id="wizard-scroll" className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl p-4">{body}</div>
      </div>
      {!done && (
        <footer className="border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            <Button onClick={() => go(step - 1)} disabled={step === 0}>上一步</Button>
            <span className="flex-1 text-center text-xs text-muted">每一步都會自動儲存</span>
            {step < STEPS.length - 1 ? <Button variant="primary" onClick={() => go(step + 1)}>下一步</Button> : <Button variant="primary" onClick={finish}>{entry.completed ? '儲存' : '完成本月'}</Button>}
          </div>
        </footer>
      )}
    </div>
  );
}

function AddItem({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  if (!open) {
    return (
      <button type="button" className="mt-2 text-sm text-accent" onClick={() => setOpen(true)}>
        ＋ 新增項目
      </button>
    );
  }
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
    setOpen(false);
  };
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="min-w-0 flex-1">
        <TextInput label="新項目名稱" placeholder="項目名稱，例如：停車費" value={name} onChange={setName} />
      </div>
      <Button variant="primary" type="submit">新增</Button>
      <Button onClick={() => setOpen(false)}>取消</Button>
    </form>
  );
}
