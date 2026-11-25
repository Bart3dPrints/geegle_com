import { parseAppearance, type LandingAppearance } from './appearance';

export interface AppearanceRow { appearance: unknown; revision: string }

export interface AppearanceTransport {
  session(): Promise<{ id: string; token: string } | null>;
  read(id: string, token: string, signal: AbortSignal): Promise<AppearanceRow | null>;
  write(id: string, token: string, signal: AbortSignal, revision: string | null, value: LandingAppearance): Promise<AppearanceRow | null>;
}

export function accountAppearanceSync(id: string, transport: AppearanceTransport) {
  const controller = new AbortController();
  let revision: string | null | undefined;
  let loading = false;
  let saving = false;
  const assertActive = () => {
    if (controller.signal.aborted) throw new Error('This Geegle account is no longer active.');
  };
  async function token() {
    assertActive();
    const session = await transport.session();
    assertActive();
    if (!session || session.id !== id) throw new Error('The active Geegle account changed.');
    return session.token;
  }
  function accept(row: AppearanceRow | null): LandingAppearance | null {
    const value = parseAppearance(row?.appearance);
    if (row && (!value || !row.revision)) throw new Error('The account appearance could not be read.');
    revision = row?.revision ?? null;
    return value;
  }
  return {
    dispose: () => controller.abort(),
    async load() {
      if (loading || saving) throw new Error('Another appearance request is pending.');
      loading = true;
      revision = undefined;
      try {
        const bearer = await token();
        const row = await transport.read(id, bearer, controller.signal);
        assertActive();
        return accept(row);
      } finally { loading = false; }
    },
    async save(value: LandingAppearance) {
      if (loading || saving || revision === undefined) throw new Error('Reload account appearance before syncing.');
      const clean = parseAppearance(value);
      if (!clean) throw new Error('Invalid appearance.');
      saving = true;
      try {
        const bearer = await token();
        const row = await transport.write(id, bearer, controller.signal, revision, clean);
        assertActive();
        if (!row) throw new Error('Account appearance has changed. Reload it before deciding whether to sync this device.');
        accept(row);
      } catch (error) {
        // A lost response can also mean the server committed. Read again before retry.
        revision = undefined;
        throw error;
      } finally { saving = false; }
    },
  };
}
