'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import {
  validateRegionalRows,
  type RawRegionalRow,
  type RegionalImportIssue,
} from '@/lib/import/regional-members';

/**
 * Carga de la base regional de miembros (`regional_members`).
 *
 * Solo el administrador la sube. Es una tabla de referencia, no un registro de
 * inscripción: se reemplaza (upsert por Id Scout) cada vez que llega una
 * versión más nueva del reporte, y la usa la importación de participantes
 * para completar campos que el archivo simple de cada grupo no trae.
 */

export interface RegionalImportPreview {
  validCount: number;
  issues: RegionalImportIssue[];
  totalRows: number;
  sample: { row: number; scoutId: number; fullName: string; groupName: string }[];
}

/** Valida sin escribir nada: alimenta la pantalla de previsualización. */
export async function previewRegionalImportAction(rows: RawRegionalRow[]): Promise<RegionalImportPreview> {
  await requireAdmin();

  const result = validateRegionalRows(rows);

  return {
    validCount: result.valid.length,
    issues: result.issues,
    totalRows: result.totalRows,
    sample: result.valid.slice(0, 8).map((m) => ({
      row: m.row,
      scoutId: m.scoutId,
      fullName: m.fullName,
      groupName: m.groupName,
    })),
  };
}

export interface RegionalImportOutcome {
  upserted: number;
  failed: number;
  message: string;
  issues: RegionalImportIssue[];
}

/** Guarda (upsert por Id Scout) las filas válidas. */
export async function confirmRegionalImportAction(rows: RawRegionalRow[]): Promise<RegionalImportOutcome> {
  await requireAdmin();
  const supabase = await createClient();

  const { valid, issues } = validateRegionalRows(rows);

  if (valid.length === 0) {
    return {
      upserted: 0,
      failed: rows.length,
      message: 'Ninguna fila pasó la validación. Revisa el reporte de problemas.',
      issues,
    };
  }

  const payload = valid.map((m) => ({
    scout_id: m.scoutId,
    full_name: m.fullName,
    document: m.document,
    birthdate: m.birthdate,
    gender: m.gender,
    phone: m.phone,
    group_name: m.groupName,
    unit: m.unit,
    function_name: m.functionName,
    status: m.status,
    enrollment_year: m.enrollmentYear,
    updated_at: new Date().toISOString(),
  }));

  // Se guarda en lotes: un reporte regional completo puede tener miles de filas.
  const BATCH = 200;
  let upserted = 0;
  const runtimeIssues: RegionalImportIssue[] = [...issues];

  for (let start = 0; start < payload.length; start += BATCH) {
    const batch = payload.slice(start, start + BATCH);
    const { error } = await supabase.from('regional_members').upsert(batch, { onConflict: 'scout_id' });

    if (error) {
      runtimeIssues.push({
        row: valid[start]?.row ?? 0,
        column: 'GENERAL',
        message: `Lote ${Math.floor(start / BATCH) + 1}: ${error.message}`,
      });
    } else {
      upserted += batch.length;
    }
  }

  await supabase.rpc('log_audit', {
    p_action: `Actualizó la base regional (${upserted} registro(s))`,
    p_entity_type: 'regional_members',
    p_metadata: { total: rows.length, omitidos: rows.length - upserted },
  });

  revalidatePath('/admin/participantes');

  return {
    upserted,
    failed: rows.length - upserted,
    message:
      upserted === rows.length
        ? `Se actualizaron ${upserted} registros de la base regional.`
        : `Se actualizaron ${upserted} de ${rows.length}. ${rows.length - upserted} fila(s) quedaron fuera.`,
    issues: runtimeIssues,
  };
}
