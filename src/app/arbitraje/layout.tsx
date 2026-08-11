import { requireReferee, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AppShell, type NavItem } from '@/components/shell';
import { LogoutButton } from '@/components/logout-button';

/**
 * Panel del árbitro.
 *
 * Deliberadamente escueto: dos secciones y nada más. Un árbitro llega al
 * sistema el día del evento, con el celular en la mano y un partido esperando;
 * cualquier cosa de más estorba.
 */
export default async function RefereeLayout({ children }: { children: React.ReactNode }) {
  const context = await requireReferee();
  const settings = await getSettings();
  const supabase = await createClient();

  const { count: pending } = await supabase
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('referee_id', context.userId)
    .eq('result_published', false);

  const nav: NavItem[] = [
    { href: '/arbitraje', icon: '🏠', label: 'Inicio' },
    {
      href: '/arbitraje/competencias',
      icon: '🏁',
      label: 'Mis competencias',
      badge: pending ?? 0,
    },
  ];

  return (
    <AppShell
      eventName={settings.event_name}
      subtitle="Arbitraje"
      userName={context.profile.full_name || 'Árbitro'}
      userRole="Árbitro"
      nav={nav}
      logout={<LogoutButton />}
    >
      {children}
    </AppShell>
  );
}
