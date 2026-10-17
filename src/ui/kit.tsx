import { useEffect, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-sm text-ink2">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight break-all text-ink sm:text-2xl">{value}</div>
      {sub && <div className="mt-1 text-sm text-ink2">{sub}</div>}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-sunken',
  ghost: 'text-accent hover:bg-sunken',
  danger: 'border border-danger text-danger hover:bg-sunken',
};

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-4 text-sm font-medium transition disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-sunken p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`rounded-md px-3 py-1 ${o.value === value ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Banner({ tone = 'warn', children, action }: { tone?: 'warn' | 'info'; children: ReactNode; action?: ReactNode }) {
  const color = tone === 'warn' ? 'bg-warnbg text-warnink' : 'bg-sunken text-ink2';
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm ${color}`} role="status">
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const grouped = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 6 });

/** 接受千分位與加減算式（例如 500+450+780）；空白回傳 undefined，無法辨識回傳 null */
export function parseAmount(text: string): number | undefined | null {
  const t = text.replace(/[,\s，]/g, '').replace(/＋/g, '+').replace(/－/g, '-');
  if (t === '') return undefined;
  if (!/^[+-]?\d*\.?\d+([+-]\d*\.?\d+)*$/.test(t)) return null;
  const terms = t.match(/[+-]?\d*\.?\d+/g) ?? [];
  const total = terms.reduce((s, x) => s + Number(x), 0);
  return Number.isFinite(total) ? Math.round(total * 1e6) / 1e6 : null;
}

export function NumInput({
  value,
  onChange,
  label,
  placeholder = '0',
  suffix,
  disabled,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  label: string;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === undefined ? '' : grouped.format(value));
  const invalid = text !== null && parseAmount(text) === null;
  return (
    <div className="relative">
      <input
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={shown}
        onFocus={(e) => {
          setText(value === undefined ? '' : String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseAmount(e.target.value);
          if (v !== null) onChange(v);
        }}
        onBlur={() => setText(null)}
        className={`tnum h-11 w-full rounded-xl border bg-surface px-3 text-right text-ink outline-none placeholder:text-muted focus:border-accent disabled:bg-sunken disabled:text-ink2 ${invalid ? 'border-danger' : 'border-line'} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export function TextInput({ value, onChange, label, placeholder, className = '' }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string }) {
  return (
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-ink outline-none placeholder:text-muted focus:border-accent ${className}`}
    />
  );
}

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
