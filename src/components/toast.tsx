'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Avisos emergentes.
 *
 * Se anuncian con `aria-live` para que un lector de pantalla los lea sin robar
 * el foco al usuario, algo que el `div` del prototipo no hacía.
 */

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  info: 'bg-navy text-white',
  success: 'bg-scout-700 text-white',
  warning: 'bg-amber-600 text-white',
  error: 'bg-red-700 text-white',
};

const TONE_ICONS: Record<ToastTone, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++;
    setToasts((current) => [...current, { id, message, tone }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:right-6"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => setToasts((current) => current.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    // Los errores duran más: suelen requerir leer y actuar.
    const timeout = window.setTimeout(onDismiss, toast.tone === 'error' ? 7000 : 4000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.tone]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl px-4 py-3',
        'text-sm font-medium shadow-[var(--shadow-float)] animate-in',
        TONE_STYLES[toast.tone],
      )}
    >
      <span aria-hidden className="mt-px font-bold">
        {TONE_ICONS[toast.tone]}
      </span>
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        className="-mr-1 rounded px-1 opacity-70 transition-opacity hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  }
  return context;
}
