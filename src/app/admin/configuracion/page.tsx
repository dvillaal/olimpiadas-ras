import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDateTime } from '@/lib/utils';
import { EmptyState, PageHeader, Panel } from '@/components/ui';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Configuración' };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [{ data: audit }, { data: emails }] = await Promise.all([
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('email_log').select('*').order('created_at', { ascending: false }).limit(15),
  ]);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Tarifas, cuenta bancaria y límites del evento."
      />

      <div className="mb-6">
        <Panel title="Parámetros del evento">
          <SettingsForm settings={settings} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Bitácora" description="Últimos 30 movimientos del sistema.">
          {(audit ?? []).length === 0 ? (
            <EmptyState icon="📜" title="Sin registros todavía" />
          ) : (
            <ul className="max-h-[420px] space-y-2.5 overflow-y-auto">
              {(audit ?? []).map((entry) => (
                <li key={entry.id} className="border-b border-line/60 pb-2.5 text-sm last:border-0">
                  <p className="text-navy">{entry.action}</p>
                  <p className="text-xs text-slate-500">
                    {entry.actor_name} · {formatDateTime(entry.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Correos enviados"
          description="Útil para confirmar si una notificación salió."
        >
          {(emails ?? []).length === 0 ? (
            <EmptyState icon="📧" title="Todavía no se han enviado correos" />
          ) : (
            <ul className="max-h-[420px] space-y-2.5 overflow-y-auto">
              {(emails ?? []).map((entry) => (
                <li key={entry.id} className="border-b border-line/60 pb-2.5 text-sm last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-navy">{entry.subject}</p>
                    <span
                      className={`shrink-0 text-xs font-bold ${
                        entry.status === 'sent'
                          ? 'text-emerald-700'
                          : entry.status === 'skipped'
                            ? 'text-slate-500'
                            : 'text-red-700'
                      }`}
                    >
                      {entry.status === 'sent'
                        ? 'enviado'
                        : entry.status === 'skipped'
                          ? 'sin configurar'
                          : 'falló'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {entry.to_email} · {formatDateTime(entry.created_at)}
                  </p>
                  {entry.error && <p className="mt-0.5 text-xs text-red-600">{entry.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
