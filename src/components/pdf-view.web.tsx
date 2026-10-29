import { useEffect, useRef } from 'react';

import { useAccent } from '@/hooks/use-gallery';
import { storedBase64 } from '@/lib/local-files';
import { loadAnnotations, saveAnnotations } from '@/lib/pdf-annotations';
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
      const msg = e.data;
      if (msg.type === 'ready') {
        const base64 = await storedBase64(doc.uri);
        frame.current?.contentWindow?.postMessage(
          { type: 'load', base64, annotations: loadAnnotations(doc.id), page: startPage.current, accent },
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

  return <iframe ref={frame} srcDoc={html} title="PDF" style={{ flex: 1, width: '100%', height: '100%', border: 0 }} />;
}
