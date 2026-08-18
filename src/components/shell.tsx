'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  /** "gold" es la variante exclusiva del panel del jefe de grupo (fondo navy con acentos dorados). */
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
          'scrollbar-dark relative fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-y-auto',
          gold ? 'px-0 py-5' : 'px-3.5 py-5',
          'transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          gold ? 'bg-sidebar text-white' : 'bg-scout-800 text-white',
          gold && cn(displayFont.variable, bodyFont.variable),
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={cn('relative flex flex-1 flex-col', gold ? 'px-3.5' : '')}>
          {gold ? (
            <div className="mb-4">
              <span className="relative block h-28 w-full border-2 border-white bg-transparent">
                <Image
                  src="/home/logo-olimpiadas.png"
                  alt="Olimpiadas Scout RAS 2026"
                  fill
                  className="object-contain"
                  priority
                />
              </span>
              <div className="mt-3 min-w-0 text-center">
                <b className="block truncate text-[15px] font-[family-name:var(--font-seravek)] font-bold text-white">
                  {eventName}
                </b>
                <small className="font-[family-name:var(--font-seravek)] text-white/60">
                  {subtitle}
                </small>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-3 border-b border-white/10 px-2 pb-5">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-white p-1.5">
                <Image src="/login/trofeo.png" alt="" aria-hidden fill className="object-contain p-1.5" />
              </span>
              <div className="min-w-0">
                <b className="block truncate text-[15px]">{eventName}</b>
                <small className="text-white/60">{subtitle}</small>
              </div>
            </div>
          )}

          <div className={cn(gold && 'mb-2')}>
            <p
              className={cn(
                'px-3 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-white/45',
                gold &&
                  'text-center font-[family-name:var(--font-display)] text-[13px] tracking-[0.2em] text-white',
              )}
            >
              Menú
            </p>
            {gold && <div className="mx-3 border-t border-white/30" />}
          </div>

          <nav className="flex flex-1 flex-col gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'flex items-center rounded-2xl transition-colors',
                  gold
                    ? cn(
                        'justify-center px-4 py-3.5 text-center text-[15px] font-bold uppercase tracking-wide',
                        'font-[family-name:var(--font-display)]',
                        isActive(item.href)
                          ? 'bg-sidebar-button text-white'
                          : 'bg-sidebar-button/40 text-black/60 hover:bg-sidebar-button/70 hover:text-white',
                      )
                    : cn(
                        'gap-3 px-3 py-2.5 text-[14px] font-semibold',
                        isActive(item.href)
                          ? 'bg-white/15 text-white'
                          : 'text-white/75 hover:bg-white/10 hover:text-white',
                      ),
                )}
              >
                {!gold && (
                  <span aria-hidden className="w-5 text-center text-base">
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-black text-navy">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-white/10 pt-4">{logout}</div>
        </div>

        {gold && (
          <div className="relative mt-5 h-40 w-full shrink-0 overflow-hidden">
            <Image
              src="/home/fondo-logos.png"
              alt=""
              aria-hidden
              fill
              sizes="272px"
              className="object-cover object-top"
            />
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header
          className={cn(
            'sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur lg:px-8',
            gold ? 'border-white/10 bg-sidebar/95 lg:hidden' : 'border-line bg-white/90',
          )}
        >
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            className={cn(
              'rounded-lg border px-3 py-2 text-lg leading-none lg:hidden',
              gold ? 'border-white/25 text-white' : 'border-line',
            )}
          >
            ☰
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2.5">
            <div className="hidden text-right leading-tight sm:block">
              <span className={cn('block text-sm font-bold', gold ? 'text-white' : 'text-navy')}>
                {userName}
              </span>
              <span className={cn('text-xs', gold ? 'text-white/60' : 'text-slate-500')}>{userRole}</span>
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
