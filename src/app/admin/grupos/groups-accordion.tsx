'use client';

import { Fragment, useState } from 'react';
import { Badge, StatusBadge, Button, Modal } from '@/components/ui';
import { CountryFlag } from '@/components/country-flag';
import { groupStatusView } from '@/lib/domain/status';
import { formatCOP } from '@/lib/domain/fees';
import { formatDate } from '@/lib/utils';
import { GroupRowActions } from './group-row-actions';
import { PaymentReviewCard, type PaymentForReview } from '../pagos/payment-review-card';
import type { GroupStatus, PaymentStatus } from '@/types/database';

export type ConceptStatus = PaymentStatus | 'pending';

export interface ConceptRow {
  concept: string;
  amount: number;
  status: ConceptStatus;
  /** Solo presente en conceptos que ya tienen un pago enviado de verdad. */
  payment?: PaymentForReview;
}

export interface GroupAccordionRow {
  id: string;
  code: string | null;
  name: string;
  city: string | null;
  department: string | null;
  countryCode: string | null;
  countryName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  status: GroupStatus;
  reviewedAt: string | null;
  participantsCount: number;
  paidTotal: number;
  approvedTotal: number;
  approvedCount: number;
  inReviewTotal: number;
  inReviewCount: number;
  pendingTotal: number;
  pendingCount: number;
  concepts: ConceptRow[];
}

const CONCEPT_LABEL: Record<ConceptStatus, string> = {
  approved: 'Aprobado',
  sent: 'En revisión',
  correction: 'Requiere corrección',
  rejected: 'Rechazado',
  pending: 'Pendiente',
};

const CONCEPT_TONE: Record<ConceptStatus, 'green' | 'blue' | 'orange' | 'red' | 'gray'> = {
  approved: 'green',
  sent: 'blue',
  correction: 'orange',
  rejected: 'red',
  pending: 'gray',
};

export function GroupsAccordion({ groups }: { groups: GroupAccordionRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{ payment: PaymentForReview; groupName: string; groupCode: string } | null>(
    null,
  );

  return (
    <div className="table-wrap">
      <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title="Pago">
        {reviewing && (
          <PaymentReviewCard
            payment={reviewing.payment}
            groupName={reviewing.groupName}
            groupCode={reviewing.groupCode}
          />
        )}
      </Modal>

      <table className="data-table">
        <thead>
          <tr>
            <th />
            <th>Código</th>
            <th>Grupo</th>
            <th>País</th>
            <th>Responsable</th>
            <th className="text-right">Participantes</th>
            <th className="text-right">Pagado</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const open = openId === group.id;
            return (
              <Fragment key={group.id}>
                <tr
                  className="cursor-pointer hover:bg-canvas"
                  onClick={() => setOpenId(open ? null : group.id)}
                  aria-expanded={open}
                >
                  <td className="w-6 text-center text-slate-400">{open ? '▾' : '▸'}</td>
                  <td className="whitespace-nowrap font-mono text-xs font-bold">
                    {group.code ?? '—'}
                  </td>
                  <td>
                    <b className="text-navy">{group.name}</b>
                    <br />
                    <small className="text-slate-500">
                      {[group.city, group.department].filter(Boolean).join(', ') || '—'}
                    </small>
                  </td>
                  <td className="whitespace-nowrap">
                    {group.countryCode ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CountryFlag code={group.countryCode} name={group.countryName} size="sm" />
                        {group.countryName}
                      </span>
                    ) : (
                      <span className="text-amber-700">Sin escoger</span>
                    )}
                  </td>
                  <td>
                    {group.leaderName}
                    <br />
                    <small className="break-all text-slate-500">{group.leaderEmail}</small>
                    <br />
                    <small className="text-slate-500">{group.leaderPhone}</small>
                  </td>
                  <td className="text-right font-semibold">{group.participantsCount}</td>
                  <td className="whitespace-nowrap text-right font-semibold text-scout-700">
                    {formatCOP(group.paidTotal)}
                  </td>
                  <td>
                    <StatusBadge status={groupStatusView(group.status)} />
                    <br />
                    <small className="text-xs text-slate-400">desde {formatDate(group.reviewedAt)}</small>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <GroupRowActions
                      groupId={group.id}
                      groupName={group.name}
                      status={group.status}
                      hasCountry={Boolean(group.countryCode)}
                    />
                  </td>
                </tr>

                {open && (
                  <tr>
                    <td colSpan={9} className="bg-canvas p-0">
                      <div className="p-4">
                        <div className="mb-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-line bg-white p-3">
                            <p className="text-lg font-extrabold text-emerald-700">
                              {formatCOP(group.approvedTotal)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Pagos aprobados ({group.approvedCount})
                            </p>
                          </div>
                          <div className="rounded-xl border border-line bg-white p-3">
                            <p className="text-lg font-extrabold text-blue-700">
                              {formatCOP(group.inReviewTotal)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Pagos en revisión ({group.inReviewCount})
                            </p>
                          </div>
                          <div className="rounded-xl border border-line bg-white p-3">
                            <p className="text-lg font-extrabold text-amber-700">
                              {formatCOP(group.pendingTotal)}
                            </p>
                            <p className="text-xs text-slate-500">
                              Pagos pendientes ({group.pendingCount})
                            </p>
                          </div>
                        </div>

                        {group.concepts.length === 0 ? (
                          <p className="text-sm text-slate-500">Sin conceptos todavía.</p>
                        ) : (
                          <div className="table-wrap">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Concepto</th>
                                  <th className="text-right">Valor</th>
                                  <th>Estado</th>
                                  <th>Acción</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.concepts.map((concept, index) => (
                                  <tr key={`${concept.concept}-${index}`}>
                                    <td className="font-semibold text-navy">{concept.concept}</td>
                                    <td className="whitespace-nowrap text-right">
                                      {formatCOP(concept.amount)}
                                    </td>
                                    <td>
                                      <Badge tone={CONCEPT_TONE[concept.status]}>
                                        {CONCEPT_LABEL[concept.status]}
                                      </Badge>
                                    </td>
                                    <td>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={!concept.payment}
                                        title={
                                          concept.payment
                                            ? undefined
                                            : 'Todavía no hay un pago enviado para este concepto.'
                                        }
                                        onClick={() =>
                                          concept.payment &&
                                          setReviewing({
                                            payment: concept.payment,
                                            groupName: group.name,
                                            groupCode: group.code ?? '—',
                                          })
                                        }
                                      >
                                        Vista completa
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
