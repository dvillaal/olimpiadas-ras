'use client';

import { useMemo, useState } from 'react';
import { Badge, EmptyState, StatusBadge } from '@/components/ui';
import { registrationStatusView } from '@/lib/domain/status';
import type { RegistrationStatus } from '@/types/database';
import { AdminEditTeamToggle } from './admin-edit-team-toggle';
import type { AdminEditorParticipant, AdminEditorSport } from './admin-team-editor';

export interface TeamRow {
  id: string;
  name: string;
  status: RegistrationStatus;
  sportId: string;
  sportName: string;
  sportIcon: string;
  groupId: string;
  groupName: string;
  startersCount: number;
  teamSize: number | null;
  substitutesCount: number;
  externalCount: number;
  rosterBadges: { participantId: string; fullName: string; role: 'starter' | 'substitute'; external: boolean }[];
  valueLabel: string;
  adminNote: string | null;
  edit: {
    sport: AdminEditorSport;
    participants: AdminEditorParticipant[];
    initialStarters: string[];
    initialSubstitutes: string[];
  } | null;
}

const ALL = '__all__';

export function TeamsFilterList({
  teams,
  sports,
  groups,
}: {
  teams: TeamRow[];
  sports: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}) {
  const [sportFilter, setSportFilter] = useState(ALL);
  const [groupFilter, setGroupFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [search, setSearch] = useState('');

  const statuses = useMemo(
    () => [...new Set(teams.map((t) => t.status))],
    [teams],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return teams.filter((team) => {
      if (sportFilter !== ALL && team.sportId !== sportFilter) return false;
      if (groupFilter !== ALL && team.groupId !== groupFilter) return false;
      if (statusFilter !== ALL && team.status !== statusFilter) return false;
      if (term && !team.name.toLowerCase().includes(term) && !team.groupName.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [teams, sportFilter, groupFilter, statusFilter, search]);

  const selectClass =
    'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy transition-colors ' +
    'focus:border-scout-500 focus:outline-none focus:ring-2 focus:ring-scout-200';

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por equipo o grupo…"
          className={selectClass}
        />

        <select value={sportFilter} onChange={(event) => setSportFilter(event.target.value)} className={selectClass}>
          <option value={ALL}>Todos los deportes</option>
          {sports.map((sport) => (
            <option key={sport.id} value={sport.id}>
              {sport.name}
            </option>
          ))}
        </select>

        <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className={selectClass}>
          <option value={ALL}>Todos los grupos</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={selectClass}
        >
          <option value={ALL}>Todos los estados</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {registrationStatusView(status).label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Ningún equipo coincide con el filtro"
          description="Prueba a quitar alguno de los filtros de arriba."
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {filtered.map((team) => (
            <li key={team.id} className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-navy">{team.name}</h4>
                  <p className="text-sm text-slate-500">
                    {team.sportIcon} {team.sportName} · {team.groupName}
                  </p>
                </div>
                <StatusBadge status={registrationStatusView(team.status)} />
              </div>

              <p className="mb-2 text-sm">
                <b className="text-navy">
                  {team.startersCount}/{team.teamSize ?? '?'}
                </b>{' '}
                titulares
                {team.substitutesCount > 0 && ` · ${team.substitutesCount} suplentes`}
                {team.externalCount > 0 && (
                  <Badge tone="blue" className="ml-2">
                    {team.externalCount} externo(s)
                  </Badge>
                )}
              </p>

              <ul className="mb-3 flex flex-wrap gap-1.5">
                {team.rosterBadges.map((member) => (
                  <li key={member.participantId}>
                    <Badge tone={member.role === 'starter' ? 'green' : 'gray'}>
                      {member.fullName}
                      {member.external && ' ↗'}
                    </Badge>
                  </li>
                ))}
              </ul>

              <p className="text-sm text-slate-500">Valor: {team.valueLabel}</p>

              {team.adminNote && (
                <p className="mt-2 rounded-lg bg-canvas p-2 text-xs text-slate-600">{team.adminNote}</p>
              )}

              {team.edit && (
                <div className="mt-3">
                  <AdminEditTeamToggle
                    sport={team.edit.sport}
                    participants={team.edit.participants}
                    groupId={team.groupId}
                    groupName={team.groupName}
                    teamId={team.id}
                    initialName={team.name}
                    initialStarters={team.edit.initialStarters}
                    initialSubstitutes={team.edit.initialSubstitutes}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
