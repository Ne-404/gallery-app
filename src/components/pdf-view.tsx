import { useRef, type ComponentRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useAccent } from '@/hooks/use-gallery';
import { storedBase64, TOO_LARGE } from '@/lib/local-files';
import { loadAnnotations, parseReaderMessage, saveAnnotations } from '@/lib/pdf-annotations';
import { pdfAnnotatorHtml } from '@/lib/pdf-annotator-html';
import { updatePdf, type PdfDoc } from '@/lib/user-data';

const html = pdfAnnotatorHtml();

/**
 * PDF reader with pencil, marker, eraser and a page tracker. Pages are drawn by pdf.js in a
 * WebView (which also makes PDFs readable on Android, whose WebView has no PDF viewer).
 */
export function PdfView({ doc }: { doc: PdfDoc }) {
  const accent = useAccent();
  const web = useRef<ComponentRef<typeof WebView>>(null);

  const onMessage = async (e: WebViewMessageEvent) => {
    const msg = parseReaderMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'ready') {
      // Null when the file is missing or too large; the reader then explains instead of crashing.
      const bytes = await storedBase64(doc.uri).catch(() => null);
      const payload = {
        type: 'load',
        base64: bytes === TOO_LARGE ? null : bytes,
        tooLarge: bytes === TOO_LARGE,
        annotations: loadAnnotations(doc.id),
        page: doc.lastPage ?? 1,
        accent,
      };
      web.current?.injectJavaScript(`window.receive(${JSON.stringify(payload)}); true;`);
    } else if (msg.type === 'annotations') {
      saveAnnotations(doc.id, msg.annotations);
    } else if (msg.type === 'page') {
      updatePdf(doc.id, { lastPage: msg.page });
    }
  };

  return (
    <WebView
      ref={web}
      source={{ html, baseUrl: 'https://localhost/' }}
      originWhitelist={['*']}
      onMessage={onMessage}
      javaScriptEnabled
      // The reader is a single local page: never let a document navigate it elsewhere.
      onShouldStartLoadWithRequest={(request) => request.url.startsWith('https://localhost') || request.url === 'about:blank'}
      setSupportMultipleWindows={false}
      style={styles.web}
    />
  );
}

const styles = StyleSheet.create({
  web: {
    flex: 1,
    backgroundColor: '#2b2b2f',
  },
});
