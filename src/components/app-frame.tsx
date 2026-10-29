import type { ReactNode } from 'react';

/** On device the app fills the screen; on web it's framed like a phone (`app-frame.web.tsx`). */
export function AppFrame({ children }: { children: ReactNode }) {
  return children;
}
