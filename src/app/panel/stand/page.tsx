import type { Metadata } from 'next';
import { requireGroup, getSettings } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/domain/fees';
import { isEditableRegistration } from '@/lib/domain/fees';
import { remainingStandSlots } from '@/lib/domain/eligibility';
import { registrationStatusView } from '@/lib/domain/status';
import { Alert, Badge, Button, LinkButton, StatusBadge } from '@/components/ui';
import { cardTitleClass } from '@/lib/fonts';
import { deleteStandAction } from '../actions';
import { EditStandToggle } from './edit-stand-toggle';
import { NewStandToggle } from './new-stand-toggle';

export const metadata: Metadata = { title: 'Mis stands' };

export default async function GroupStandPage() {
  const { group } = await requireGroup();
  const settings = await getSettings();
  const supabase = await createClient();

  const [{ data: myStands }, { data: allStands }] = await Promise.all([
    supabase
      .from('stands')
      .select('*')
      .eq('group_id', group.id)
      .order('created_at', { ascending: false }),
    supabase.from('stands').select('id, status, group_id'),
  ]);

  const occupied = (allStands ?? []).filter(
    (s) => s.status === 'confirmed' || s.status === 'payment_pending',
  );
  const available = remainingStandSlots(settings.stand_limit, occupied.length);
  const stands = myStands ?? [];

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <h1 className={cardTitleClass}>Mis stands de ventas</h1>
        <p className="mt-1 text-sm text-white/75">
          Valor por stand: {formatCOP(settings.stand_fee)} · Cupos disponibles: {available} de{' '}
          {settings.stand_limit}
        </p>
      </section>

      {stands.length === 0 ? (
        <section className="rounded-3xl bg-scout-600 p-6 text-center text-white">
          <span className="mb-2 block text-3xl" aria-hidden>
            🛍️
          </span>
          <p className="font-semibold text-white">Todavía no tienes stands</p>
          <p className="mt-1 text-sm text-white/75">
            Un grupo puede solicitar más de un stand. Cada uno se paga y se revisa por separado.
          </p>
        </section>
      ) : (
        <ul className="grid gap-5 xl:grid-cols-2">
          {stands.map((stand, index) => {
            const editable = isEditableRegistration(stand.status);
            const frame = index % 2 === 0 ? 'bg-plum' : 'bg-scout-600';

            return (
              <li key={stand.id}>
                <section className={`rounded-3xl ${frame} p-6 text-white`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={cardTitleClass}>{stand.name}</h3>
                      <p className="text-sm text-white/75">Responsable: {stand.responsible}</p>
                    </div>
                    <StatusBadge status={registrationStatusView(stand.status)} />
                  </div>

                  <p className="mb-3 text-sm text-white/80">{stand.products}</p>

                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <Badge tone="gray">{formatCOP(Number(stand.amount))}</Badge>
                  </div>

                  {stand.admin_note && (
                    <Alert tone="warning" title="Observación de la organización" className="mb-3">
                      {stand.admin_note}
                    </Alert>
                  )}

                  {stand.status === 'draft' && (
                    <Alert tone="info" className="mb-3">
                      Esta solicitud está guardada pero aún no has registrado el pago.{' '}
                      <LinkButton href="/panel/pagos" size="sm" variant="secondary" className="ml-1">
                        Ir a pagos
                      </LinkButton>
                    </Alert>
                  )}

                  {editable ? (
                    <div className="flex flex-wrap gap-2">
                      <EditStandToggle
                        id={stand.id}
                        stand={{
                          name: stand.name,
                          responsible: stand.responsible,
                          document: stand.document,
                          phone: stand.phone,
                          email: stand.email ?? '',
                          products: stand.products,
                          description: stand.description,
                          notes: stand.notes,
                        }}
                      />
                      <form action={deleteStandAction}>
                        <input type="hidden" name="id" value={stand.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="!border-white/40 !text-white hover:!bg-white/10"
                        >
                          Eliminar
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <p className="text-sm text-white/70">
                      Este stand ya no admite cambios porque su pago está en curso o confirmado.
                    </p>
                  )}
                </section>
              </li>
            );
          })}
        </ul>
      )}

      {available === 0 && (
        <Alert tone="warning">
          No quedan cupos disponibles para stands nuevos. Puedes guardar una solicitud como
          borrador, pero no admite pago hasta que se libere un cupo.
        </Alert>
      )}

      <NewStandToggle />
    </div>
  );
}
