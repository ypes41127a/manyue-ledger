import { useState } from 'react';
import { moveInList, removeHolding, removeItem } from '../core/carry';
import { LAST_DAY } from '../core/ics';
import { newId } from '../core/safe';
import { rateOf } from '../core/stocks';
import type { Item, ItemKind, Market, Section, YearBook } from '../core/types';
import { useStore } from '../db/store';
import { Button, NumInput, TextInput } from './kit';

const select = 'h-11 rounded-xl border border-line bg-surface px-2 text-ink';
const iconBtn = 'size-9 shrink-0 rounded-lg border border-line text-ink2 hover:bg-sunken disabled:opacity-30';

function useBook() {
  const { book, year, update } = useStore();
  const edit = (fn: (b: YearBook) => void) => update((d) => fn(d.years[year]));
  return { book, edit };
}

const DEFAULT_GROUP: Record<Section, string> = { asset: '生活', income: '其他收入', expense: '非計劃', invest: '投資', liability: '負債' };
const AUTO_LABEL: Partial<Record<ItemKind, string>> = { stockTW: '自動：台股市值', stockUS: '自動：美股市值', interestDividend: '自動加上現金股利' };

export function ItemsEditor({ section }: { section: Section }) {
  const { book, edit } = useBook();
  const items = book.items.filter((i) => i.section === section);
  const groups = [...new Set(items.map((i) => i.group))];
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [kind, setKind] = useState<'twd' | 'fx' | 'stockTW' | 'stockUS'>('twd');
  const [currency, setCurrency] = useState(book.currencies[0]?.code ?? '');
  const flow = section === 'income' || section === 'expense' || section === 'invest';
  const patch = (id: string, p: Partial<Item>) => edit((b) => Object.assign(b.items.find((i) => i.id === id)!, p));
  // 只在同一區塊內上下移動
  const move = (id: string, delta: number) =>
    edit((b) => {
      const same = b.items.filter((i) => i.section === section);
      const at = same.findIndex((i) => i.id === id);
      moveInList(same, at, delta);
      let k = 0;
      b.items = b.items.map((i) => (i.section === section ? same[k++] : i));
    });
  const has = (k: ItemKind) => items.some((i) => i.kind === k);

  const add = () => {
    const auto = kind === 'stockTW' || kind === 'stockUS';
    const n = name.trim() || (auto ? (kind === 'stockTW' ? '台股' : '美股') : '');
    if (!n) return;
    const item: Item = { id: newId(section[0]), section, group: group.trim() || (auto ? '股票' : kind === 'fx' ? '外幣' : DEFAULT_GROUP[section]), name: n };
    if (section === 'asset' && kind !== 'twd') item.kind = kind;
    if (item.kind === 'fx') item.currency = currency;
    edit((b) => b.items.push(item));
    setName('');
  };

  return (
    <div className="space-y-2">
      <datalist id={`groups-${section}`}>
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      {items.length === 0 && <p className="text-sm text-muted">還沒有項目</p>}
      {items.map((it, i) => (
        <div key={it.id} className="rounded-xl border border-line p-2">
          <div className="flex items-center gap-2">
            <TextInput label="名稱" value={it.name} onChange={(v) => patch(it.id, { name: v })} />
            <button type="button" className={iconBtn} aria-label="上移" disabled={i === 0} onClick={() => move(it.id, -1)}>↑</button>
            <button type="button" className={iconBtn} aria-label="下移" disabled={i === items.length - 1} onClick={() => move(it.id, 1)}>↓</button>
            <button
              type="button"
              className={`${iconBtn} text-danger`}
              aria-label={`刪除 ${it.name}`}
              onClick={() => window.confirm(`確定刪除「${it.name}」？這個項目今年各月已填的數字也會一併刪除。`) && edit((b) => removeItem(b, it.id))}
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink2">
            <label className="flex items-center gap-1">
              分類
              <input aria-label="分類" list={`groups-${section}`} value={it.group} onChange={(e) => patch(it.id, { group: e.target.value })} className="h-8 w-24 rounded-lg border border-line bg-surface px-2 !text-sm text-ink" />
            </label>
            {it.kind === 'fx' && <span className="rounded bg-sunken px-1.5 py-0.5">外幣 {it.currency}</span>}
            {it.kind && AUTO_LABEL[it.kind] && <span className="rounded bg-sunken px-1.5 py-0.5">{AUTO_LABEL[it.kind]}</span>}
            {flow && !it.kind && (
              <label className="flex items-center gap-1">
                <input type="checkbox" className="size-4" checked={!!it.carry} onChange={(e) => patch(it.id, { carry: e.target.checked })} />
                每月固定（自動帶入上月金額）
              </label>
            )}
            {flow && !it.kind && (
              <label className="flex items-center gap-1">
                <input type="checkbox" className="size-4" checked={!!it.note} onChange={(e) => patch(it.id, { note: e.target.checked })} />
                可填寫備註
              </label>
            )}
          </div>
        </div>
      ))}
      <div className="rounded-xl bg-sunken p-2">
        <div className="mb-1 text-xs text-ink2">新增項目</div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-32 flex-1">
            <TextInput label="新項目名稱" placeholder="名稱，例如：我的銀行" value={name} onChange={setName} />
          </div>
          <input aria-label="新項目分類" list={`groups-${section}`} placeholder="分類" value={group} onChange={(e) => setGroup(e.target.value)} className="h-11 w-24 rounded-xl border border-line bg-surface px-2 text-ink" />
          {section === 'asset' && (
            <select aria-label="帳戶類型" className={select} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="twd">台幣</option>
              {book.currencies.length > 0 && <option value="fx">外幣</option>}
              {!has('stockTW') && <option value="stockTW">台股（自動）</option>}
              {!has('stockUS') && <option value="stockUS">美股（自動）</option>}
            </select>
          )}
          {section === 'asset' && kind === 'fx' && (
            <select aria-label="幣別" className={select} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {book.currencies.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          )}
          <Button variant="primary" onClick={add}>新增</Button>
        </div>
      </div>
    </div>
  );
}

export function HoldingsEditor() {
  const { book, edit } = useBook();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [market, setMarket] = useState<Market>('TW');
  const add = () => {
    if (!code.trim() && !name.trim()) return;
    edit((b) => b.holdings.push({ id: newId('h'), code: code.trim().toUpperCase(), name: name.trim(), market }));
    setCode('');
    setName('');
  };
  return (
    <div className="space-y-2">
      {book.holdings.length === 0 && <p className="text-sm text-muted">還沒有持股。沒有投資股票可以略過。</p>}
      {book.holdings.map((h, i) => (
        <div key={h.id} className="flex items-center gap-2">
          <span className="w-10 shrink-0 rounded bg-sunken py-1 text-center text-xs text-ink2">{h.market === 'TW' ? '台股' : '美股'}</span>
          <TextInput label="代碼" className="!w-24 shrink-0" value={h.code} onChange={(v) => edit((b) => (b.holdings[i].code = v))} />
          <TextInput label="名稱" value={h.name} onChange={(v) => edit((b) => (b.holdings[i].name = v))} />
          <button type="button" className={iconBtn} aria-label="上移" disabled={i === 0} onClick={() => edit((b) => moveInList(b.holdings, i, -1))}>↑</button>
          <button
            type="button"
            className={`${iconBtn} text-danger`}
            aria-label={`刪除 ${h.name}`}
            onClick={() => window.confirm(`確定刪除「${h.code} ${h.name}」？今年各月的股數、收盤價與股息也會一併刪除。已全部賣出的股票建議保留，把股數填 0 即可。`) && edit((b) => removeHolding(b, h.id))}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="rounded-xl bg-sunken p-2">
        <div className="mb-1 text-xs text-ink2">新增持股</div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="市場" className={select} value={market} onChange={(e) => setMarket(e.target.value as Market)}>
            <option value="TW">台股</option>
            <option value="US">美股</option>
          </select>
          <div className="w-24">
            <TextInput label="新持股代碼" placeholder="代碼" value={code} onChange={setCode} />
          </div>
          <div className="min-w-28 flex-1">
            <TextInput label="新持股名稱" placeholder="名稱" value={name} onChange={setName} />
          </div>
          <Button variant="primary" onClick={add}>新增</Button>
        </div>
      </div>
    </div>
  );
}

export function CurrencyEditor() {
  const { book, edit } = useBook();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const inUse = (c: string) => book.items.some((i) => i.currency === c) || (c === 'USD' && book.holdings.some((h) => h.market === 'US'));
  const add = () => {
    const c = code.trim().toUpperCase();
    if (!c || book.currencies.some((x) => x.code === c)) return;
    edit((b) => b.currencies.push({ code: c, name: name.trim() || c }));
    setCode('');
    setName('');
  };
  return (
    <div className="space-y-2">
      {book.currencies.map((c, i) => (
        <div key={c.code} className="flex items-center gap-2">
          <span className="w-12 shrink-0 text-sm font-medium">{c.code}</span>
          <TextInput label="幣別名稱" value={c.name} onChange={(v) => edit((b) => (b.currencies[i].name = v))} />
          <div className="w-28 shrink-0">
            <NumInput label={`${c.name} 年初匯率`} value={book.baseRates[c.code]} onChange={(v) => edit((b) => (v === undefined ? delete b.baseRates[c.code] : (b.baseRates[c.code] = v)))} />
          </div>
          <button
            type="button"
            className={`${iconBtn} text-danger`}
            aria-label={`刪除 ${c.name}`}
            disabled={inUse(c.code)}
            title={inUse(c.code) ? '還有帳戶或美股持股使用這個幣別' : undefined}
            onClick={() => edit((b) => (b.currencies = b.currencies.filter((x) => x.code !== c.code)))}
          >
            ✕
          </button>
        </div>
      ))}
      <p className="text-xs text-muted">匯率為「1 單位外幣 ＝ 多少台幣」。這裡是年初的預設值，每月填寫時可以修改，之後的月份會自動沿用。目前最新：{book.currencies.map((c) => `${c.code} ${rateOf(book, 11, c.code)}`).join('、') || '—'}</p>
      <div className="flex flex-wrap gap-2 rounded-xl bg-sunken p-2">
        <div className="w-24">
          <TextInput label="新幣別代碼" placeholder="EUR" value={code} onChange={setCode} />
        </div>
        <div className="min-w-24 flex-1">
          <TextInput label="新幣別名稱" placeholder="歐元" value={name} onChange={setName} />
        </div>
        <Button variant="primary" onClick={add}>新增幣別</Button>
      </div>
    </div>
  );
}

export function FillDayPicker() {
  const { data, update } = useStore();
  return (
    <label className="flex items-center gap-2 text-sm">
      每月
      <select aria-label="每月填寫日" className={select} value={data.settings.fillDay} onChange={(e) => update((d) => (d.settings.fillDay = Number(e.target.value)))}>
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>{d} 日</option>
        ))}
        <option value={LAST_DAY}>最後一天</option>
      </select>
      填寫
    </label>
  );
}
