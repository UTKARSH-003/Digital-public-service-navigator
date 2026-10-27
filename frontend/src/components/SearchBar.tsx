import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';

interface Props {
  label: string;
  placeholder?: string;
  buttonLabel: string;
  initial?: string;
  onSubmit: (q: string) => void;
  id?: string;
}

/** Large search field. Submits to the caller (hero → navigates to the directory with ?q=). */
export function SearchBar({ label, placeholder, buttonLabel, initial = '', onSubmit, id = 'site-search' }: Props) {
  const [q, setQ] = useState(initial);
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(q.trim()); };
  return (
    <form role="search" onSubmit={submit} className="w-full max-w-3xl">
      <label htmlFor={id} className="t-label block text-ink">{label}</label>
      <div className="mt-3 flex flex-col border border-dark bg-surface sm:flex-row">
        <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off"
          className="min-h-[56px] flex-1 bg-transparent px-5 text-lg font-medium placeholder:text-grey-strong focus-visible:outline-offset-[-3px]" />
        <button type="submit" className="t-label inline-flex min-h-[56px] items-center justify-center gap-2 bg-dark px-8 text-paper transition-colors duration-fast hover:bg-ink focus-visible:outline-offset-[-6px] focus-visible:outline-paper">
          <Search className="h-4 w-4" aria-hidden />{buttonLabel}
        </button>
      </div>
    </form>
  );
}
