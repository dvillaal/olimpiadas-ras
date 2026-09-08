import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { normalizeHeader, type ParticipantColumn, type RawRow } from './participants';
import { PARTICIPANT_COLUMNS } from './participants';

/**
 * Lectura y escritura de la plantilla en Excel.
 *
 * ExcelJS se ejecuta igual en el navegador y en Node, así que la
 * previsualización de la importación puede hacerse sin subir el archivo.
 */

/**
 * Algunos exportadores (por ejemplo el reporte regional de SISCOUT) generan el
 * XML interno del .xlsx con todas las etiquetas bajo un prefijo de espacio de
 * nombres, como `<x:workbook>` en vez de `<workbook>`. Es un XML válido, pero
 * el analizador de ExcelJS busca los nombres de etiqueta tal cual (sin
 * resolver el prefijo) y no encuentra nada, así que revienta con un mensaje
 * confuso ("Cannot read properties of undefined (reading 'sheets')") en vez de
 * avisar que el archivo no es compatible.
 *
 * Antes de pasarle el archivo a ExcelJS, se le quita ese prefijo a las
 * etiquetas de cada XML interno. Si el archivo ya usa el espacio de nombres
 * por defecto (como los que produce Excel o Google Sheets), esto no cambia
 * nada.
 */
async function normalizeNamespacedXlsx(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const workbookEntry = zip.file('xl/workbook.xml');
    if (!workbookEntry) return buffer;

    const workbookXml = await workbookEntry.async('string');
    const match = workbookXml.match(/<([A-Za-z0-9_]+):workbook\b/);
    if (!match) return buffer; // Ya usa el espacio de nombres por defecto.

    const prefix = match[1];
    const openTag = new RegExp(`<${prefix}:`, 'g');
    const closeTag = new RegExp(`</${prefix}:`, 'g');

    const xmlEntries = Object.values(zip.files).filter(
      (entry) => !entry.dir && entry.name.endsWith('.xml'),
    );

    for (const entry of xmlEntries) {
      const text = await entry.async('string');
      if (!text.includes(`<${prefix}:`)) continue;
      zip.file(entry.name, text.replace(openTag, '<').replace(closeTag, '</'));
    }

    return await zip.generateAsync({ type: 'arraybuffer' });
  } catch {
    // Si algo falla al normalizar, se sigue con el archivo original: que sea
    // ExcelJS quien reporte el error real.
    return buffer;
  }
}

/** Convierte una celda de ExcelJS a texto plano, sin fórmulas ni objetos. */
export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return String(value.result ?? '');
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('');
    }
    if ('hyperlink' in value && 'text' in value) return String(value.text ?? '');
  }
  return String(value);
}

export interface XlsxRow<C extends string> {
  row: number;
  values: Partial<Record<C, string>>;
}

/**
 * Busca cuál de las primeras filas es el encabezado real, contando cuántas
 * celdas coinciden con `allowedColumns` en cada una. Algunos reportes (como el
 * regional de SISCOUT) traen una o dos filas de título antes del encabezado,
 * en vez de empezar los datos en la fila 1.
 */
function detectHeaderRow<C extends string>(
  sheet: ExcelJS.Worksheet,
  allowedColumns: readonly C[],
  scanLimit = 10,
): number {
  let bestRow = 1;
  let bestScore = -1;

  for (let r = 1; r <= scanLimit; r += 1) {
    let score = 0;
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      const name = normalizeHeader(cellToString(cell.value));
      if ((allowedColumns as readonly string[]).includes(name)) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  return bestRow;
}

/**
 * Lee la primera hoja del libro y devuelve filas normalizadas, quedándose solo
 * con las columnas de `allowedColumns` (el resto se ignora en silencio, así
 * sirve para leer archivos con muchas más columnas de las que hacen falta,
 * como el reporte regional completo).
 */
export async function parseXlsxColumns<C extends string>(
  buffer: ArrayBuffer,
  allowedColumns: readonly C[],
): Promise<XlsxRow<C>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await normalizeNamespacedXlsx(buffer));

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRowNumber = detectHeaderRow(sheet, allowedColumns);
  const headerRow = sheet.getRow(headerRowNumber);
  const headers: (C | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const name = normalizeHeader(cellToString(cell.value));
    headers[colNumber] = (allowedColumns as readonly string[]).includes(name) ? (name as C) : null;
  });

  const rows: XlsxRow<C>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const values: Partial<Record<C, string>> = {};
    let hasContent = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const column = headers[colNumber];
      if (!column) return;
      const text = cellToString(cell.value).trim();
      if (text) hasContent = true;
      values[column] = text;
    });

    // Excel suele arrastrar filas vacías con formato: se descartan.
    if (hasContent) rows.push({ row: rowNumber, values });
  });

  return rows;
}

/** Lee la primera hoja del libro y devuelve filas de participantes normalizadas. */
export async function parseXlsx(buffer: ArrayBuffer): Promise<RawRow[]> {
  return parseXlsxColumns<ParticipantColumn>(buffer, PARTICIPANT_COLUMNS);
}

export interface TemplateOptions {
  groupCodes: readonly { code: string; name: string }[];
  branchIds: readonly string[];
}

/**
 * Construye la plantilla .xlsx con instrucciones, listas desplegables y
 * validación de datos, para que el diligenciamiento falle lo menos posible.
 */
export async function buildTemplateXlsx(options: TemplateOptions): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Olimpiadas Scouts';
  workbook.created = new Date();

  // ─── Hoja de datos ───────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet('Participantes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'CODIGO_GRUPO', key: 'CODIGO_GRUPO', width: 16 },
    { header: 'ID_SCOUT', key: 'ID_SCOUT', width: 14 },
    { header: 'TIPO_DOCUMENTO', key: 'TIPO_DOCUMENTO', width: 16 },
    { header: 'NUMERO_DOCUMENTO', key: 'NUMERO_DOCUMENTO', width: 20 },
    { header: 'NOMBRES', key: 'NOMBRES', width: 24 },
    { header: 'APELLIDOS', key: 'APELLIDOS', width: 24 },
    { header: 'FECHA_NACIMIENTO', key: 'FECHA_NACIMIENTO', width: 20 },
    { header: 'RAMA', key: 'RAMA', width: 16 },
    { header: 'GENERO', key: 'GENERO', width: 10 },
    { header: 'OBSERVACIONES', key: 'OBSERVACIONES', width: 40 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126B43' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  sheet.addRow({
    CODIGO_GRUPO: options.groupCodes[0]?.code ?? 'GS-001',
    ID_SCOUT: '',
    TIPO_DOCUMENTO: 'TI',
    NUMERO_DOCUMENTO: '1234567890',
    NOMBRES: 'María Fernanda',
    APELLIDOS: 'Ríos Gómez',
    FECHA_NACIMIENTO: '2012-05-20',
    RAMA: options.branchIds[0] ?? 'tropa',
    GENERO: 'F',
    OBSERVACIONES: 'Fila de ejemplo: bórrala antes de importar',
  });

  sheet.getRow(2).font = { italic: true, color: { argb: 'FF64748B' } };

  // Listas desplegables sobre un rango generoso de filas.
  const lastRow = 500;
  const listFormula = (values: readonly string[]) => [`"${values.join(',')}"`];

  for (let row = 2; row <= lastRow; row += 1) {
    sheet.getCell(`C${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: listFormula(['RC', 'TI', 'CC', 'CE', 'PA', 'PEP']),
      showErrorMessage: true,
      errorTitle: 'Tipo de documento',
      error: 'Elige uno de la lista: RC, TI, CC, CE, PA o PEP.',
    };
    sheet.getCell(`H${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: listFormula(options.branchIds),
      showErrorMessage: true,
      errorTitle: 'Rama',
      error: 'Elige una de las ramas configuradas por la organización.',
    };
    sheet.getCell(`I${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: listFormula(['F', 'M', 'O']),
    };
    if (options.groupCodes.length > 0) {
      sheet.getCell(`A${row}`).dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: listFormula(options.groupCodes.map((g) => g.code)),
        showErrorMessage: true,
        errorTitle: 'Código de grupo',
        error: 'Elige un grupo aprobado de la lista.',
      };
    }
    // El texto evita que Excel convierta documentos largos a notación científica.
    sheet.getCell(`D${row}`).numFmt = '@';
  }

  // ─── Hoja de instrucciones ───────────────────────────────────────────────
  const help = workbook.addWorksheet('Instrucciones');
  help.columns = [{ width: 22 }, { width: 96 }];

  const lines: [string, string][] = [
    ['Columna', 'Qué escribir'],
    ['CODIGO_GRUPO', 'Código del grupo scout, por ejemplo GS-001. Debe existir y estar aprobado.'],
    [
      'ID_SCOUT',
      'Opcional. El Id Scout con el que la región identifica a la persona. Si lo escribes, la plataforma completa sola el documento, la fecha de nacimiento, el género y la rama que falten, buscando en la base regional.',
    ],
    ['TIPO_DOCUMENTO', 'RC, TI, CC, CE, PA o PEP. Si lo dejas vacío, se calcula según la edad.'],
    ['NUMERO_DOCUMENTO', 'Entre 3 y 20 caracteres. Único por tipo de documento. Puede completarse solo con el Id Scout.'],
    ['NOMBRES', 'Nombres completos, mínimo 2 caracteres. Puede completarse solo con el Id Scout.'],
    ['APELLIDOS', 'Apellidos completos, mínimo 2 caracteres. Puede completarse solo con el Id Scout.'],
    ['FECHA_NACIMIENTO', 'AAAA-MM-DD (por ejemplo 2012-05-20) o DD/MM/AAAA. Puede completarse solo con el Id Scout.'],
    ['RAMA', `Una de: ${options.branchIds.join(', ')}. Si la dejas vacía, se intenta deducir de la edad.`],
    ['GENERO', 'F, M u O. Puede quedar vacío o completarse solo con el Id Scout.'],
    ['OBSERVACIONES', 'Texto libre: alergias, dieta, condiciones médicas. Admite comas y puntos y coma.'],
  ];

  lines.forEach(([a, b], index) => {
    const row = help.addRow([a, b]);
    if (index === 0) {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126B43' } };
    }
    row.alignment = { vertical: 'top', wrapText: true };
  });

  help.addRow([]);
  help.addRow(['Importante', 'Borra la fila de ejemplo antes de importar. No cambies los encabezados.']);

  if (options.groupCodes.length > 0) {
    help.addRow([]);
    help.addRow(['Grupos disponibles', '']).font = { bold: true };
    for (const group of options.groupCodes) {
      help.addRow([group.code, group.name]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
