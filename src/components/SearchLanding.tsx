import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, Check, Gamepad2, Globe2, Palette, Search, X } from 'lucide-react';
import { AppearanceEditor } from '../landing/AppearanceEditor';
import { DEFAULT_APPEARANCE, parseAppearance, readCachedAppearance, writeAppearance, darkInk, type LandingAppearance } from '../landing/appearance';
import { externalSearch, searchAction, type LandingSearch, type SearchMode } from '../landing/search';
import '../landing/landing.css';

export interface LandingAccount {
  id: string;
  /** Supply only after this identity's settings have loaded. */
  appearance: unknown;
  /** Update only the landing field; reject on failure. Called only on explicit opt-in. */
  saveAppearance?: (value: LandingAppearance) => Promise<void>;
}

export interface SearchLandingProps {
  /** Must enter the normal guarded Games flow, not directly mount a game or unlock the gate. */
  onOpenLibrary: () => void;
  account?: LandingAccount;
  onSearch?: (request: LandingSearch) => void;
  suggestions?: readonly string[];
}

const EXAMPLES = ['weather today', 'weather this weekend', 'time zones', 'time in London', 'world map', 'world clock'];
const letters = Array.from('Geegle');

export function SearchLanding(props: SearchLandingProps) {
  return <LandingSession key={props.account ? 'account:' + props.account.id : 'guest'} {...props}/>;
}

function LandingSession({ account, onSearch, onOpenLibrary, suggestions = EXAMPLES }: SearchLandingProps) {
  const [saved, setSaved] = useState(() => readCachedAppearance(account?.id) ?? parseAppearance(account?.appearance) ?? DEFAULT_APPEARANCE);
  const [draft, setDraft] = useState<LandingAppearance | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const appearance = draft ?? saved;
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(mq.matches);
    update(); mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const dark = appearance.mode === 'system' ? systemDark : appearance.mode === 'dark';
  const background = appearance.color ?? (dark ? '#202124' : '#ffffff');
  const lightInk = appearance.image ? dark : !darkInk(background);
  const style = {
    '--gl-background': background,
    '--gl-image': appearance.image ? `url("${appearance.image}")` : 'none'
  } as CSSProperties;
  const trimmed = query.trim().toLowerCase();
  const options = focused && trimmed ? [...new Set(suggestions.filter(s => s.toLowerCase().startsWith(trimmed) && s.toLowerCase() !== trimmed))].slice(0,5) : [];
  function submit(text: string, mode: SearchMode) {
    const action = searchAction(text, mode);
    setFocused(false); setHighlight(-1);
    if (action.kind === 'empty') { input.current?.focus(); return; }
    if (action.kind === 'surprise') { setMessage('You found the Geegle easter egg!'); return; }
    if (action.kind === 'library') { onOpenLibrary(); return; }
    if (onSearch) onSearch(action.request);
    else window.open(externalSearch(action.request), '_blank', 'noopener,noreferrer');
  }

  async function save(value: LandingAppearance, sync: boolean) {
    try { writeAppearance(value, account?.id); }
    catch { throw new Error('Could not save on this device. Check browser storage or try a smaller background.'); }
    setSaved(value);
    if (sync && account?.saveAppearance) {
      try { await account.saveAppearance(value); }
      catch { throw new Error('Saved on this device, but account sync failed. Retry Save to sync.'); }
    }
    setMessage(sync ? 'Appearance saved on this device and to your account.' : 'Appearance saved on this device.');
  }

  return <div className="gl-page" data-mode={dark ? 'dark' : 'light'} data-ink={lightInk ? 'light' : 'dark'}
    data-custom={Boolean(appearance.color || appearance.image)} data-image={Boolean(appearance.image)} style={style}>
    <header className="gl-bar"><nav aria-label="Search services">
      <span className="gl-web"><Globe2 size={16} aria-hidden="true"/> Web</span>
      <a href="https://images.google.com/" target="_blank" rel="noreferrer">Images<ArrowUpRight size={13} aria-hidden="true"/></a>
    </nav><button className="gl-library" type="button" onClick={onOpenLibrary}><Gamepad2 size={18}/> Games</button></header>
    <main className="gl-main"><div className="gl-center">
      <h1 className="gl-wordmark" aria-label="Geegle">{letters.map((l,i) => <span key={i} aria-hidden="true">{l}</span>)}</h1>
      <form className="gl-form" role="search" aria-label="Web search" onSubmit={e => {e.preventDefault(); submit(options[highlight] ?? query, 'web');}}>
        <div className="gl-field-wrap"><div className="gl-field">
          <Search size={21} aria-hidden="true"/>
          <input ref={input} type="text" inputMode="search" autoComplete="off" spellCheck={false}
            role="combobox" aria-label="Search the web" aria-autocomplete="list" aria-expanded={!!options.length}
            aria-controls={options.length ? listId : undefined} aria-activedescendant={options[highlight] ? listId + '-' + highlight : undefined}
            placeholder="Search the web" value={query} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onChange={e => {setQuery(e.target.value); setFocused(true); setHighlight(-1); setMessage('');}}
            onKeyDown={e => {
              if (e.key === 'Escape') {setFocused(false); setHighlight(-1);}
              if (options.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                e.preventDefault(); setHighlight(i => e.key === 'ArrowDown' ? (i + 1) % options.length : (i <= 0 ? options.length - 1 : i - 1));
              }
            }}/>
          {query && <button className="gl-icon" type="button" aria-label="Clear search" onClick={() => {setQuery(''); setHighlight(-1); input.current?.focus();}}><X size={18}/></button>}
        </div>
        {!!options.length && <ul className="gl-suggestions" id={listId} role="listbox" aria-label="Search suggestions">
          {options.map((s,i) => <li key={s} id={listId+'-'+i} role="option" aria-selected={highlight===i}
            onMouseDown={e => e.preventDefault()} onClick={() => {setQuery(s); submit(s,'web');}}>
            <Search size={15} aria-hidden="true"/>{s}</li>)}
        </ul>}</div>
        <div className="gl-actions"><button type="submit">Geegle Search</button>
          <button type="button" onClick={() => submit(query, 'lucky')}>I'm Feeling Lucky</button></div>
      </form>
      <p className="gl-status" role="status">{message && <><Check size={15}/>{message}</>}</p>
    </div></main>
    <footer className="gl-foot"><span>Web results by Google</span><button type="button" onClick={() => {setDraft(saved);setMessage('');}}>
      <Palette size={16}/> Customize appearance</button></footer>
    {draft && <AppearanceEditor value={draft} canSync={!!account?.saveAppearance} onPreview={setDraft} onClose={() => setDraft(null)} onSave={save}/>}
  </div>;
}
