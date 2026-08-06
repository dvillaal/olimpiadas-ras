import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/domain/fees';
import { isEditableRegistration } from '@/lib/domain/fees';
import { remainingStandSlots } from '@/lib/domain/eligibility';
import { registrationStatusView } from '@/lib/domain/status';
import { Alert, Badge, LinkButton, PageHeader, Panel, StatusBadge } from '@/components/ui';
import { StandForm } from './stand-form';

export const metadata: Metadata = { title: 'Mi stand' };

export default async function GroupStandPage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [{ data: stand }, { data: allStands }] = await Promise.all([
    supabase.from('stands').select('*').eq('group_id', group.id).maybeSingle(),
    supabase.from('stands').select('id, status, group_id'),
  ]);

  const occupied = (allStands ?? []).filter(
    (s) => s.status === 'confirmed' || s.status === 'payment_pending',
  );
  const available = remainingStandSlots(settings.stand_limit, occupied.length);
  const iOccupy = occupied.some((s) => s.group_id === group.id);
  const editable = !stand || isEditableRegistration(stand.status);

  return (
    <>
      <PageHeader
        title="Mi stand de ventas"
        description={`Valor: ${formatCOP(settings.stand_fee)} · Cupos disponibles: ${available} de ${settings.stand_limit}`}
      />

      {stand && (
        <Panel className="mb-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-navy">{stand.name}</h3>
              <p className="text-sm text-slate-500">Responsable: {stand.responsible}</p>
            </div>
            <StatusBadge status={registrationStatusView(stand.status)} />
          </div>

          <p className="mb-3 text-sm text-slate-600">{stand.products}</p>

          <div className="flex flex-wrap gap-1.5">
            {stand.needs_power && <Badge tone="blue">⚡ Requiere energía</Badge>}
            {stand.needs_furniture && <Badge tone="blue">🪑 Requiere mobiliario</Badge>}
            <Badge tone="gray">{formatCOP(Number(stand.amount))}</Badge>
          </div>

          {stand.admin_note && (
            <Alert tone="warning" title="Observación de la organización" className="mt-3">
              {stand.admin_note}
            </Alert>
          )}

          {stand.status === 'draft' && (
            <Alert tone="info" className="mt-3">
              Tu solicitud está guardada pero aún no has registrado el pago.{' '}
              <LinkButton href="/panel/pagos" size="sm" variant="secondary" className="ml-1">
                Ir a pagos
              </LinkButton>
            </Alert>
          )}
        </Panel>
      )}

      {available === 0 && !iOccupy && !stand && (
        <Alert tone="warning" className="mb-6">
          No quedan cupos disponibles para stands. Si se libera alguno podrás solicitarlo desde
          aquí.
        </Alert>
      )}

      {editable && (available > 0 || iOccupy || Boolean(stand)) && (
        <Panel
          title={stand ? 'Editar solicitud' : 'Solicitar stand'}
          description="Un grupo puede tener un solo stand. Si editas, se actualiza el existente."
        >
          <StandForm
            stand={
              stand
                ? {
                    name: stand.name,
                    responsible: stand.responsible,
                    document: stand.document,
                    phone: stand.phone,
                    email: stand.email ?? '',
                    products: stand.products,
                    description: stand.description,
                    needsPower: stand.needs_power,
                    needsFurniture: stand.needs_furniture,
                    notes: stand.notes,
                  }
                : undefined
            }
          />
        </Panel>
      )}

      {stand && !editable && (
        <Alert tone="info">
          Tu solicitud ya está en revisión o confirmada, así que no admite cambios. Si necesitas
          modificar algo, escribe a la organización.
        </Alert>
      )}
    </>
  );
}
