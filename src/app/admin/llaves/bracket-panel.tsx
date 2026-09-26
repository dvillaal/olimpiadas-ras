import { deleteBracketAction } from './actions';
import { Badge, Button, Panel } from '@/components/ui';
import { BracketSlotRow, type CourtOption, type SlotRow } from './bracket-slot-row';
import type { BracketFormat, BracketStatus } from '@/types/database';

const FORMAT_LABELS: Record<BracketFormat, string> = {
  elimination: 'Eliminación directa',
  groups_knockout: 'Fase de grupos + eliminación',
  round_robin: 'Liga (todos contra todos)',
};

const STATUS_TONE: Record<BracketStatus, 'gray' | 'blue' | 'green'> = {
  draft: 'gray',
  drawn: 'blue',
  finished: 'green',
};

const STATUS_LABEL: Record<BracketStatus, string> = {
  draft: 'Molde sin sortear',
  drawn: 'Equipos sorteados',
  finished: 'Terminada',
};

export interface BracketSummary {
  id: string;
  sportName: string;
  sportIcon: string;
  branchName: string;
  format: BracketFormat;
  status: BracketStatus;
  teamCount: number;
}

export interface RoundGroup {
  roundNumber: number;
  roundName: string;
  slots: SlotRow[];
}

export function BracketPanel({
  bracket,
  rounds,
  courts,
}: {
  bracket: BracketSummary;
  rounds: RoundGroup[];
  courts: CourtOption[];
}) {
  return (
    <Panel
      title={`${bracket.sportIcon} ${bracket.sportName} · ${bracket.branchName}`}
      description={FORMAT_LABELS[bracket.format]}
      actions={
        <>
          <Badge tone={STATUS_TONE[bracket.status]}>{STATUS_LABEL[bracket.status]}</Badge>
          <form action={deleteBracketAction}>
            <input type="hidden" name="id" value={bracket.id} />
            <Button type="submit" size="sm" variant="danger">
              Eliminar molde
            </Button>
          </form>
        </>
      }
    >
      <div className="space-y-5">
        {rounds.map((round) => (
          <div key={round.roundNumber} className="space-y-2">
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {round.roundName}
            </h4>
            <div className="space-y-2">
              {round.slots.map((slot) => (
                <BracketSlotRow key={slot.id} slot={slot} courts={courts} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
