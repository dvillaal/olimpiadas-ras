import type { Metadata } from 'next';
import { requireAdmin, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/domain/fees';
import { remainingStandSlots } from '@/lib/domain/eligibility';
import { registrationStatusView } from '@/lib/domain/status';
import { Alert, Badge, EmptyState, PageHeader, Panel, StatCard, StatusBadge } from '@/components/ui';

export const metadata: Metadata = { title: 'Stands' };

export default async function AdminStandsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const supabase = await createClient();

  const [{ data: stands }, { data: groups }] = await Promise.all([
    supabase.from('stands').select('*').order('created_at'),
    supabase.from('groups').select('id, name, code'),
  ]);

  const rows = stands ?? [];
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

  const confirmed = rows.filter((s) => s.status === 'confirmed');
  // Un stand con pago en curso ya ocupa cupo: así no se sobrevende el espacio.
  const occupied = rows.filter((s) => s.status === 'confirmed' || s.status === 'payment_pending');
  const available = remainingStandSlots(settings.stand_limit, occupied.length);

  return (
    <>
      <PageHeader
        title="Stands de ventas"
        description={`Valor por stand: ${formatCOP(settings.stand_fee)} · Cupo máximo: ${settings.stand_limit}`}
      />

      {available === 0 && (
        <Alert tone="warning" className="mb-5">
          No quedan cupos disponibles. Los grupos no podrán registrar stands nuevos hasta que se
          libere alguno o amplíes el límite en Configuración.
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard icon="🛍️" value={rows.length} label="Solicitudes" />
        <StatCard icon="✅" value={confirmed.length} label="Confirmados" tone="success" />
        <StatCard icon="⏳" value={occupied.length - confirmed.length} label="Con pago en curso" />
        <StatCard
          icon="📍"
          value={available}
          label="Cupos disponibles"
          tone={available === 0 ? 'danger' : 'default'}
        />
      </div>

      <Panel title="Solicitudes de stand">
        {rows.length === 0 ? (
          <EmptyState icon="🛍️" title="Ningún grupo ha solicitado stand todavía" />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {rows.map((stand) => (
              <li key={stand.id} className="rounded-2xl border border-line p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-navy">{stand.name}</h4>
                    <p className="text-sm text-slate-500">
                      {groupById.get(stand.group_id)?.name}
                    </p>
                  </div>
                  <StatusBadge status={registrationStatusView(stand.status)} />
                </div>

                <dl className="mb-3 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-semibold text-slate-500">Responsable:</dt>
                    <dd>{stand.responsible}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold text-slate-500">Contacto:</dt>
                    <dd>{stand.phone || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-semibold text-slate-500">Productos:</dt>
                    <dd className="min-w-0">{stand.products}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-1.5">
                  {stand.needs_power && <Badge tone="blue">⚡ Requiere energía</Badge>}
                  {stand.needs_furniture && <Badge tone="blue">🪑 Requiere mobiliario</Badge>}
                  <Badge tone="gray">{formatCOP(Number(stand.amount))}</Badge>
                </div>

                {stand.admin_note && (
                  <p className="mt-3 rounded-lg bg-canvas p-2 text-xs text-slate-600">
                    {stand.admin_note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
