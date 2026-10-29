import { createStore } from '@/lib/create-store';
import { listFolder, PDF_FILES, pickFolder, type DeviceFile } from '@/lib/device-files';
import { deleteStored, pickAndStore, storedUrl } from '@/lib/local-files';
import { addPdf, removePdf, updateSettings, userData, type PdfDoc } from '@/lib/user-data';

/** Lets the user pick PDFs and keeps private copies, so they open offline. */
export async function importPdfs() {
  const files = await pickAndStore('pdf');
  for (const f of files) addPdf({ id: f.id, name: f.name, size: f.size, addedAt: Date.now(), uri: f.uri });
  return files.length;
}

export const pdfUrl = (doc: PdfDoc) => storedUrl(doc.uri);

export function deletePdf(doc: PdfDoc) {
  deleteStored(doc.uri);
  removePdf(doc.id);
}

/** PDFs found in the folder the user picked; re-scanned whenever the reader opens. */
const detected = createStore<DeviceFile[]>([]);
export const useDetectedPdfs = detected.use;

export function scanDevicePdfs() {
  const folder = userData.get().settings.pdfFolder;
  detected.set(folder ? listFolder(folder, PDF_FILES) : []);
}

export async function choosePdfFolder() {
  const uri = await pickFolder();
  if (!uri) return;
  updateSettings({ pdfFolder: uri });
  scanDevicePdfs();
}

/** Adds a PDF found on the device to the library (read in place, not copied); returns its id. */
export function openDevicePdf(file: DeviceFile) {
  const existing = userData.get().pdfs.find((p) => p.uri === file.uri);
  if (existing) return existing.id;
  const id = `device-${Date.now()}`;
  addPdf({ id, name: file.name, size: file.size, addedAt: Date.now(), uri: file.uri });
  return id;
}
