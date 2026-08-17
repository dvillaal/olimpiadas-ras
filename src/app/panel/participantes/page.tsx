import type { Metadata } from 'next';
import { requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ageAt } from '@/lib/domain/eligibility';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui';
import { cardTitleClass } from '@/lib/fonts';

export const metadata: Metadata = { title: 'Participantes' };

/**
 * Vista de solo lectura: el jefe de grupo consulta quiénes tiene inscritos,
 * agrupados por rama, pero no puede crearlos ni editarlos desde aquí — eso
 * sigue siendo tarea del administrador (importación o alta manual), que es
 * quien valida documentos y datos de cada persona.
 */
export default async function GroupParticipantsPage() {
  const { group } = await requireGroup();
  const supabase = await createClient();

  const [{ data: participants }, { data: branches }] = await Promise.all([
    supabase
      .from('participants')
      .select('*')
      .eq('group_id', group.id)
      .order('full_name'),
    supabase.from('branches').select('*').order('sort_order'),
  ]);

  const rows = participants ?? [];
  const activeCount = rows.filter((p) => p.active).length;

  const byBranch = new Map<string, typeof rows>();
  for (const participant of rows) {
    byBranch.set(participant.branch_id, [
      ...(byBranch.get(participant.branch_id) ?? []),
      participant,
    ]);
  }

  // Solo se muestran ramas que tengan al menos un participante del grupo,
  // pero en el orden configurado por la organización.
  const orderedBranches = (branches ?? []).filter((b) => byBranch.has(b.id));

  return (
    <div className="min-w-0 space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-plum px-6 py-5 text-white sm:px-8 sm:py-6">
        <div>
          <h1 className={cardTitleClass}>Participantes</h1>
          <p className="mt-1 text-sm text-white/75">
            {rows.length} registrados · {activeCount} activos, agrupados por rama.
          </p>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="rounded-3xl bg-scout-600 p-6 text-center text-white">
          <span className="mb-2 block text-3xl" aria-hidden>
            👥
          </span>
          <p className="font-semibold text-white">Todavía no hay participantes registrados</p>
          <p className="mt-1 text-sm text-white/75">
            La organización los carga por importación o alta manual. Si falta alguien o hay un
            dato por corregir, escríbeles.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {orderedBranches.map((branch, index) => {
            const members = byBranch.get(branch.id) ?? [];
            const frame = index % 2 === 0 ? 'bg-plum' : 'bg-scout-600';
            return (
              <details
                key={branch.id}
                className={`group overflow-hidden rounded-3xl ${frame} text-white`}
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-5 sm:px-8">
                  <span className={cardTitleClass}>{branch.name}</span>
                  <span className="flex items-center gap-2 text-sm text-white/75">
                    {members.length} participante{members.length === 1 ? '' : 's'}
                    <span aria-hidden className="transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </span>
                </summary>

                <ul className="space-y-2 px-6 pb-6 sm:px-8">
                  {members.map((participant) => (
                    <li
                      key={participant.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/10 p-3"
                    >
                      <div className="min-w-0">
                        <b className="block truncate text-white">{participant.full_name}</b>
                        <p className="text-xs text-white/70">
                          {ageAt(participant.birthdate)} años ·{' '}
                          {formatDate(participant.birthdate)}
                          {participant.gender && ` · ${participant.gender}`}
                        </p>
                        {participant.notes && (
                          <p className="mt-0.5 text-xs text-white/60">{participant.notes}</p>
                        )}
                      </div>
                      <Badge tone={participant.active ? 'green' : 'gray'}>
                        {participant.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}

      <p className="text-sm text-white/60">
        ¿Falta alguien o hay un dato por corregir? Pídele a la organización que lo agregue o lo
        ajuste: solo el administrador puede crear o editar participantes.
      </p>
    </div>
  );
}
