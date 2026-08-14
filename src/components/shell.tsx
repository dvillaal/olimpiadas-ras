'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { cn } from '@/lib/utils';
import { displayFont, bodyFont } from '@/lib/fonts';

/**
 * Estructura de la aplicación autenticada: barra lateral, encabezado y área de
 * contenido. En móvil la barra se convierte en un cajón deslizante.
 */

export interface NavItem {
  /** `Route` obliga a que la ruta exista, gracias a `typedRoutes`. */
  href: Route;
  icon: string;
  label: string;
  badge?: number;
}

export function AppShell({
  eventName,
  subtitle,
  userName,
  userRole,
  nav,
  logout,
  children,
  sidebarTone = 'default',
}: {
  eventName: string;
  subtitle: string;
  userName: string;
  userRole: string;
  nav: NavItem[];
  logout: React.ReactNode;
  children: React.ReactNode;
  /** "gold" es la variante dorada exclusiva del panel del jefe de grupo. */
  sidebarTone?: 'default' | 'gold';
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const gold = sidebarTone === 'gold';

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin' && href !== '/panel' && pathname.startsWith(`${href}/`));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      {/* Velo que cierra el menú al tocar fuera, solo en móvil. */}
      {menuOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-navy/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'scrollbar-dark fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-y-auto px-3.5 py-5',
          'transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          gold ? 'bg-gold text-navy' : 'bg-scout-800 text-white',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div
          className={cn(
            'mb-4 flex items-center gap-3 border-b px-2 pb-5',
            gold ? 'border-navy/15' : 'border-white/10',
          )}
        >
          <span
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl bg-white text-xl',
              gold ? 'text-amber-700' : 'text-scout-600',
            )}
          >
            ⚜
          </span>
          <div className="min-w-0">
            <b className="block truncate text-[15px]">{eventName}</b>
            <small className={gold ? 'text-navy/60' : 'text-white/60'}>{subtitle}</small>
          </div>
        </div>

        <p
          className={cn(
            'px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em]',
            gold ? 'text-navy/50' : 'text-white/45',
          )}
        >
          Menú
        </p>

        <nav className="flex flex-1 flex-col gap-0.5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors',
                gold
                  ? isActive(item.href)
                    ? 'bg-navy text-white'
                    : 'text-navy/70 hover:bg-navy/10 hover:text-navy'
                  : isActive(item.href)
                    ? 'bg-white/15 text-white'
                    : 'text-white/75 hover:bg-white/10 hover:text-white',
              )}
            >
              <span aria-hidden className="w-5 text-center text-base">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-black',
                    gold ? 'bg-navy text-white' : 'bg-gold text-navy',
                  )}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className={cn('mt-4 border-t pt-4', gold ? 'border-navy/15' : 'border-white/10')}>
          {logout}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header
          className={cn(
            'sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:px-8',
            gold && 'lg:hidden',
          )}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            className="rounded-lg border border-line px-3 py-2 text-lg leading-none lg:hidden"
          >
            ☰
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2.5">
            <div className="hidden text-right leading-tight sm:block">
              <span className="block text-sm font-bold text-navy">{userName}</span>
              <span className="text-xs text-slate-500">{userRole}</span>
            </div>
            <span
              aria-hidden
              className="grid size-9 place-items-center rounded-full bg-scout-100 font-black text-scout-700"
            >
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        <main
          id="contenido"
          className={cn(
            'min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8',
            gold &&
              cn(
                displayFont.variable,
                bodyFont.variable,
                'bg-navy font-[family-name:var(--font-seravek)]',
              ),
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
