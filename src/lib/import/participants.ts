import Papa from 'papaparse';
import type { DocumentType, Gender } from '@/types/database';
import { ageOn, branchesForAge, type AgeBracket } from '@/lib/domain/competitions';

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
  'ID_SCOUT',
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

/** Datos de la base regional usados para completar una fila incompleta. */
export interface RegionalMemberLookup {
  fullName: string;
  document: string;
  birthdate: string | null;
  gender: Gender | null;
  unit: string;
  functionName: string;
  status: string;
  enrollmentYear: string;
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
   * CODIGO_GRUPO se ignora. Es el caso de un grupo importando su propia gente,
   * o de un administrador que fija el grupo a mano para un archivo simple que
   * no trae esa columna.
   */
  forceGroupId?: string;
  /**
   * Base regional de miembros (`regional_members`), por Id Scout, para
   * completar documento, nacimiento y género cuando el archivo no los trae.
   */
  regionalMembers?: ReadonlyMap<number, RegionalMemberLookup>;
  /** Ramas con su rango de edad, para deducir la rama cuando falte en el archivo. */
  branchAgeRanges?: readonly AgeBracket[];
}

export const DOC_TYPE_OPTIONS = ['RC', 'TI', 'CC', 'CE', 'PA', 'PEP'] as const;
export const GENDER_OPTIONS = ['F', 'M', 'O'] as const;

const DOC_TYPES = new Set<string>(DOC_TYPE_OPTIONS);
const GENDERS = new Set<string>(GENDER_OPTIONS);

/** Tipo de documento colombiano típico según la edad, cuando el archivo no lo indica. */
export function docTypeFromAge(age: number): DocumentType {
  if (age < 7) return 'RC';
  if (age < 18) return 'TI';
  return 'CC';
}

/**
 * Año de inscripción del evento. Alguien de la base regional solo cuenta
 * como candidato válido si está inscrito para este año Y activo — igual que
 * hace la herramienta externa que ya usa la organización para este cruce.
 */
export const CURRENT_ENROLLMENT_YEAR = '2026';

function normalizeRoleText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Deduce la rama a partir del cargo (UNIDAD + FUNCIÓN) de la base regional,
 * en vez de la fecha de nacimiento. Es la misma lógica de la herramienta
 * externa que ya usa la organización para este cruce: el cargo pesa más que
 * la unidad (alguien puede ser, por ejemplo, "Jefe de Tropa" sin ser un
 * scout de esa tropa), y solo si no hay ningún cargo de liderazgo reconocido
 * se mira la unidad. Si nada coincide, cae en "adultos".
 */
export function branchFromRole(unit: string, functionName: string): string {
  const u = normalizeRoleText(unit);
  const f = normalizeRoleText(functionName);

  if (f.includes('JEFE DE GRUPO') || f.includes('DIRECTOR DE GRUPO')) return 'jefe-de-grupo';
  if (f.includes('CONSEJO')) return 'consejero';
  if (/JEFE|SUB[- ]?JEFE|SCOUTER|DIRIGENTE/.test(f)) return 'jefatura';
  if (/CACHORR|CASTOR/.test(u) || /CACHORR|CASTOR/.test(f)) return 'cachorros';
  if (/MANADA|LOBATO/.test(u) || /LOBATO/.test(f)) return 'lobatos';
  if (/WEBELO/.test(u) || /WEBELO/.test(f)) return 'webelos';
  if (/TROPA|SCOUT/.test(u) || f === 'SCOUT') return 'scouts';
  if (/COMUNIDAD|NOMADA/.test(u) || /NOMADA/.test(f)) return 'nomadas';
  if (/CLAN|ROVER/.test(u) || /ROVER/.test(f)) return 'rovers';
  return 'adultos';
}

/**
 * Separa un nombre completo en nombres y apellidos, con la convención
 * colombiana de que los últimos dos términos son los apellidos (ej. "María
 * Fernanda Ríos Gómez" → nombres "María Fernanda", apellidos "Ríos Gómez").
 * Con dos palabras se reparte una y una; con una sola, todo queda en nombres.
 */
export function splitFullName(fullName: string): { firstNames: string; lastNames: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstNames: '', lastNames: '' };
  if (parts.length === 1) return { firstNames: parts[0] ?? '', lastNames: '' };
  if (parts.length === 2) return { firstNames: parts[0] ?? '', lastNames: parts[1] ?? '' };
  return {
    firstNames: parts.slice(0, -2).join(' '),
    lastNames: parts.slice(-2).join(' '),
  };
}

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

export function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * Valida y convierte las filas crudas en participantes listos para insertar.
 *
 * Si la fila trae ID_SCOUT y `context.regionalMembers` tiene ese Id Scout, los
 * campos que el archivo no traiga (documento, fecha de nacimiento, nombres,
 * apellidos, género, rama) se completan con la base regional antes de
 * validar, en vez de exigir que vengan en el archivo.
 */
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

    // ─ Cruce con la base regional, por Id Scout ─
    const scoutIdRaw = cleanText(values.ID_SCOUT);
    const scoutIdWellFormed = scoutIdRaw !== '' && Number.isInteger(Number(scoutIdRaw)) && Number(scoutIdRaw) > 0;
    const scoutId = scoutIdWellFormed ? Number(scoutIdRaw) : null;
    const regional = scoutId !== null ? context.regionalMembers?.get(scoutId) : undefined;

    // Solo cuenta como candidato válido si la base regional lo tiene como
    // activo e inscrito este año: alguien puede aparecer en el reporte
    // regional sin estar habilitado para el evento de este año.
    const regionalEligible =
      !!regional &&
      normalizeRoleText(regional.status) === 'ACTIVO' &&
      regional.enrollmentYear.trim() === CURRENT_ENROLLMENT_YEAR;
    const effectiveRegional = regionalEligible ? regional : undefined;

    // Explica, cuando falta un dato, por qué no se pudo completar solo desde
    // la base regional: ayuda a distinguir "no escribiste el Id Scout" de "el
    // Id Scout no aparece en la base regional cargada" (que suele significar
    // que la base está desactualizada, o que a esta persona le falta ese dato
    // allá también) de "está en la base pero no activo/inscrito este año".
    const regionalHint = !scoutIdRaw
      ? 'No hay Id Scout en esta fila: agrégalo para que la plataforma la busque en la base regional.'
      : !scoutIdWellFormed
        ? `"${scoutIdRaw}" no es un Id Scout válido, así que no se pudo buscar en la base regional.`
        : !regional
          ? `No se encontró el Id Scout ${scoutId} en la base regional (revisa que esté actualizada, o completa el dato a mano).`
          : !regionalEligible
            ? `El Id Scout ${scoutId} está en la base regional, pero no figura activo e inscrito en ${CURRENT_ENROLLMENT_YEAR} (estado: "${regional.status || 'sin dato'}", inscripción: "${regional.enrollmentYear || 'sin dato'}"). Complétalo a mano si de verdad debe participar.`
            : null;

    // ─ Fecha de nacimiento: del archivo, o de la base regional si falta ─
    const birthdateFileRaw = cleanText(values.FECHA_NACIMIENTO);
    const birthdate = normalizeDate(values.FECHA_NACIMIENTO) ?? effectiveRegional?.birthdate ?? null;
    if (!birthdate) {
      const base = birthdateFileRaw
        ? `"${birthdateFileRaw}" no es una fecha válida (usa AAAA-MM-DD o DD/MM/AAAA).`
        : 'Falta la fecha de nacimiento.';
      rowIssues.push({
        row,
        column: 'FECHA_NACIMIENTO',
        message: regionalHint ? `${base} ${regionalHint}` : `${base} Tampoco está en la base regional para esta persona.`,
      });
    } else if (new Date(`${birthdate}T00:00:00`) >= new Date()) {
      rowIssues.push({
        row,
        column: 'FECHA_NACIMIENTO',
        message: 'La fecha de nacimiento no puede ser futura.',
      });
    } else if (new Date(`${birthdate}T00:00:00`) <= new Date('1950-01-01T00:00:00')) {
      // La base de datos exige birthdate > 1950-01-01. Sin este chequeo aquí,
      // una sola fila con un dato mal digitado (ej. la base regional trae una
      // fecha del 1900) tumba TODO el lote de inserción sin explicación clara.
      rowIssues.push({
        row,
        column: 'FECHA_NACIMIENTO',
        message: `"${birthdate}" es anterior a 1950: revisa si el dato está mal digitado (en el archivo o en la base regional).`,
      });
    }

    // ─ Tipo de documento: del archivo, o deducido de la edad ─
    const docTypeFile = cleanText(values.TIPO_DOCUMENTO).toUpperCase();
    const docTypeRaw = docTypeFile || (birthdate ? docTypeFromAge(ageOn(birthdate)) : 'TI');
    if (!DOC_TYPES.has(docTypeRaw)) {
      rowIssues.push({
        row,
        column: 'TIPO_DOCUMENTO',
        message: `"${docTypeRaw}" no es un tipo válido (RC, TI, CC, CE, PA, PEP).`,
      });
    }

    // ─ Número de documento: del archivo, o de la base regional si falta ─
    const document = cleanText(values.NUMERO_DOCUMENTO) || effectiveRegional?.document || '';
    if (!document) {
      rowIssues.push({
        row,
        column: 'NUMERO_DOCUMENTO',
        message: regionalHint
          ? `El documento está vacío. ${regionalHint}`
          : 'El documento está vacío y tampoco está en la base regional para esta persona.',
      });
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

    // ─ Nombres y apellidos ─
    // La columna APELLIDOS es opcional en la plantilla (el archivo simple que
    // entrega cada grupo no la trae): si el archivo NO tiene esa columna, la
    // columna "Nombres" tiene en la práctica el nombre completo, así que no
    // es confiable tomarla tal cual como "solo nombres" y pegarle apellidos
    // de otro lado (eso duplicaba el nombre). En ese caso se reparte el
    // nombre completo, prefiriendo el de la base regional si hay.
    //
    // Si el archivo SÍ tiene columna APELLIDOS (aunque venga vacía en esta
    // fila), se respeta la separación que trae y solo se completa lo que
    // falte con la base regional, como antes.
    const apellidosColumnPresent = values.APELLIDOS !== undefined;
    const nombresFile = cleanText(values.NOMBRES);
    const apellidosFile = cleanText(values.APELLIDOS);

    let firstNames: string;
    let lastNames: string;
    if (apellidosColumnPresent) {
      firstNames = nombresFile;
      lastNames = apellidosFile;
      if ((!firstNames || !lastNames) && effectiveRegional?.fullName) {
        const split = splitFullName(effectiveRegional.fullName);
        firstNames = firstNames || split.firstNames;
        lastNames = lastNames || split.lastNames;
      }
    } else {
      const fullNameSource = effectiveRegional?.fullName || nombresFile;
      const split = splitFullName(fullNameSource);
      firstNames = split.firstNames;
      lastNames = split.lastNames;
    }
    if (firstNames.length < 2) {
      rowIssues.push({
        row,
        column: 'NOMBRES',
        message: regionalHint ? `Escribe los nombres completos. ${regionalHint}` : 'Escribe los nombres completos.',
      });
    }
    if (lastNames.length < 2) {
      rowIssues.push({
        row,
        column: 'APELLIDOS',
        message: regionalHint ? `Escribe los apellidos completos. ${regionalHint}` : 'Escribe los apellidos completos.',
      });
    }

    // ─ Rama: del archivo; si no, por el cargo (base regional); si no, por edad ─
    let branchId = cleanText(values.RAMA).toLowerCase();
    if (!branchId && effectiveRegional) {
      branchId = branchFromRole(effectiveRegional.unit, effectiveRegional.functionName);
    }
    if (!branchId && birthdate && context.branchAgeRanges) {
      const candidates = branchesForAge(birthdate, context.branchAgeRanges);
      if (candidates.length === 1 && candidates[0]) branchId = candidates[0].id;
    }
    if (!branchId) {
      const reason = !birthdate
        ? 'no hay fecha de nacimiento para deducirla'
        : 'no hay ninguna rama configurada para esa edad, o hay más de una posible';
      rowIssues.push({
        row,
        column: 'RAMA',
        message: regionalHint
          ? `La rama está vacía: ${reason}. ${regionalHint}`
          : `La rama está vacía: ${reason}. Escríbela a mano en la columna RAMA.`,
      });
    } else if (!context.branchIds.has(branchId)) {
      rowIssues.push({
        row,
        column: 'RAMA',
        message: `"${branchId}" no corresponde a una rama configurada.`,
      });
    }

    // ─ Género: del archivo, o de la base regional si falta ─
    const genderRaw = cleanText(values.GENERO).toUpperCase() || (effectiveRegional?.gender ?? '');
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
    '',
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
