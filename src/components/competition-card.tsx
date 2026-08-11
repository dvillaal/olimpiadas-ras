'use client';

import { useState } from 'react';
import type { Competition } from '@/lib/competitions/load';
import { formatCompetitionDate, shortTime } from '@/lib/domain/competitions';
import { scheduleStatusView } from '@/lib/domain/status';
import { Badge, Button, StatusBadge } from '@/components/ui';
import { MatchResultForm, SessionResultForm } from '@/components/result-entry';

/**
 * Tarjeta de una competencia.
 *
 * El formulario de resultado se despliega dentro de la misma tarjeta en lugar
 * de abrir un diálogo: el árbitro suele estar en el celular, a pie de cancha, y
 * un modal a pantalla completa lo deja sin referencia de qué estaba anotando.
 */
export function CompetitionCard({
  competition,
  canEnterResult = false,
  showReferee = false,
}: {
  competition: Competition;
  canEnterResult?: boolean;
  showReferee?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasResult = competition.scoreA !== null || competition.participants.some((p) => p.value !== null);

  return (
    <article className="panel">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-20 shrink-0 rounded-xl bg-scout-50 px-2 py-3 text-center">
          <b className="block text-lg font-black text-scout-700">
            {shortTime(competition.startsAt)}
          </b>
          <span className="text-[11px] leading-tight text-slate-500">
            {formatCompetitionDate(competition.startsOn)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={scheduleStatusView(competition.status)} />
            {competition.resultPublished && <Badge tone="green">Publicado</Badge>}
            <Badge tone="gray">{competition.branchName}</Badge>
          </div>

          <h3 className="text-lg font-extrabold text-navy">
            <span aria-hidden className="mr-1.5">
              {competition.sportIcon}
            </span>
            {competition.sportName}
          </h3>

          <p className="font-semibold text-slate-700">
            {competition.type === 'match'
              ? `${competition.teamAName} vs. ${competition.teamBName}`
              : `${competition.label} · ${competition.participants.length} participantes`}
          </p>

          <p className="text-sm text-slate-500">
            {competition.venue || 'Sin lugar asignado'}
            {showReferee && ` · ${competition.refereeName ?? 'Sin árbitro'}`}
          </p>

          {competition.type === 'match' && hasResult && (
            <p className="mt-2 text-2xl font-black text-navy">
              {competition.scoreA} <span className="text-slate-300">–</span> {competition.scoreB}
            </p>
          )}
        </div>

        {canEnterResult && (
          <Button variant={open ? 'secondary' : 'primary'} onClick={() => setOpen(!open)}>
            {open ? 'Cerrar' : hasResult ? 'Editar resultado' : 'Registrar resultado'}
          </Button>
        )}
      </div>

      {competition.type === 'session' && competition.participants.length > 0 && !open && (
        <ul className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
          {competition.participants.slice(0, 8).map((participant) => (
            <li key={participant.participantId} className="flex items-center gap-2">
              <span className="w-6 text-xs font-bold text-slate-400">
                {participant.disqualified ? 'DQ' : (participant.rank ?? '—')}
              </span>
              <span className="min-w-0 flex-1 truncate">{participant.name}</span>
              <span className="text-xs text-slate-500">{participant.groupName}</span>
              <b className="w-16 text-right">{participant.value ?? '—'}</b>
            </li>
          ))}
          {competition.participants.length > 8 && (
            <li className="text-xs text-slate-400">
              y {competition.participants.length - 8} más…
            </li>
          )}
        </ul>
      )}

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          {competition.type === 'match' ? (
            <MatchResultForm
              scheduleId={competition.id}
              teamAName={competition.teamAName}
              teamBName={competition.teamBName}
              scoreA={competition.scoreA}
              scoreB={competition.scoreB}
              notes={competition.resultNotes}
              published={competition.resultPublished}
              resultLabel={competition.resultLabel}
            />
          ) : (
            <SessionResultForm
              scheduleId={competition.id}
              rows={competition.participants}
              notes={competition.resultNotes}
              published={competition.resultPublished}
              resultLabel={competition.resultLabel}
              resultOrder={competition.resultOrder}
            />
          )}
        </div>
      )}
    </article>
  );
}
