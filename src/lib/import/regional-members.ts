import Papa from 'papaparse';
import type { Gender } from '@/types/database';
import { cleanText, normalizeDate, normalizeHeader } from './participants';

/**
 * Carga de la base regional de miembros activos (`regional_members`).
 *
 * Es el mismo reporte completo que reparte la región (28 columnas y miles de
 * filas): aquí solo se leen las columnas que la plataforma necesita para
 * completar automáticamente al importar participantes por Id Scout. El resto
 * de columnas del archivo se ignoran sin error.
 *
 * A diferencia de la importación de participantes, esto no es un registro
 * definitivo de inscripción: es una tabla de referencia que se reemplaza cada
 * vez que llega una versión más nueva, así que la validación es más laxa (solo
 * exige Id Scout y nombre).
 */

export const REGIONAL_MEMBER_COLUMNS = [
  'ID_SCOUT',
  'NOMBRE',
  'DOCUMENTO',
  'FECHA_DE_NACIMIENTO',
  'GENERO',
  'TELEFONO_1',
  'GRUPO',
  'UNIDAD',
  'FUNCION',
  'ESTADO',
  'INSCRIPCION',
] as const;

export type RegionalMemberColumn = (typeof REGIONAL_MEMBER_COLUMNS)[number];

export interface RawRegionalRow {
  row: number;
  values: Partial<Record<RegionalMemberColumn, string>>;
}

export interface ParsedRegionalMember {
  row: number;
  scoutId: number;
  fullName: string;
  document: string;
  birthdate: string | null;
  gender: Gender | null;
  phone: string;
  groupName: string;
  unit: string;
  functionName: string;
  status: string;
  /** Año para el que la región tiene inscrita a esta persona (columna "Inscripción"). */
  enrollmentYear: string;
}

export interface RegionalImportIssue {
  row: number;
  column: RegionalMemberColumn | 'GENERAL';
  message: string;
}

export interface RegionalImportResult {
  valid: ParsedRegionalMember[];
  issues: RegionalImportIssue[];
  totalRows: number;
}

function normalizeGender(raw: string): Gender | null {
  const value = raw.trim().toUpperCase();
  if (value === 'F' || value === 'FEMENINO') return 'F';
  if (value === 'M' || value === 'MASCULINO') return 'M';
  if (value === 'O' || value === 'OTRO') return 'O';
  return null;
}

/** Analiza un CSV del reporte regional respetando comillas y `,`/`;`. */
export function parseRegionalCsv(text: string): RawRegionalRow[] {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
    delimitersToGuess: [';', ',', '\t', '|'],
  });

  return result.data.map((values, index) => ({
    row: index + 2,
    values: values as Partial<Record<RegionalMemberColumn, string>>,
  }));
}

/**
 * Valida y convierte las filas crudas del reporte regional.
 *
 * Solo el Id Scout y el nombre son obligatorios: el resto de campos son la
 * información de referencia que se guarda tal cual venga, o vacía/nula si no
 * viene, sin bloquear la fila por eso.
 */
export function validateRegionalRows(rows: readonly RawRegionalRow[]): RegionalImportResult {
  const valid: ParsedRegionalMember[] = [];
  const issues: RegionalImportIssue[] = [];
  const seenInFile = new Set<number>();

  for (const { row, values } of rows) {
    const rowIssues: RegionalImportIssue[] = [];

    const scoutIdRaw = cleanText(values.ID_SCOUT);
    const scoutId = Number(scoutIdRaw);
    const scoutIdValid = scoutIdRaw !== '' && Number.isInteger(scoutId) && scoutId > 0;

    if (!scoutIdValid) {
      rowIssues.push({
        row,
        column: 'ID_SCOUT',
        message: 'El Id Scout está vacío o no es un número válido.',
      });
    } else if (seenInFile.has(scoutId)) {
      rowIssues.push({
        row,
        column: 'ID_SCOUT',
        message: 'Este Id Scout aparece repetido dentro del archivo.',
      });
    }

    const fullName = cleanText(values.NOMBRE);
    if (fullName.length < 2) {
      rowIssues.push({ row, column: 'NOMBRE', message: 'El nombre está vacío.' });
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      continue;
    }

    seenInFile.add(scoutId);

    valid.push({
      row,
      scoutId,
      fullName,
      document: cleanText(values.DOCUMENTO),
      birthdate: normalizeDate(values.FECHA_DE_NACIMIENTO),
      gender: normalizeGender(cleanText(values.GENERO)),
      phone: cleanText(values.TELEFONO_1),
      groupName: cleanText(values.GRUPO),
      unit: cleanText(values.UNIDAD),
      functionName: cleanText(values.FUNCION),
      status: cleanText(values.ESTADO),
      enrollmentYear: cleanText(values.INSCRIPCION),
    });
  }

  return { valid, issues, totalRows: rows.length };
}
