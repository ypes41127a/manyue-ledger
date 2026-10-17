import { useState } from 'react';
import type { ReactNode } from 'react';
import { MONTHS } from '../core/types';
import { monthLabel } from './format';

export interface TRow {
  key: string;
  label: ReactNode;
  /** 12 個月的顯示文字 */
  cells: string[];
  total?: string;
  pct?: string;
  strong?: boolean;
  /** 備註等長文字：允許換行 */
  note?: boolean;
}

export interface TSection {
  key: string;
  /** 區塊標題列，同時顯示該區塊總計；rows 為可收合的明細 */
  head: TRow;
  rows: TRow[];
}

const cell = 'tnum px-2 py-1.5 text-right whitespace-nowrap';
const sticky = 'sticky left-0 z-10 w-32 min-w-32 max-w-32 border-r border-line px-2 py-1.5 text-left sm:w-44 sm:min-w-44 sm:max-w-44';

function Row({ row, tone, toggle, open }: { row: TRow; tone: 'head' | 'body' | 'foot'; toggle?: () => void; open?: boolean }) {
  const bg = tone === 'body' ? 'bg-surface' : 'bg-sunken';
  const weight = tone !== 'body' || row.strong ? 'font-semibold text-ink' : 'text-ink2';
  return (
    <tr className={`border-t border-line ${bg} ${weight}`}>
      <th scope="row" className={`${sticky} ${bg} font-[inherit]`}>
        {toggle ? (
          <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-1 text-left">
            <span className="inline-block w-3 text-muted">{open ? '▾' : '▸'}</span>
            <span className="min-w-0 break-words">{row.label}</span>
          </button>
        ) : (
          <span className={`block break-words ${tone === 'body' ? 'pl-4' : ''}`}>{row.label}</span>
        )}
      </th>
      {MONTHS.map((m) => (
        <td key={m} className={row.note ? 'max-w-28 min-w-28 px-2 py-1.5 text-left text-xs whitespace-pre-wrap' : cell}>
          {row.cells[m]}
        </td>
      ))}
      <td className={`${cell} border-l border-line`}>{row.total ?? ''}</td>
      <td className={cell}>{row.pct ?? ''}</td>
    </tr>
  );
}

export function YearTable({
  sections,
  footer = [],
  totalLabel = '年度總計',
  pctLabel = '%',
  onMonth,
  defaultOpen = false,
}: {
  sections: TSection[];
  footer?: TRow[];
  totalLabel?: string;
  pctLabel?: string;
  onMonth?: (m: number) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => open[k] ?? defaultOpen;
  const allOpen = sections.every((s) => isOpen(s.key));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-muted">
        <span>可左右滑動；點月份可修改該月資料</span>
        <button type="button" className="text-accent" onClick={() => setOpen(Object.fromEntries(sections.map((s) => [s.key, !allOpen])))}>
          {allOpen ? '全部收合' : '全部展開'}
        </button>
      </div>
      <div className="-mx-4 overflow-x-auto border-y border-line sm:mx-0 sm:rounded-xl sm:border">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-sunken text-ink2">
              <th className={`${sticky} bg-sunken font-medium`}>項目</th>
              {MONTHS.map((m) => (
                <th key={m} className="px-2 py-1.5 text-right font-medium">
                  {onMonth ? (
                    <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => onMonth(m)}>
                      {monthLabel(m)}
                    </button>
                  ) : (
                    monthLabel(m)
                  )}
                </th>
              ))}
              <th className="border-l border-line px-2 py-1.5 text-right font-medium">{totalLabel}</th>
              <th className="px-2 py-1.5 text-right font-medium">{pctLabel}</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <SectionRows key={s.key} section={s} open={isOpen(s.key)} toggle={() => setOpen((o) => ({ ...o, [s.key]: !isOpen(s.key) }))} />
            ))}
            {footer.map((r) => (
              <Row key={r.key} row={r} tone="foot" />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({ section, open, toggle }: { section: TSection; open: boolean; toggle: () => void }) {
  return (
    <>
      <Row row={section.head} tone="head" toggle={toggle} open={open} />
      {open && section.rows.map((r) => <Row key={r.key} row={r} tone="body" />)}
    </>
  );
}
