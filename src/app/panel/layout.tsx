import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AppShell, type NavItem } from '@/components/shell';
import { LogoutButton } from '@/components/logout-button';
import { RealtimeRefresher } from '@/components/realtime-refresher';

/**
 * Estructura del panel de un grupo scout.
 *
 * `RealtimeRefresher` mantiene la vista al día: si el administrador aprueba un
 * pago o otro grupo responde una solicitud intergrupal, la página se actualiza
 * sola. Es la diferencia principal frente al prototipo, atado a un solo equipo.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const context = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [{ count: pendingRequests }, { count: unreadNotifications }] = await Promise.all([
    supabase
      .from('intergroup_requests')
      .select('id', { count: 'exact', head: true })
      .eq('target_group_id', context.group.id)
      .eq('status', 'pending'),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', context.group.id)
      .is('read_at', null),
  ]);

  const nav: NavItem[] = [
    { href: '/panel', icon: '🏠', label: 'Inicio', badge: unreadNotifications ?? 0 },
    { href: '/panel/pais', icon: '🌍', label: 'Escoger país' },
    { href: '/panel/participantes', icon: '👥', label: 'Mis participantes' },
    { href: '/panel/deportes', icon: '🏅', label: 'Deportes' },
    { href: '/panel/equipos', icon: '🤝', label: 'Mis equipos' },
    { href: '/panel/solicitudes', icon: '🔄', label: 'Intergrupales', badge: pendingRequests ?? 0 },
    { href: '/panel/programacion', icon: '🗓️', label: 'Mi programación' },
    { href: '/panel/pagos', icon: '💳', label: 'Pagos' },
    { href: '/panel/stand', icon: '🛍️', label: 'Mi stand' },
    { href: '/panel/resumen', icon: '✅', label: 'Resumen' },
  ];

  return (
    <AppShell
      eventName={settings.event_name}
      subtitle={context.group.code ?? 'Grupo scout'}
      userName={context.group.name}
      userRole={context.profile.full_name || 'Responsable'}
      nav={nav}
      logout={<LogoutButton tone="dark" />}
      sidebarTone="gold"
    >
      <RealtimeRefresher
        groupId={context.group.id}
        tables={['payments', 'intergroup_requests', 'notifications', 'teams', 'groups']}
      />
      {children}
    </AppShell>
  );
}
