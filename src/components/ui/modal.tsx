'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * Modal genérico: fondo oscuro + panel centrado. Se cierra con la X, con
 * clic afuera o con Escape. El contenido lo decide quien lo use — aquí solo
 * se resuelve la mecánica de "ventana encima de todo".
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/60 p-4 py-10 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-[var(--shadow-float)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-lg font-bold text-navy">{title}</h3>}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
