/**
 * Persistence. The whole ledger lives in one AsyncStorage key on the device —
 * there is no server, no account and no analytics anywhere in this app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { createId } from '../lib/id.ts';
import type { AppData } from '../types.ts';
import { deserialize, serialize } from './serialize.ts';

const STORAGE_KEY = 'pocketbook.data.v1';

/**
 * Writes are coalesced: state changes on every keystroke in some screens, and
 * a trailing-edge save keeps that from thrashing the disk.
 */
const SAVE_DEBOUNCE_MS = 250;

export async function loadData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return deserialize(raw, () => createId('cat'));
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, serialize(data));
}

export async function clearData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

let pending: ReturnType<typeof setTimeout> | null = null;
let queued: AppData | null = null;

/** Debounced save. Call freely; the last state within the window wins. */
export function scheduleSave(data: AppData, onError?: (error: unknown) => void): void {
  queued = data;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    const snapshot = queued;
    queued = null;
    if (snapshot) saveData(snapshot).catch((error) => onError?.(error));
  }, SAVE_DEBOUNCE_MS);
}

/** Force any queued write out immediately, e.g. when the app backgrounds. */
export async function flushSave(): Promise<void> {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  const snapshot = queued;
  queued = null;
  if (snapshot) await saveData(snapshot);
}
