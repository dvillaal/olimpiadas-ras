'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, requireGroup } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { validateRows, type ImportIssue, type RawRow } from '@/lib/import/participants';

/**
 * Importación masiva de participantes.
 *
 * El archivo se analiza en el navegador (CSV con Papa Parse, XLSX con ExcelJS)
 * y aquí llegan solo las filas ya estructuradas. La validación se repite en el
 * servidor contra el estado real de la base: los grupos y documentos pudieron
 * cambiar entre la previsualización y la confirmación.
 */

export interface ImportPreview {
  validCount: number;
  issues: ImportIssue[];
  totalRows: number;
  sample: { row: number; fullName: string; group: string; branch: string }[];
}

async function loadContext(forceGroupId?: string) {
  const supabase = await createClient();

  const [{ data: groups }, { data: branches }, { data: participants }] = await Promise.all([
    supabase.from('groups').select('id, code, name').eq('status', 'approved'),
    supabase.from('branches').select('id').eq('active', true),
    supabase.from('participants').select('doc_type, document'),
  ]);

  return {
    supabase,
    groupsByCode: new Map(
      (groups ?? []).filter((g) => g.code).map((g) => [g.code as string, g.id]),
    ),
    groupNames: new Map((groups ?? []).map((g) => [g.id, g.name])),
    branchIds: new Set((branches ?? []).map((b) => b.id)),
    existingDocuments: new Set(
      (participants ?? []).map((p) => `${p.doc_type}:${p.document}`),
    ),
    forceGroupId,
  };
}

/** Valida sin escribir nada: alimenta la pantalla de previsualización. */
export async function previewImportAction(
  rows: RawRow[],
  scope: 'admin' | 'group',
): Promise<ImportPreview> {
  const groupId = scope === 'group' ? (await requireGroup()).group.id : undefined;
  if (scope === 'admin') await requireAdmin();

  const context = await loadContext(groupId);
  const result = validateRows(rows, context);

  return {
    validCount: result.valid.length,
    issues: result.issues,
    totalRows: result.totalRows,
    sample: result.valid.slice(0, 8).map((p) => ({
      row: p.row,
      fullName: p.fullName,
      group: context.groupNames.get(p.groupId ?? '') ?? p.groupCode,
      branch: p.branchId,
    })),
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
): Promise<ImportOutcome> {
  const groupId = scope === 'group' ? (await requireGroup()).group.id : undefined;
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
