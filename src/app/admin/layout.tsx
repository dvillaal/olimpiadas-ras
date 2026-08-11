import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AppShell, type NavItem } from '@/components/shell';
import { LogoutButton } from '@/components/logout-button';

/**
 * Estructura del panel administrativo.
 *
 * Los contadores del menú (solicitudes y pagos por revisar) se calculan aquí
 * con consultas de solo conteo: no traen filas, solo el número.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [
    { count: pendingGroups },
    { count: pendingPayments },
    { count: pendingStands },
    { count: pendingAlliances },
  ] = await Promise.all([
    supabase.from('groups').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .in('status', ['sent', 'correction']),
    supabase
      .from('stands')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'payment_pending'),
    // Alianzas esperando el visto bueno de la organización: sin él, el equipo
    // no puede pagar, así que conviene que salte a la vista en el menú.
    supabase
      .from('intergroup_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'admin_review'),
  ]);

  const nav: NavItem[] = [
    { href: '/admin', icon: '🏠', label: 'Inicio' },
    { href: '/admin/solicitudes', icon: '📨', label: 'Solicitudes', badge: pendingGroups ?? 0 },
    { href: '/admin/grupos', icon: '🧭', label: 'Grupos' },
    { href: '/admin/participantes', icon: '👥', label: 'Participantes' },
    { href: '/admin/paises', icon: '🌍', label: 'Países' },
    { href: '/admin/ramas', icon: '🌿', label: 'Ramas' },
    { href: '/admin/deportes', icon: '🏅', label: 'Deportes' },
    { href: '/admin/equipos', icon: '🤝', label: 'Equipos' },
    {
      href: '/admin/intergrupales',
      icon: '🔄',
      label: 'Intergrupales',
      badge: pendingAlliances ?? 0,
    },
    { href: '/admin/arbitros', icon: '🧑‍⚖️', label: 'Árbitros' },
    { href: '/admin/programacion', icon: '🗓️', label: 'Programación' },
    { href: '/admin/pagos', icon: '💳', label: 'Pagos', badge: pendingPayments ?? 0 },
    { href: '/admin/stands', icon: '🛍️', label: 'Stands', badge: pendingStands ?? 0 },
    { href: '/admin/reportes', icon: '📊', label: 'Reportes' },
    { href: '/admin/configuracion', icon: '⚙️', label: 'Configuración' },
  ];

  return (
    <AppShell
      eventName={settings.event_name}
      subtitle="Administración"
      userName={context.profile.full_name || 'Administrador'}
      userRole="Administrador general"
      nav={nav}
      logout={<LogoutButton />}
    >
      {children}
    </AppShell>
  );
}
