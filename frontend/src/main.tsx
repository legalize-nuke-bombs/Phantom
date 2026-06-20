import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import Providers from '@/app/providers';
import { router } from '@/app/router';

// iOS Safari ignores the viewport's user-scalable=no, so block pinch-zoom for real — this is
// a fixed, app-like surface with nothing to zoom. (touch-action: manipulation in index.css
// handles double-tap zoom + the tap delay.)
const preventZoom = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', preventZoom, { passive: false }); // iOS pinch
document.addEventListener('gesturechange', preventZoom, { passive: false });
document.addEventListener(
  'touchmove',
  (e) => {
    if ((e as TouchEvent).touches.length > 1) e.preventDefault(); // multi-finger pinch
  },
  { passive: false },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
