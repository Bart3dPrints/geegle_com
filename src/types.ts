// Shared types for the Geegle platform.

export type ThemePreference = 'light' | 'dark' | 'system';

export type LaunchMode =
  | { kind: 'local'; url: string }
  | { kind: 'external'; url: string; sandbox?: boolean }
  | { kind: 'youtube'; videoId: string };

export interface GameEntry {
  id: string;
  title: string;
  url: string;
  mode: LaunchMode;
  categories: string[];
  aliases?: string[];
  thumb?: string;
  external?: boolean;
  isApp?: boolean;
  hidden?: boolean;
  description?: string;
}

export interface ProxyService {
  id: string;
  name: string;
  endpoints: { label: string; url: string; verified?: boolean }[];
  localUrl?: string;
  isLocal?: boolean;
}

export interface SessionUser {
  id: string;
  username: string;
}

export interface UserSettings {
  theme?: ThemePreference;
  [key: string]: unknown;
}

export interface SyncState {
  status: 'idle' | 'saving' | 'saved' | 'offline' | 'error';
  lastSyncedAt: number | null;
}
