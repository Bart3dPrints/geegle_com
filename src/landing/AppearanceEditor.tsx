import { useEffect, useRef, useState } from 'react';
import { Check, X, Upload } from 'lucide-react';
import { DEFAULT_APPEARANCE, PRESETS, compressBackground, darkInk, type LandingAppearance } from './appearance';

interface Props {
  value: LandingAppearance;
  canSync: boolean;
  onPreview: (value: LandingAppearance) => void;
  onClose: () => void;
  onSave: (value: LandingAppearance, sync: boolean) => Promise<void>;
}

export function AppearanceEditor({ value, canSync, onPreview, onClose, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sync, setSync] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    const el = dialog.current!;
    el.showModal();
    return () => { mounted.current = false; el.close(); };
  }, []);

  async function upload(f: File) {
    setProcessing(true);
    setError('');
    try {
      const image = await compressBackground(f);
      if (mounted.current) onPreview({ ...value, image });
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not read the image.');
    } finally {
      if (mounted.current) setProcessing(false);
    }
  }

  async function apply() {
    setSaving(true);
    setError('');
    try {
      await onSave(value, canSync && sync);
      if (mounted.current) onClose();
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save appearance.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  }

  return <dialog ref={dialog} className="gl-editor" aria-labelledby="gl-editor-title"
    onCancel={e => { e.preventDefault(); if (!saving) onClose(); }}>
    <header><div><small>SEARCH PAGE</small><h2 id="gl-editor-title">Appearance</h2></div>
      <button type="button" className="gl-icon" aria-label="Close appearance" disabled={saving} onClick={onClose}><X size={20}/></button>
    </header>
    <fieldset disabled={processing || saving}><legend>Theme</legend>
      <div className="gl-segments">{(['system','light','dark'] as const).map(mode =>
        <button key={mode} type="button" aria-pressed={value.mode === mode} onClick={() => onPreview({...value, mode})}>{mode}</button>)}</div>
    </fieldset>
    <fieldset disabled={processing || saving}><legend>Background</legend>
      <div className="gl-swatches">{PRESETS.map(({name, color}) => <button type="button" key={name} title={name}
        aria-label={name} aria-pressed={value.color === color && !value.image}
        onClick={() => onPreview({...value, color, image: null})}>
        <span style={{background:color,color:darkInk(color) ? '#121518' : '#fff'}}>{value.color === color && !value.image && <Check size={19}/>}</span>
        {name}</button>)}</div>
      <label className="gl-color">Custom color<input type="color" value={value.color ?? '#ffffff'}
        onChange={e => onPreview({...value,color:e.target.value,image:null})}/></label>
      <input ref={file} type="file" className="gl-hidden" aria-label="Background image" accept="image/jpeg,image/png,image/webp"
        onChange={e => {const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f);}}/>
      {value.image && <img className="gl-background-preview" src={value.image} alt="Selected background preview"/>}
      <div className="gl-controls"><button type="button" className="gl-secondary" onClick={() => file.current?.click()}><Upload size={16}/>{processing ? 'Preparing…' : 'Upload image'}</button>
      {(value.color || value.image) && <button type="button" className="gl-link" onClick={() => onPreview({...value,color:null,image:null})}>Remove background</button>}</div>
      <p className="gl-note">JPEG, PNG or WebP, up to 10 MB. Images are resized before saving.</p>
    </fieldset>
    <p className="gl-note">Changes preview on your search page. Your games theme stays the same.</p>
    {canSync && <label className="gl-check"><input type="checkbox" checked={sync} disabled={saving} onChange={e => setSync(e.target.checked)}/> Also save to my Geegle account</label>}
    {error && <p role="alert" className="gl-error">{error}</p>}
    <footer><button type="button" className="gl-link" disabled={saving || processing} onClick={() => onPreview({...DEFAULT_APPEARANCE})}>Reset to default</button>
      <button type="button" className="gl-primary" disabled={saving || processing} onClick={apply}>{saving ? 'Saving…' : 'Save appearance'}</button></footer>
  </dialog>;
}
