/** Browsers can't browse the device's files, so only imported files are shown on web. */
export const canScanDevice = false;

export type DeviceFile = { name: string; uri: string; size: number };

export async function scanAudioLibrary(): Promise<DeviceFile[]> {
  return [];
}

export async function pickFolder(): Promise<string | null> {
  return null;
}

export function listFolder(_folderUri: string, _pattern: RegExp, _depth = 3): DeviceFile[] {
  return [];
}

export const AUDIO_FILES = /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i;
export const PDF_FILES = /\.pdf$/i;
