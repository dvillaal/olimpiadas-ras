import { Badge } from '@/components/ui';

/**
 * Árbol de llaves: solo tiene sentido para la parte de eliminación directa
 * (una ronda alimenta a la siguiente). La fase de grupos y la liga siguen
 * viéndose como lista de casillas, más abajo en la pantalla.
 */

export interface TreeMatch {
  id: string;
  isBye: boolean;
  teamADesc: string;
  teamBDesc: string;
  startsOn: string | null;
  startsAt: string | null;
  endsAt: string | null;
  courtName: string | null;
}

export interface TreeRound {
  roundNumber: number;
  roundName: string;
  matches: TreeMatch[];
}

const BOX_W = 208;
const CARD_H = 44;
const META_H = 16;
const BOX_H = CARD_H + META_H;
const COL_GAP = 72;
const ROW_GAP = 28;
const HEADER_H = 28;
const PAD = 16;

function computeCenters(rounds: TreeRound[]): number[][] {
  const centers: number[][] = [];
  centers[0] = rounds[0]!.matches.map((_, i) => i * (BOX_H + ROW_GAP) + BOX_H / 2);

  for (let r = 1; r < rounds.length; r++) {
    centers[r] = rounds[r]!.matches.map((_, i) => {
      const a = centers[r - 1]![2 * i];
      const b = centers[r - 1]![2 * i + 1];
      return a === undefined ? b! : b === undefined ? a : (a + b) / 2;
    });
  }

  return centers;
}

// El día es el mismo para todo el torneo (el del evento), así que aquí solo
// importa el rango de hora.
function formatWhen(match: TreeMatch): string {
  if (!match.startsAt) return 'Sin hora';
  const start = match.startsAt.slice(0, 5);
  return match.endsAt ? `${start}–${match.endsAt.slice(0, 5)}` : start;
}

export function BracketTree({ rounds }: { rounds: TreeRound[] }) {
  if (rounds.length === 0 || rounds[0]!.matches.length === 0) return null;

  const centers = computeCenters(rounds);
  const contentHeight = Math.max(...centers[0]!) + BOX_H / 2;
  const height = HEADER_H + contentHeight + PAD * 2;
  const width = rounds.length * BOX_W + (rounds.length - 1) * COL_GAP + PAD * 2;

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white p-3">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="min-w-full">
        {rounds.map((round, r) => (
          <text
            key={round.roundNumber}
            x={PAD + r * (BOX_W + COL_GAP) + BOX_W / 2}
            y={HEADER_H - 8}
            textAnchor="middle"
            className="fill-slate-500 text-[11px] font-bold uppercase tracking-wide"
          >
            {round.roundName}
          </text>
        ))}

        {rounds.slice(1).map((round, ri) => {
          const r = ri + 1;
          return round.matches.map((_, i) => {
            const x1 = PAD + r * (BOX_W + COL_GAP) - COL_GAP;
            const xMid = x1 + COL_GAP / 2;
            const x2 = PAD + r * (BOX_W + COL_GAP);
            const yTarget = HEADER_H + PAD + centers[r]![i]!;

            return [2 * i, 2 * i + 1].map((childIndex) => {
              const ySource = centers[r - 1]?.[childIndex];
              if (ySource === undefined) return null;

              return (
                <polyline
                  key={`${r}-${i}-${childIndex}`}
                  points={`${x1},${HEADER_H + PAD + ySource} ${xMid},${HEADER_H + PAD + ySource} ${xMid},${yTarget} ${x2},${yTarget}`}
                  fill="none"
                  stroke="var(--color-line)"
                  strokeWidth={2}
                />
              );
            });
          });
        })}

        {rounds.map((round, r) =>
          round.matches.map((match, i) => {
            const x = PAD + r * (BOX_W + COL_GAP);
            const y = HEADER_H + PAD + centers[r]![i]! - BOX_H / 2;

            return (
              <foreignObject key={match.id} x={x} y={y} width={BOX_W} height={BOX_H}>
                <div className="flex flex-col text-xs">
                  <div
                    className="flex flex-col overflow-hidden rounded-lg border border-line bg-white shadow-sm"
                    style={{ height: CARD_H }}
                  >
                    {match.isBye ? (
                      <div className="flex flex-1 items-center justify-between px-2 py-1">
                        <span className="truncate font-semibold text-navy">
                          {match.teamADesc || match.teamBDesc}
                        </span>
                        <Badge tone="gray">Bye</Badge>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 truncate border-b border-line px-2 py-1 font-semibold text-navy">
                          {match.teamADesc}
                        </div>
                        <div className="flex-1 truncate px-2 py-1 font-semibold text-navy">
                          {match.teamBDesc}
                        </div>
                      </>
                    )}
                  </div>
                  {!match.isBye && (
                    <div className="truncate text-center text-[10px] text-slate-500">
                      {formatWhen(match)}
                      {match.courtName ? ` · ${match.courtName}` : ''}
                    </div>
                  )}
                </div>
              </foreignObject>
            );
          }),
        )}
      </svg>
    </div>
  );
}
