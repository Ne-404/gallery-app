import { useEffect, useRef } from 'react';

import { useAccent } from '@/hooks/use-gallery';
import { storedBase64, TOO_LARGE } from '@/lib/local-files';
import { loadAnnotations, parseReaderMessage, saveAnnotations } from '@/lib/pdf-annotations';
import { pdfAnnotatorHtml } from '@/lib/pdf-annotator-html';
import { updatePdf, type PdfDoc } from '@/lib/user-data';

const html = pdfAnnotatorHtml();

/** Web version of the annotating PDF reader: the same page, in an iframe. */
export function PdfView({ doc }: { doc: PdfDoc }) {
  const accent = useAccent();
  const frame = useRef<HTMLIFrameElement>(null);
  // Read once: the reader reports page changes back, which update `doc`.
  const startPage = useRef(doc.lastPage ?? 1);

  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const msg = parseReaderMessage(e.data);
      if (!msg) return;
      if (msg.type === 'ready') {
        const bytes = await storedBase64(doc.uri).catch(() => null);
        frame.current?.contentWindow?.postMessage(
          {
            type: 'load',
            base64: bytes === TOO_LARGE ? null : bytes,
            tooLarge: bytes === TOO_LARGE,
            annotations: loadAnnotations(doc.id),
            page: startPage.current,
            accent,
          },
          '*'
        );
      } else if (msg.type === 'annotations') {
        saveAnnotations(doc.id, msg.annotations);
      } else if (msg.type === 'page') {
        updatePdf(doc.id, { lastPage: msg.page });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [doc.id, doc.uri, accent]);

  // Sandboxed: the reader runs in its own opaque origin, so a malicious PDF can't reach the
  // app's localStorage or IndexedDB. Messages still flow through postMessage.
  return (
    <iframe
      ref={frame}
      srcDoc={html}
      title="PDF"
      sandbox="allow-scripts allow-modals"
      style={{ flex: 1, width: '100%', height: '100%', border: 0 }}
    />
  );
}
