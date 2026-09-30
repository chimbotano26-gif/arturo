/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Persistence helper for Serenazgo Nuevo Chimbote
 * Ensures all incident records, titles, and custom data are persistently saved
 * so the user doesn't need to re-enter data upon returning to the app.
 */

import { IncidentRecord } from '../types';

export const STORAGE_KEY_RECORDS = 'serenazgo_nch_records';
export const STORAGE_KEY_IS_CUSTOM = 'serenazgo_nch_is_custom';
export const STORAGE_KEY_LAST_SAVED = 'serenazgo_nch_last_saved';
export const STORAGE_KEY_TITLES = 'serenazgo_dashboard_custom_titles';
export const STORAGE_KEY_VERSION = 'serenazgo_nch_data_version';

export interface SaveResult {
  success: boolean;
  timestamp: string;
  count: number;
  error?: string;
}

export interface BackupPayload {
  version: string;
  appName: string;
  exportDate: string;
  recordsCount: number;
  records: IncidentRecord[];
  titles?: Record<string, string>;
}

/**
 * Format current timestamp for user-facing display (e.g., "15:42 (28/09/2026)")
 */
export function formatSaveTimestamp(date: Date = new Date()): string {
  const time = date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const day = date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${time} • ${day}`;
}

/**
 * Persists all records and configuration to localStorage
 */
export function saveAllDataToStorage(
  records: IncidentRecord[],
  titles?: any
): SaveResult {
  const timestamp = formatSaveTimestamp();
  try {
    localStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
    localStorage.setItem(STORAGE_KEY_IS_CUSTOM, 'true');
    localStorage.setItem(STORAGE_KEY_LAST_SAVED, timestamp);
    localStorage.setItem(STORAGE_KEY_VERSION, '2026_saved');

    if (titles) {
      localStorage.setItem(STORAGE_KEY_TITLES, JSON.stringify(titles));
    }

    return {
      success: true,
      timestamp,
      count: records.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al guardar en memoria local';
    console.error('Error al guardar datos:', error);
    return {
      success: false,
      timestamp,
      count: records.length,
      error: message,
    };
  }
}

/**
 * Loads records from localStorage if previously saved
 */
export function loadSavedRecordsFromStorage(): {
  records: IncidentRecord[] | null;
  lastSaved: string | null;
  isCustom: boolean;
} {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_RECORDS);
    const lastSaved = localStorage.getItem(STORAGE_KEY_LAST_SAVED);
    const isCustom = localStorage.getItem(STORAGE_KEY_IS_CUSTOM) === 'true';

    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          records: parsed,
          lastSaved,
          isCustom,
        };
      }
    }
  } catch (e) {
    console.warn('No se pudieron recuperar datos guardados:', e);
  }

  return {
    records: null,
    lastSaved: null,
    isCustom: false,
  };
}

/**
 * Downloads a complete portable JSON backup file so the user can transfer
 * their data to another computer, browser or device without re-entering data.
 */
export function exportBackupSnapshot(records: IncidentRecord[], titles?: any) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const payload: BackupPayload = {
    version: '1.0',
    appName: 'Serenazgo Nuevo Chimbote - Centro de Control',
    exportDate: now.toISOString(),
    recordsCount: records.length,
    records,
    titles,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Respaldo_Serenazgo_NuevoChimbote_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses a portable JSON backup file
 */
export async function importBackupSnapshot(file: File): Promise<{
  records: IncidentRecord[];
  titles?: Record<string, string>;
  recordsCount: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
          resolve({
            records: parsed.records,
            titles: parsed.titles,
            recordsCount: parsed.records.length,
          });
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          // Direct array fallback
          resolve({
            records: parsed,
            recordsCount: parsed.length,
          });
        } else {
          reject(new Error('El archivo no contiene un respaldo válido de registros.'));
        }
      } catch (err) {
        reject(new Error('Archivo JSON corrupto o con formato no reconocido.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsText(file);
  });
}
