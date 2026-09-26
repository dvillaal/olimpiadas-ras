'use client';

import { useEffect, useState } from 'react';
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

const COLLAPSE_KEY = 'sidebar-collapsed';

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
  // Empieza expandido siempre (incluso si había quedado contraído): así el
  // primer render en el servidor y en el cliente coinciden y React no se
  // queja de una discrepancia de hidratación. La preferencia guardada se lee
  // después, en el efecto de abajo, y ahí sí puede contraerse si aplica.
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const gold = sidebarTone === 'gold';

  useEffect(() => {
    // Se lee del almacenamiento local justo después de montar, a propósito
    // (ver comentario arriba de por qué no se hace antes).
    if (window.localStorage.getItem(COLLAPSE_KEY) === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin' && href !== '/panel' && pathname.startsWith(`${href}/`));

  // El texto (nombre del evento, etiquetas del menú, "Cerrar sesión"...) se
  // oculta solo en escritorio y solo cuando está contraído: en móvil el cajón
  // siempre se ve completo, sin importar esta preferencia. `group/sidebar` +
  // `data-collapsed` dejan que hasta `LogoutButton` (que vive en otro
  // archivo) reaccione al estado sin tener que pasarle la prop a mano.
  const hideOnCollapse = 'lg:group-data-[collapsed=true]/sidebar:hidden';

  return (
    <div
      className={cn(
        'min-h-screen',
        collapsed ? 'lg:grid lg:grid-cols-[76px_minmax(0,1fr)]' : 'lg:grid lg:grid-cols-[272px_minmax(0,1fr)]',
      )}
    >
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
        data-collapsed={collapsed}
        className={cn(
          'group/sidebar scrollbar-dark relative fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-y-auto',
          gold ? 'px-0 py-5' : 'px-3.5 py-5',
          'transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          collapsed && 'lg:w-[76px]',
          gold ? 'bg-sidebar text-white' : 'bg-scout-800 text-white',
          gold && cn(displayFont.variable, bodyFont.variable),
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className={cn('relative flex flex-1 flex-col', gold ? 'px-3.5' : '')}>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className={cn(
              'absolute -right-3 top-1 z-10 hidden size-6 items-center justify-center rounded-full border text-xs transition-transform lg:flex',
              gold ? 'border-white/30 bg-sidebar text-white' : 'border-white/20 bg-scout-700 text-white',
              collapsed && 'rotate-180',
            )}
          >
            ‹
          </button>

          {gold ? (
            <div className={cn('mb-4', hideOnCollapse)}>
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
            <div
              className={cn(
                'mb-4 flex items-center gap-3 border-b border-white/10 px-2 pb-5',
                'lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:gap-0 lg:group-data-[collapsed=true]/sidebar:px-0',
              )}
            >
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-white p-1.5">
                <Image src="/login/trofeo.png" alt="" aria-hidden fill className="object-contain p-1.5" />
              </span>
              <div className={cn('min-w-0', hideOnCollapse)}>
                <b className="block truncate text-[15px]">{eventName}</b>
                <small className="text-white/60">{subtitle}</small>
              </div>
            </div>
          )}

          <div className={cn(gold && 'mb-2', hideOnCollapse)}>
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
            {nav.map((item) => {
              // En el sidebar dorado el diseño normal no lleva ícono (son
              // botones de texto), pero contraído no queda nada más que
              // mostrar, así que ahí sí aparece.
              const showIcon = !gold || collapsed;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  title={item.label}
                  className={cn(
                    'relative flex items-center rounded-2xl transition-colors',
                    gold
                      ? cn(
                          'justify-center px-4 py-3.5 text-center text-[15px] font-bold uppercase tracking-wide',
                          'font-[family-name:var(--font-display)]',
                          'lg:group-data-[collapsed=true]/sidebar:px-2',
                          isActive(item.href)
                            ? 'bg-sidebar-button text-white'
                            : 'bg-sidebar-button/40 text-black/40 hover:bg-sidebar-button/70 hover:text-white',
                        )
                      : cn(
                          'gap-3 px-3 py-2.5 text-[14px] font-semibold',
                          'lg:group-data-[collapsed=true]/sidebar:justify-center lg:group-data-[collapsed=true]/sidebar:gap-0 lg:group-data-[collapsed=true]/sidebar:px-0',
                          isActive(item.href)
                            ? 'bg-white/15 text-white'
                            : 'text-white/75 hover:bg-white/10 hover:text-white',
                        ),
                  )}
                >
                  {showIcon && (
                    <span aria-hidden className="w-5 shrink-0 text-center text-base">
                      {item.icon}
                    </span>
                  )}
                  <span className={cn('flex-1', hideOnCollapse)}>{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <>
                      <span
                        className={cn(
                          'rounded-full bg-gold px-2 py-0.5 text-[11px] font-black text-navy',
                          hideOnCollapse,
                        )}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                      {/* En contraído no hay espacio para el número: se resume a un punto sobre el ícono. */}
                      <span
                        aria-hidden
                        className="hidden size-2 rounded-full bg-gold lg:group-data-[collapsed=true]/sidebar:absolute lg:group-data-[collapsed=true]/sidebar:right-1.5 lg:group-data-[collapsed=true]/sidebar:top-1.5 lg:group-data-[collapsed=true]/sidebar:block"
                      />
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-white/10 pt-4">{logout}</div>
        </div>

        {gold && (
          <div className={cn('relative mt-5 h-40 w-full shrink-0 overflow-hidden', hideOnCollapse)}>
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
