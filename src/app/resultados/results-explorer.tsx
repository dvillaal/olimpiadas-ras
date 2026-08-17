'use client';

import { useMemo, useState } from 'react';
import type {
  PublicIndividualRank,
  PublicSchedule,
  PublicStanding,
} from '@/types/database';
import { formatCompetitionDate, shortTime } from '@/lib/domain/competitions';
import { Checkbox } from '@/components/ui';

/**
 * Explorador de resultados públicos.
 *
 * Todo el filtrado ocurre en el cliente sobre datos ya cargados: un evento cabe
 * de sobra en memoria y así cambiar de deporte es instantáneo, incluso con la
 * conexión irregular de un polideportivo.
 */

type Tab = 'schedule' | 'standings' | 'ranking';

function flagOf(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export function ResultsExplorer({
  competitions,
  standings,
  ranking,
}: {
  competitions: PublicSchedule[];
  standings: PublicStanding[];
  ranking: PublicIndividualRank[];
}) {
  const [tab, setTab] = useState<Tab>('schedule');
  const [sport, setSport] = useState('');
  const [branch, setBranch] = useState('');
  const [onlyPublished, setOnlyPublished] = useState(false);

  const sports = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of competitions) map.set(c.sport_slug, `${c.sport_icon} ${c.sport_name}`);
    return [...map.entries()];
  }, [competitions]);

  const branches = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of competitions) map.set(c.branch_id, c.branch_name);
    return [...map.entries()];
  }, [competitions]);

  const visibleCompetitions = competitions.filter(
    (c) =>
      (!sport || c.sport_slug === sport) &&
      (!branch || c.branch_id === branch) &&
      (!onlyPublished || c.result_published),
  );

  const visibleStandings = standings.filter(
    (s) => (!sport || s.sport_slug === sport) && (!branch || s.branch_id === branch),
  );

  const visibleRanking = ranking.filter(
    (r) => (!sport || r.sport_slug === sport) && (!branch || r.branch_id === branch),
  );

  // Las posiciones solo tienen sentido dentro de una misma categoría.
  const standingGroups = useMemo(() => {
    const map = new Map<string, PublicStanding[]>();
    for (const row of visibleStandings) {
      const key = `${row.sport_name}||${row.branch_name}`;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    for (const rows of map.values()) {
      rows.sort(
        (a, b) =>
          b.points - a.points ||
          b.goal_difference - a.goal_difference ||
          b.goals_for - a.goals_for,
      );
    }
    return [...map.entries()];
  }, [visibleStandings]);

  const rankingGroups = useMemo(() => {
    const map = new Map<string, PublicIndividualRank[]>();
    for (const row of visibleRanking) {
      const key = `${row.sport_name}||${row.branch_name}||${row.result_label}`;
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    for (const rows of map.values()) rows.sort((a, b) => a.position - b.position);
    return [...map.entries()];
  }, [visibleRanking]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'schedule', label: 'Programación', count: visibleCompetitions.length },
    { key: 'standings', label: 'Tabla de posiciones', count: standingGroups.length },
    { key: 'ranking', label: 'Clasificación individual', count: rankingGroups.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? 'page' : undefined}
            className={
              tab === item.key
                ? 'border-b-2 border-scout-700 px-3 py-2.5 text-sm font-bold text-scout-700'
                : 'border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-slate-500 hover:text-navy'
            }
          >
            {item.label}
            <span className="ml-1.5 text-xs text-slate-400">{item.count}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <select
          className="field-input"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          aria-label="Filtrar por deporte"
        >
          <option value="">Todos los deportes</option>
          {sports.map(([slug, name]) => (
            <option key={slug} value={slug}>
              {name}
            </option>
          ))}
        </select>

        <select
          className="field-input"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          aria-label="Filtrar por rama"
        >
          <option value="">Todas las ramas</option>
          {branches.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>

        {tab === 'schedule' && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={onlyPublished}
              onChange={(e) => setOnlyPublished(e.target.checked)}
            />
            Solo con resultado oficial
          </label>
        )}
      </div>

      {/* ─── Programación ─────────────────────────────────────────────────── */}
      {tab === 'schedule' &&
        (visibleCompetitions.length === 0 ? (
          <Empty text="No hay competencias que coincidan con ese filtro." />
        ) : (
          <ul className="space-y-3">
            {visibleCompetitions.map((competition) => (
              <li key={competition.id} className="panel">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-20 shrink-0 rounded-xl bg-scout-50 px-2 py-3 text-center">
                    <b className="block text-lg font-black text-scout-700">
                      {shortTime(competition.starts_at)}
                    </b>
                    <span className="text-[11px] leading-tight text-slate-500">
                      {formatCompetitionDate(competition.starts_on)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {competition.sport_icon} {competition.sport_name} · {competition.branch_name}
                    </p>
                    <h3 className="text-lg font-extrabold text-navy">
                      {competition.type === 'match'
                        ? `${competition.team_a_name} vs. ${competition.team_b_name}`
                        : competition.label}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {competition.venue || 'Lugar por confirmar'}
                      {competition.referee_name && ` · ${competition.referee_name}`}
                    </p>
                  </div>

                  {competition.result_published && competition.type === 'match' ? (
                    <div className="text-right">
                      <b className="text-3xl font-black text-navy">
                        {competition.score_a} <span className="text-slate-300">–</span>{' '}
                        {competition.score_b}
                      </b>
                      <span className="block text-xs font-bold text-green-700">Oficial</span>
                    </div>
                  ) : competition.result_published ? (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                      Resultados publicados
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                      Por disputar
                    </span>
                  )}
                </div>

                {competition.result_published && competition.result_notes && (
                  <p className="mt-3 border-t border-line pt-3 text-sm text-slate-600">
                    {competition.result_notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ))}

      {/* ─── Tabla de posiciones ──────────────────────────────────────────── */}
      {tab === 'standings' &&
        (standingGroups.length === 0 ? (
          <Empty text="Todavía no hay partidos con resultado oficial en esta categoría." />
        ) : (
          standingGroups.map(([key, rows]) => {
            const [sportName, branchName] = key.split('||');
            return (
              <section key={key} className="panel">
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-navy">{sportName}</h2>
                  <span className="text-sm text-slate-500">{branchName}</span>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase text-slate-500">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Equipo</th>
                        <th className="py-2 px-1.5 text-center">PJ</th>
                        <th className="py-2 px-1.5 text-center">PG</th>
                        <th className="py-2 px-1.5 text-center">PE</th>
                        <th className="py-2 px-1.5 text-center">PP</th>
                        <th className="py-2 px-1.5 text-center">GF</th>
                        <th className="py-2 px-1.5 text-center">GC</th>
                        <th className="py-2 px-1.5 text-center">DG</th>
                        <th className="py-2 pl-1.5 text-center">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.team_id} className="border-b border-line/60">
                          <td className="py-2 pr-2 font-bold text-slate-400">{index + 1}</td>
                          <td className="py-2 pr-2">
                            <b className="text-navy">{row.team_name}</b>
                            <span className="block text-xs text-slate-500">
                              {flagOf(row.country_code)} {row.group_name}
                            </span>
                          </td>
                          <td className="py-2 px-1.5 text-center">{row.played}</td>
                          <td className="py-2 px-1.5 text-center">{row.won}</td>
                          <td className="py-2 px-1.5 text-center">{row.drawn}</td>
                          <td className="py-2 px-1.5 text-center">{row.lost}</td>
                          <td className="py-2 px-1.5 text-center">{row.goals_for}</td>
                          <td className="py-2 px-1.5 text-center">{row.goals_against}</td>
                          <td className="py-2 px-1.5 text-center">{row.goal_difference}</td>
                          <td className="py-2 pl-1.5 text-center font-black text-navy">
                            {row.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        ))}

      {/* ─── Clasificación individual ─────────────────────────────────────── */}
      {tab === 'ranking' &&
        (rankingGroups.length === 0 ? (
          <Empty text="Todavía no hay marcas publicadas en esta categoría." />
        ) : (
          rankingGroups.map(([key, rows]) => {
            const [sportName, branchName, label] = key.split('||');
            return (
              <section key={key} className="panel">
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-navy">{sportName}</h2>
                  <span className="text-sm text-slate-500">
                    {branchName} · {label}
                  </span>
                </header>

                <ol className="space-y-1.5">
                  {rows.map((row) => (
                    <li
                      key={row.participant_id}
                      className="flex items-center gap-3 rounded-xl border border-line px-3 py-2"
                    >
                      <b
                        className={
                          row.position <= 3
                            ? 'w-8 text-center text-lg font-black text-scout-700'
                            : 'w-8 text-center text-sm font-bold text-slate-400'
                        }
                      >
                        {row.position}
                      </b>
                      <div className="min-w-0 flex-1">
                        <b className="text-navy">{row.participant_name}</b>
                        <span className="block truncate text-xs text-slate-500">
                          {flagOf(row.country_code)} {row.group_name}
                        </span>
                      </div>
                      <strong className="text-lg font-black text-navy">{row.best_value}</strong>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })
        ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center text-slate-500">
      {text}
    </div>
  );
}
