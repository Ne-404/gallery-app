import type { Edit } from '@/lib/edits';
import type { MediaItem } from '@/lib/media';

async function toFile(item: MediaItem) {
  const blob = await (await fetch(item.uri)).blob();
  const extension = item.type === 'video' ? 'mp4' : 'jpg';
  return new File([blob], `${item.id.replace(/[^\w-]/g, '_')}.${extension}`, { type: blob.type });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Browser sharing: the system share sheet with the actual files where supported (phones
 * show Bluetooth, Nearby Share and apps there); otherwise the files are downloaded.
 */
export async function shareItems(items: MediaItem[], _edits?: Record<string, Edit>) {
  try {
    const files = await Promise.all(items.map(toFile));
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, title: 'Gallery' });
      return true;
    }
    files.forEach(download);
    return true;
  } catch (error) {
    // The user closing the share sheet isn't a failure.
    return error instanceof DOMException && error.name === 'AbortError';
  }
}

export const shareItem = (item: MediaItem, _edit?: Edit) => shareItems([item]);

export async function shareFile(uri: string) {
  window.open(uri, '_blank');
  return true;
}
