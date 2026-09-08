'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/pagination';
import {
  validateRows,
  type ImportIssue,
  type ParticipantColumn,
  type RawRow,
} from '@/lib/import/participants';

/**
 * Importación masiva de participantes.
 *
 * El archivo se analiza en el navegador (CSV con Papa Parse, XLSX con ExcelJS)
 * y aquí llegan solo las filas ya estructuradas. La validación se repite en el
 * servidor contra el estado real de la base: los grupos y documentos pudieron
 * cambiar entre la previsualización y la confirmación.
 */

export interface ResolvedParticipant {
  fullName: string;
  group: string;
  branch: string;
  docType: string;
  document: string;
  birthdate: string;
  gender: string;
}

export interface ImportRowResult {
  row: number;
  values: Partial<Record<ParticipantColumn, string>>;
  /** Cómo quedaría esta fila si se importa ahora mismo; `null` si tiene problemas. */
  resolved: ResolvedParticipant | null;
  issues: ImportIssue[];
}

export interface ImportPreview {
  totalRows: number;
  validCount: number;
  rows: ImportRowResult[];
}

async function loadContext(forceGroupId?: string) {
  const supabase = await createClient();

  const [groups, { data: branches }, participants, regionalMembers] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from('groups').select('id, code, name').eq('status', 'approved').range(from, to),
    ),
    supabase.from('branches').select('*').eq('active', true),
    fetchAllRows((from, to) => supabase.from('participants').select('doc_type, document').range(from, to)),
    fetchAllRows((from, to) =>
      supabase
        .from('regional_members')
        .select('scout_id, full_name, document, birthdate, gender, unit, function_name, status, enrollment_year')
        .range(from, to),
    ),
  ]);

  return {
    supabase,
    groupsByCode: new Map(groups.filter((g) => g.code).map((g) => [g.code as string, g.id])),
    groupNames: new Map(groups.map((g) => [g.id, g.name])),
    branchIds: new Set((branches ?? []).map((b) => b.id)),
    branchNames: new Map((branches ?? []).map((b) => [b.id, b.name])),
    // Rangos de edad completos (no solo el id), para deducir la rama cuando falte.
    branchAgeRanges: branches ?? [],
    existingDocuments: new Set(participants.map((p) => `${p.doc_type}:${p.document}`)),
    // Base regional por Id Scout, para completar campos que el archivo no traiga.
    regionalMembers: new Map(
      regionalMembers.map((m) => [
        m.scout_id,
        {
          fullName: m.full_name,
          document: m.document,
          birthdate: m.birthdate,
          gender: m.gender,
          unit: m.unit,
          functionName: m.function_name,
          status: m.status,
          enrollmentYear: m.enrollment_year,
        },
      ]),
    ),
    forceGroupId,
  };
}

/**
 * Valida sin escribir nada: alimenta la pantalla de previsualización.
 *
 * Devuelve TODAS las filas (no una muestra): la idea es que el administrador
 * pueda revisar y corregir cada problema puntual antes de importar, en vez de
 * tener que adivinar a partir de un reporte aparte.
 */
export async function previewImportAction(
  rows: RawRow[],
  scope: 'admin' | 'group',
  forcedGroupId?: string,
): Promise<ImportPreview> {
  const groupId = scope === 'group' ? (await requireGroup()).group.id : forcedGroupId;
  if (scope === 'admin') await requireAdmin();

  const context = await loadContext(groupId);
  const result = validateRows(rows, context);

  const issuesByRow = new Map<number, ImportIssue[]>();
  for (const issue of result.issues) {
    issuesByRow.set(issue.row, [...(issuesByRow.get(issue.row) ?? []), issue]);
  }
  const validByRow = new Map(result.valid.map((p) => [p.row, p]));

  const rowResults: ImportRowResult[] = rows.map((raw) => {
    const valid = validByRow.get(raw.row);
    return {
      row: raw.row,
      values: raw.values,
      resolved: valid
        ? {
            fullName: valid.fullName,
            group: context.groupNames.get(valid.groupId ?? '') ?? valid.groupCode,
            branch: context.branchNames.get(valid.branchId) ?? valid.branchId,
            docType: valid.docType,
            document: valid.document,
            birthdate: valid.birthdate,
            gender: valid.gender ?? '',
          }
        : null,
      issues: issuesByRow.get(raw.row) ?? [],
    };
  });

  return {
    totalRows: result.totalRows,
    validCount: result.valid.length,
    rows: rowResults,
  };
}

export interface ImportOutcome {
  inserted: number;
  failed: number;
  message: string;
  issues: ImportIssue[];
}

/** Inserta las filas válidas. Las que tengan problemas simplemente se omiten. */
export async function confirmImportAction(
  rows: RawRow[],
  scope: 'admin' | 'group',
  forcedGroupId?: string,
): Promise<ImportOutcome> {
  const groupId = scope === 'group' ? (await requireGroup()).group.id : forcedGroupId;
  if (scope === 'admin') await requireAdmin();

  const context = await loadContext(groupId);
  const { valid, issues } = validateRows(rows, context);

  if (valid.length === 0) {
    return {
      inserted: 0,
      failed: rows.length,
      message: 'Ninguna fila pasó la validación. Revisa el reporte de problemas.',
      issues,
    };
  }

  const payload = valid.map((p) => ({
    group_id: p.groupId as string,
    doc_type: p.docType,
    document: p.document,
    first_names: p.firstNames,
    last_names: p.lastNames,
    birthdate: p.birthdate,
    branch_id: p.branchId,
    gender: p.gender,
    active: p.active,
    notes: p.notes,
  }));

  // Se inserta en lotes: un archivo de 2.000 filas en una sola sentencia puede
  // agotar el tiempo de la petición.
  const BATCH = 200;
  let inserted = 0;
  const runtimeIssues: ImportIssue[] = [...issues];

  for (let start = 0; start < payload.length; start += BATCH) {
    const batch = payload.slice(start, start + BATCH);
    const { error } = await context.supabase.from('participants').insert(batch);

    if (error) {
      runtimeIssues.push({
        row: valid[start]?.row ?? 0,
        column: 'GENERAL',
        message: `Lote ${Math.floor(start / BATCH) + 1}: ${error.message}`,
      });
    } else {
      inserted += batch.length;
    }
  }

  await context.supabase.rpc('log_audit', {
    p_action: `Importó ${inserted} participante(s)`,
    p_entity_type: 'participants',
    p_metadata: { total: rows.length, omitidos: rows.length - inserted },
  });

  revalidatePath('/admin/participantes');

  return {
    inserted,
    failed: rows.length - inserted,
    message:
      inserted === rows.length
        ? `Se importaron ${inserted} participantes.`
        : `Se importaron ${inserted} de ${rows.length}. ${rows.length - inserted} fila(s) quedaron fuera.`,
    issues: runtimeIssues,
  };
}
