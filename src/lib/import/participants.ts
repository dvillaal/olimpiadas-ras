import Papa from 'papaparse';
import type { DocumentType, Gender } from '@/types/database';

/**
 * Importación de participantes desde CSV o Excel.
 *
 * El prototipo partía las líneas con `split(';')`, así que cualquier
 * observación con un punto y coma o una coma corrompía toda la fila. Aquí el
 * CSV lo analiza Papa Parse (respeta comillas, saltos de línea dentro de campo
 * y detecta el separador solo) y el XLSX lo lee ExcelJS.
 */

export const PARTICIPANT_COLUMNS = [
  'CODIGO_GRUPO',
  'TIPO_DOCUMENTO',
  'NUMERO_DOCUMENTO',
  'NOMBRES',
  'APELLIDOS',
  'FECHA_NACIMIENTO',
  'RAMA',
  'GENERO',
  'OBSERVACIONES',
] as const;

export type ParticipantColumn = (typeof PARTICIPANT_COLUMNS)[number];

export interface RawRow {
  row: number;
  values: Partial<Record<ParticipantColumn, string>>;
}

export interface ParsedParticipant {
  row: number;
  groupCode: string;
  groupId: string | null;
  docType: DocumentType;
  document: string;
  firstNames: string;
  lastNames: string;
  fullName: string;
  birthdate: string;
  branchId: string;
  gender: Gender | null;
  active: boolean;
  notes: string;
}

export interface ImportIssue {
  row: number;
  column: ParticipantColumn | 'GENERAL';
  message: string;
}

export interface ImportResult {
  valid: ParsedParticipant[];
  issues: ImportIssue[];
  totalRows: number;
}

export interface ImportContext {
  /** Código de grupo → id. Para el administrador: todos los grupos aprobados. */
  groupsByCode: ReadonlyMap<string, string>;
  /** Ramas válidas (ids en minúscula). */
  branchIds: ReadonlySet<string>;
  /** Documentos ya existentes, como "TI:1001", para detectar duplicados. */
  existingDocuments: ReadonlySet<string>;
  /**
   * Si se define, todas las filas se asignan a este grupo y la columna
   * CODIGO_GRUPO se ignora. Es el caso de un grupo importando su propia gente.
   */
  forceGroupId?: string;
}

const DOC_TYPES = new Set<string>(['RC', 'TI', 'CC', 'CE', 'PA', 'PEP']);
const GENDERS = new Set<string>(['F', 'M', 'O']);

/**
 * Encabezados tolerantes: quita el BOM, los acentos y normaliza espacios, para
 * que "Número documento", "NUMERO_DOCUMENTO" y "numero documento" sean lo mismo.
 */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^﻿/, '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s.-]+/g, '_');
}

/** Analiza un CSV respetando comillas y detectando `,` o `;` automáticamente. */
export function parseCsv(text: string): RawRow[] {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
    // Papa detecta el delimitador; se lo acotamos a los que usa la plantilla.
    delimitersToGuess: [';', ',', '\t', '|'],
  });

  return result.data.map((values, index) => ({
    row: index + 2, // +1 por el encabezado, +1 porque las hojas empiezan en 1
    values: values as Partial<Record<ParticipantColumn, string>>,
  }));
}

/**
 * Convierte una fecha de Excel o de texto al formato AAAA-MM-DD.
 * Acepta AAAA-MM-DD, DD/MM/AAAA y el número de serie de Excel.
 */
export function normalizeDate(input: unknown): string | null {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }

  const raw = String(input ?? '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return Number.isNaN(new Date(`${raw}T00:00:00`).getTime()) ? null : raw;
  }

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return Number.isNaN(new Date(`${iso}T00:00:00`).getTime()) ? null : iso;
  }

  // Número de serie de Excel: días desde el 30/12/1899.
  if (/^\d{5}$/.test(raw)) {
    const serial = Number(raw);
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  return null;
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

/** Valida y convierte las filas crudas en participantes listos para insertar. */
export function validateRows(rows: readonly RawRow[], context: ImportContext): ImportResult {
  const valid: ParsedParticipant[] = [];
  const issues: ImportIssue[] = [];
  // Los duplicados dentro del propio archivo también se detectan.
  const seenInFile = new Set<string>();

  for (const { row, values } of rows) {
    const rowIssues: ImportIssue[] = [];

    const groupCode = cleanText(values.CODIGO_GRUPO).toUpperCase();
    let groupId: string | null = context.forceGroupId ?? null;

    if (!context.forceGroupId) {
      groupId = context.groupsByCode.get(groupCode) ?? null;
      if (!groupCode) {
        rowIssues.push({ row, column: 'CODIGO_GRUPO', message: 'El código del grupo está vacío.' });
      } else if (!groupId) {
        rowIssues.push({
          row,
          column: 'CODIGO_GRUPO',
          message: `No existe un grupo aprobado con el código "${groupCode}".`,
        });
      }
    }

    const docTypeRaw = cleanText(values.TIPO_DOCUMENTO).toUpperCase() || 'TI';
    if (!DOC_TYPES.has(docTypeRaw)) {
      rowIssues.push({
        row,
        column: 'TIPO_DOCUMENTO',
        message: `"${docTypeRaw}" no es un tipo válido (RC, TI, CC, CE, PA, PEP).`,
      });
    }

    const document = cleanText(values.NUMERO_DOCUMENTO);
    if (!document) {
      rowIssues.push({ row, column: 'NUMERO_DOCUMENTO', message: 'El documento está vacío.' });
    } else if (!/^[A-Za-z0-9.-]{3,20}$/.test(document)) {
      rowIssues.push({
        row,
        column: 'NUMERO_DOCUMENTO',
        message: 'El documento solo admite letras, números, puntos y guiones (3 a 20).',
      });
    } else {
      const key = `${docTypeRaw}:${document}`;
      if (context.existingDocuments.has(key)) {
        rowIssues.push({
          row,
          column: 'NUMERO_DOCUMENTO',
          message: 'Este documento ya está registrado en el sistema.',
        });
      } else if (seenInFile.has(key)) {
        rowIssues.push({
          row,
          column: 'NUMERO_DOCUMENTO',
          message: 'Este documento aparece repetido dentro del archivo.',
        });
      }
      seenInFile.add(key);
    }

    const firstNames = cleanText(values.NOMBRES);
    const lastNames = cleanText(values.APELLIDOS);
    if (firstNames.length < 2) {
      rowIssues.push({ row, column: 'NOMBRES', message: 'Escribe los nombres completos.' });
    }
    if (lastNames.length < 2) {
      rowIssues.push({ row, column: 'APELLIDOS', message: 'Escribe los apellidos completos.' });
    }

    const birthdate = normalizeDate(values.FECHA_NACIMIENTO);
    if (!birthdate) {
      rowIssues.push({
        row,
        column: 'FECHA_NACIMIENTO',
        message: 'Fecha inválida. Usa AAAA-MM-DD o DD/MM/AAAA.',
      });
    } else if (new Date(`${birthdate}T00:00:00`) >= new Date()) {
      rowIssues.push({
        row,
        column: 'FECHA_NACIMIENTO',
        message: 'La fecha de nacimiento no puede ser futura.',
      });
    }

    const branchId = cleanText(values.RAMA).toLowerCase();
    if (!branchId) {
      rowIssues.push({ row, column: 'RAMA', message: 'La rama está vacía.' });
    } else if (!context.branchIds.has(branchId)) {
      rowIssues.push({
        row,
        column: 'RAMA',
        message: `"${branchId}" no corresponde a una rama configurada.`,
      });
    }

    const genderRaw = cleanText(values.GENERO).toUpperCase();
    if (genderRaw && !GENDERS.has(genderRaw)) {
      rowIssues.push({ row, column: 'GENERO', message: 'Usa F, M u O (o déjalo vacío).' });
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      continue;
    }

    valid.push({
      row,
      groupCode,
      groupId,
      docType: docTypeRaw as DocumentType,
      document,
      firstNames,
      lastNames,
      fullName: `${firstNames} ${lastNames}`,
      birthdate: birthdate as string,
      branchId,
      gender: genderRaw ? (genderRaw as Gender) : null,
      // Ya no se pide en la plantilla: todo participante importado entra activo.
      active: true,
      notes: cleanText(values.OBSERVACIONES),
    });
  }

  return { valid, issues, totalRows: rows.length };
}

/** Genera la plantilla CSV con BOM, para que Excel la abra en UTF-8. */
export function buildTemplateCsv(): string {
  const header = PARTICIPANT_COLUMNS.join(';');
  const example = [
    'GS-001',
    'TI',
    '1234567890',
    'María Fernanda',
    'Ríos Gómez',
    '2012-05-20',
    'tropa',
    'F',
    'Alergia a los frutos secos; requiere dieta especial',
  ]
    .map((cell) => (/[;,"\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
    .join(';');

  return `﻿${header}\n${example}\n`;
}

/** Convierte los problemas encontrados en un CSV descargable. */
export function issuesToCsv(issues: readonly ImportIssue[]): string {
  const rows = issues.map((i) =>
    [i.row, i.column, `"${i.message.replace(/"/g, '""')}"`].join(';'),
  );
  return `﻿FILA;COLUMNA;PROBLEMA\n${rows.join('\n')}\n`;
}
