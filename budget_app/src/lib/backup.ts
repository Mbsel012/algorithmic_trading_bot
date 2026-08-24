/**
 * Backup and restore.
 *
 * The export is a plain JSON (or CSV) file handed to the system share sheet —
 * where it goes from there is entirely the user's choice. Nothing is uploaded.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { createBackup, readBackup, toCSV, type RestoreResult } from '../storage/serialize.ts';
import { createId } from './id.ts';
import { today } from './dates.ts';
import type { AppData } from '../types.ts';

export type ShareResult = { ok: true; uri: string } | { ok: false; error: string };

async function writeAndShare(filename: string, contents: string, mimeType: string): Promise<ShareResult> {
  try {
    const file = new File(Paths.cache, filename);
    // The cache may still hold last export; overwrite rather than fail.
    if (file.exists) file.delete();
    file.create();
    file.write(contents);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename, UTI: 'public.json' });
    }
    return { ok: true, uri: file.uri };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not write the file.' };
  }
}

export function exportBackup(data: AppData): Promise<ShareResult> {
  return writeAndShare(`pocketbook-backup-${today()}.json`, createBackup(data), 'application/json');
}

export function exportCSV(data: AppData): Promise<ShareResult> {
  return writeAndShare(`pocketbook-transactions-${today()}.csv`, toCSV(data), 'text/csv');
}

export type ImportOutcome = RestoreResult | { ok: false; error: 'cancelled' };

/** Pick a backup file and parse it. The caller decides whether to apply it. */
export async function importBackup(): Promise<ImportOutcome> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return { ok: false, error: 'cancelled' };

    const text = await new File(picked.assets[0].uri).text();
    return readBackup(text, () => createId('cat'));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not read that file.' };
  }
}
