import { useState } from 'react';
import { addItem, groupsOf, moveGroup, moveInList, moveItem, removeHolding, removeItem, renameGroup, setItemGroup } from '../core/carry';
import { LAST_DAY } from '../core/ics';
import { newId } from '../core/safe';
import { rateOf } from '../core/stocks';
import type { Item, ItemKind, Market, Section, YearBook } from '../core/types';
import { useStore } from '../db/store';
import { loadSecurities, searchSecurities } from '../data/securities';
import type { Security, SecurityDb } from '../data/securities';
import { Button, NumInput, TextInput } from './kit';

const select = 'h-11 rounded-xl border border-line bg-surface px-2 text-ink';
const iconBtn = 'size-9 shrink-0 rounded-lg border border-line text-ink2 hover:bg-sunken disabled:opacity-30';

function useBook() {
  const { book, year, update } = useStore();
  const edit = (fn: (b: YearBook) => void) => update((d) => fn(d.years[year]));
  return { book, edit };
}

const AUTO_LABEL: Partial<Record<ItemKind, string>> = { stockTW: '自動帶入台股市值', stockUS: '自動帶入美股市值', interestDividend: '自動加上現金股利' };
const card = 'rounded-xl border border-line';

type AssetKind = 'twd' | 'fx' | 'stockTW' | 'stockUS';

/** 新項目的名稱與類型（資產可選台幣、外幣、台股、美股） */
function NewItemFields({ section, name, setName, kind, setKind, currency, setCurrency, placeholder }: {
  section: Section;
  name: string;
  setName: (v: string) => void;
  kind: AssetKind;
  setKind: (v: AssetKind) => void;
  currency: string;
  setCurrency: (v: string) => void;
  placeholder: string;
}) {
  const { book } = useStore();
  const has = (k: ItemKind) => book.items.some((i) => i.section === 'asset' && i.kind === k);
  const auto = kind === 'stockTW' || kind === 'stockUS';
  return (
    <>
      {!auto && (
        <div className="min-w-32 flex-1">
          <TextInput label="新項目名稱" placeholder={placeholder} value={name} onChange={setName} />
        </div>
      )}
      {section === 'asset' && (
        <select aria-label="帳戶類型" className={select} value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
          <option value="twd">台幣帳戶</option>
          {book.currencies.length > 0 && <option value="fx">外幣帳戶</option>}
          {!has('stockTW') && <option value="stockTW">台股（自動帶入）</option>}
          {!has('stockUS') && <option value="stockUS">美股（自動帶入）</option>}
        </select>
      )}
      {section === 'asset' && kind === 'fx' && (
        <select aria-label="幣別" className={select} value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {book.currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      )}
    </>
  );
}

function useNewItem(section: Section) {
  const { book } = useStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AssetKind>('twd');
  const [currency, setCurrency] = useState(book.currencies[0]?.code ?? '');
  const build = (group: string): Item | null => {
    const auto = kind === 'stockTW' || kind === 'stockUS';
    const n = auto ? (kind === 'stockTW' ? '台股' : '美股') : name.trim();
    if (!n) return null;
    const item: Item = { id: newId(section[0]), section, group, name: n };
    if (section === 'asset' && kind !== 'twd') item.kind = kind;
    if (item.kind === 'fx') item.currency = currency;
    return item;
  };
  const reset = () => {
    setName('');
    setKind('twd');
  };
  return { fields: { section, name, setName, kind, setKind, currency, setCurrency }, build, reset };
}

function AddItem({ section, group }: { section: Section; group: string }) {
  const { edit } = useBook();
  const [open, setOpen] = useState(false);
  const n = useNewItem(section);
  if (!open) {
    return (
      <button type="button" className="mt-1 px-1 py-2 text-sm text-accent" onClick={() => setOpen(true)}>
        ＋ 新增項目到「{group}」
      </button>
    );
  }
  const submit = () => {
    const item = n.build(group);
    if (!item) return;
    edit((b) => addItem(b, item));
    n.reset();
    setOpen(false);
  };
  return (
    <form className="mt-2 flex flex-wrap gap-2 rounded-xl bg-sunken p-2" onSubmit={(e) => (e.preventDefault(), submit())}>
      <NewItemFields {...n.fields} placeholder={section === 'asset' ? '名稱，例如：我的銀行' : '名稱'} />
      <Button variant="primary" type="submit">新增</Button>
      <Button onClick={() => setOpen(false)}>取消</Button>
    </form>
  );
}

function ItemRow({ item, groups, first, last }: { item: Item; groups: string[]; first: boolean; last: boolean }) {
  const { edit } = useBook();
  const [open, setOpen] = useState(false);
  const flow = item.section === 'income' || item.section === 'expense' || item.section === 'invest';
  const patch = (p: Partial<Item>) => edit((b) => Object.assign(b.items.find((i) => i.id === item.id)!, p));
  const tags = [item.kind === 'fx' ? `外幣 ${item.currency}` : '', item.kind ? AUTO_LABEL[item.kind] ?? '' : '', item.carry ? '每月固定' : '', item.note ? '可填備註' : ''].filter(Boolean);
  return (
    <div className="border-t border-line py-2 first:border-t-0">
      <div className="flex items-center gap-1.5">
        <TextInput label="名稱" value={item.name} onChange={(v) => patch({ name: v })} />
        <button type="button" className={iconBtn} aria-label={`上移 ${item.name}`} disabled={first} onClick={() => edit((b) => moveItem(b, item.id, -1))}>↑</button>
        <button type="button" className={iconBtn} aria-label={`下移 ${item.name}`} disabled={last} onClick={() => edit((b) => moveItem(b, item.id, 1))}>↓</button>
        <button type="button" className={`${iconBtn} ${open ? 'bg-sunken' : ''}`} aria-label={`${item.name} 更多設定`} aria-expanded={open} onClick={() => setOpen(!open)}>⋯</button>
      </div>
      {tags.length > 0 && !open && <div className="mt-1 flex flex-wrap gap-1 text-xs text-ink2">{tags.map((t) => <span key={t} className="rounded bg-sunken px-1.5 py-0.5">{t}</span>)}</div>}
      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-sunken p-3 text-sm">
          {groups.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="text-ink2">移到分類</span>
              <select aria-label={`${item.name} 移到分類`} className={select} value={item.group} onChange={(e) => edit((b) => setItemGroup(b, item.id, e.target.value))}>
                {groups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          )}
          {item.kind && AUTO_LABEL[item.kind] && <p className="text-ink2">{item.kind === 'interestDividend' ? '填寫時輸入銀行利息，會自動加上股票分頁的現金股利。' : '由股票分頁的持股股數 × 收盤價自動計算，不需要手動填寫。'}</p>}
          {item.kind === 'fx' && <p className="text-ink2">填寫時輸入 {item.currency} 原幣金額，依當月匯率換算台幣。</p>}
          {flow && !item.kind && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-5" checked={!!item.carry} onChange={(e) => patch({ carry: e.target.checked })} />
                每月固定（填寫時自動帶入上個月金額）
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-5" checked={!!item.note} onChange={(e) => patch({ note: e.target.checked })} />
                可填寫備註
              </label>
            </>
          )}
          <Button
            variant="danger"
            onClick={() => window.confirm(`確定刪除「${item.name}」？這個項目今年各月已填的數字也會一併刪除。`) && edit((b) => removeItem(b, item.id))}
          >
            刪除這個項目
          </Button>
        </div>
      )}
    </div>
  );
}

function GroupCard({ section, group, groups, index }: { section: Section; group: string; groups: string[]; index: number }) {
  const { book, edit } = useBook();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(group);
  const items = book.items.filter((i) => i.section === section && i.group === group);
  const save = () => {
    const to = draft.trim();
    if (to && to !== group) {
      if (groups.includes(to) && !window.confirm(`已經有「${to}」分類，要把「${group}」的項目併入嗎？`)) return;
      edit((b) => renameGroup(b, section, group, to));
    }
    setRenaming(false);
  };
  return (
    <section className={`${card} px-3 pt-2 pb-1`}>
      <div className="flex items-center gap-1.5 pb-1">
        {renaming ? (
          <form className="flex flex-1 gap-1.5" onSubmit={(e) => (e.preventDefault(), save())}>
            <TextInput label="分類名稱" value={draft} onChange={setDraft} />
            <Button variant="primary" type="submit">儲存</Button>
            <Button onClick={() => (setDraft(group), setRenaming(false))}>取消</Button>
          </form>
        ) : (
          <>
            <h3 className="min-w-0 flex-1 truncate font-semibold">
              {group}
              <span className="ml-2 text-xs font-normal text-muted">{items.length} 個項目</span>
            </h3>
            <button type="button" className={iconBtn} aria-label={`分類「${group}」改名`} onClick={() => (setDraft(group), setRenaming(true))}>✎</button>
            <button type="button" className={iconBtn} aria-label={`分類「${group}」上移`} disabled={index === 0} onClick={() => edit((b) => moveGroup(b, section, group, -1))}>↑</button>
            <button type="button" className={iconBtn} aria-label={`分類「${group}」下移`} disabled={index === groups.length - 1} onClick={() => edit((b) => moveGroup(b, section, group, 1))}>↓</button>
          </>
        )}
      </div>
      {items.map((it, k) => (
        <ItemRow key={it.id} item={it} groups={groups} first={k === 0} last={k === items.length - 1} />
      ))}
      <AddItem section={section} group={group} />
    </section>
  );
}

function AddGroup({ section, groups }: { section: Section; groups: string[] }) {
  const { edit } = useBook();
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState('');
  const n = useNewItem(section);
  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        ＋ 新增分類
      </Button>
    );
  }
  const submit = () => {
    const g = group.trim();
    if (!g) return;
    const item = n.build(g);
    if (!item) return;
    edit((b) => addItem(b, item));
    setGroup('');
    n.reset();
    setOpen(false);
  };
  return (
    <form className={`${card} space-y-2 p-3`} onSubmit={(e) => (e.preventDefault(), submit())}>
      <div className="text-sm font-semibold">新增分類</div>
      <TextInput label="分類名稱" placeholder={section === 'asset' ? '分類名稱，例如：定存' : '分類名稱'} value={group} onChange={setGroup} />
      {groups.includes(group.trim()) && <p className="text-xs text-warnink">已經有「{group.trim()}」分類，新項目會加進該分類。</p>}
      <div className="text-xs text-ink2">分類裡的第一個項目</div>
      <div className="flex flex-wrap gap-2">
        <NewItemFields {...n.fields} placeholder="項目名稱" />
      </div>
      <div className="flex gap-2">
        <Button variant="primary" type="submit">新增</Button>
        <Button onClick={() => setOpen(false)}>取消</Button>
      </div>
    </form>
  );
}

export function ItemsEditor({ section }: { section: Section }) {
  const { book } = useStore();
  const groups = groupsOf(book, section);
  return (
    <div className="space-y-3">
      {groups.length === 0 && <p className="text-sm text-muted">還沒有項目</p>}
      {groups.map((g, i) => (
        <GroupCard key={g} section={section} group={g} groups={groups} index={i} />
      ))}
      <AddGroup section={section} groups={groups} />
    </div>
  );
}

/** 輸入名稱或代碼搜尋股票，點選結果就加入持股；找不到時可以手動輸入 */
function AddHolding() {
  const { book, edit } = useBook();
  const [query, setQuery] = useState('');
  const [db, setDb] = useState<SecurityDb | null>(null);
  const [dbError, setDbError] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [market, setMarket] = useState<Market>('TW');
  const [notice, setNotice] = useState<string | null>(null);

  const ensureDb = () => {
    if (db || dbError) return;
    loadSecurities().then(setDb, () => setDbError(true));
  };
  const results = db ? searchSecurities(db, query) : [];
  const exists = (c: string, mk: Market) => book.holdings.some((h) => h.code.toUpperCase() === c.toUpperCase() && h.market === mk);
  const addHolding = (c: string, n: string, mk: Market) => {
    if (exists(c, mk)) return setNotice(`${c} ${n} 已經在持股中`);
    edit((b) => b.holdings.push({ id: newId('h'), code: c.toUpperCase(), name: n, market: mk }));
    setNotice(`已新增 ${c.toUpperCase()} ${n}`);
    setQuery('');
    setCode('');
    setName('');
  };
  const pick = (s: Security) => addHolding(s.code, s.alias && s.market === 'US' ? s.alias.replace(/（.*）/, '') : s.name, s.market);

  return (
    <div className="rounded-xl bg-sunken p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-ink2">
        <span>新增持股</span>
        <button type="button" className="text-accent" onClick={() => (setManual(!manual), setNotice(null))}>
          {manual ? '改用搜尋' : '找不到？手動輸入'}
        </button>
      </div>
      {!manual ? (
        <>
          <TextInput
            label="搜尋股票名稱或代碼"
            placeholder="輸入名稱或代碼，例如：台積電、0050、AAPL、蘋果"
            value={query}
            onChange={(v) => (setQuery(v), setNotice(null), ensureDb())}
          />
          {query.trim() !== '' && (
            <ul className="mt-1 overflow-hidden rounded-xl border border-line bg-surface">
              {!db && !dbError && <li className="px-3 py-2 text-sm text-muted">載入股票清單中…</li>}
              {dbError && <li className="px-3 py-2 text-sm text-warnink">無法載入股票清單，請確認網路連線，或改用手動輸入。</li>}
              {db && results.length === 0 && <li className="px-3 py-2 text-sm text-muted">找不到相符的股票，可以改用手動輸入。</li>}
              {results.map((s) => (
                <li key={`${s.market}-${s.code}`} className="border-t border-line first:border-t-0">
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-sunken" onClick={() => pick(s)}>
                    <span className="w-16 shrink-0 font-medium tnum">{s.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {s.market === 'US' && s.alias ? `${s.alias}・` : ''}
                      {s.name}
                    </span>
                    <span className="shrink-0 rounded bg-sunken px-1.5 py-0.5 text-xs text-ink2">{s.market === 'TW' ? '台股' : '美股'}</span>
                    {exists(s.code, s.market) && <span className="shrink-0 text-xs text-muted">已加入</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {db && <p className="mt-1 text-xs text-muted">點選搜尋結果即加入持股。股票清單更新於 {db.updatedAt}。</p>}
        </>
      ) : (
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
          <Button variant="primary" onClick={() => (code.trim() || name.trim()) && addHolding(code.trim(), name.trim(), market)}>新增</Button>
        </div>
      )}
      {notice && <p className="mt-1 text-sm text-ink2" role="status">{notice}</p>}
    </div>
  );
}

export function HoldingsEditor() {
  const { book, edit } = useBook();
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
      <AddHolding />
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
