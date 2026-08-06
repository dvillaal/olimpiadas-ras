import ExcelJS from 'exceljs';
import { normalizeHeader, type ParticipantColumn, type RawRow } from './participants';
import { PARTICIPANT_COLUMNS } from './participants';

/**
 * Lectura y escritura de la plantilla en Excel.
 *
 * ExcelJS se ejecuta igual en el navegador y en Node, así que la
 * previsualización de la importación puede hacerse sin subir el archivo.
 */

/** Convierte una celda de ExcelJS a texto plano, sin fórmulas ni objetos. */
function cellToString(value: ExcelJS.CellValue): string {
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

/** Lee la primera hoja del libro y devuelve filas normalizadas. */
export async function parseXlsx(buffer: ArrayBuffer): Promise<RawRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: (ParticipantColumn | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const name = normalizeHeader(cellToString(cell.value));
    headers[colNumber] = (PARTICIPANT_COLUMNS as readonly string[]).includes(name)
      ? (name as ParticipantColumn)
      : null;
  });

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const values: Partial<Record<ParticipantColumn, string>> = {};
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
    { header: 'TIPO_DOCUMENTO', key: 'TIPO_DOCUMENTO', width: 16 },
    { header: 'NUMERO_DOCUMENTO', key: 'NUMERO_DOCUMENTO', width: 20 },
    { header: 'NOMBRES', key: 'NOMBRES', width: 24 },
    { header: 'APELLIDOS', key: 'APELLIDOS', width: 24 },
    { header: 'FECHA_NACIMIENTO', key: 'FECHA_NACIMIENTO', width: 20 },
    { header: 'RAMA', key: 'RAMA', width: 16 },
    { header: 'GENERO', key: 'GENERO', width: 10 },
    { header: 'TELEFONO', key: 'TELEFONO', width: 16 },
    { header: 'CORREO', key: 'CORREO', width: 28 },
    { header: 'ESTADO', key: 'ESTADO', width: 12 },
    { header: 'OBSERVACIONES', key: 'OBSERVACIONES', width: 40 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126B43' } };
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  sheet.addRow({
    CODIGO_GRUPO: options.groupCodes[0]?.code ?? 'GS-001',
    TIPO_DOCUMENTO: 'TI',
    NUMERO_DOCUMENTO: '1234567890',
    NOMBRES: 'María Fernanda',
    APELLIDOS: 'Ríos Gómez',
    FECHA_NACIMIENTO: '2012-05-20',
    RAMA: options.branchIds[0] ?? 'tropa',
    GENERO: 'F',
    TELEFONO: '3000000000',
    CORREO: 'correo@ejemplo.com',
    ESTADO: 'ACTIVO',
    OBSERVACIONES: 'Fila de ejemplo: bórrala antes de importar',
  });

  sheet.getRow(2).font = { italic: true, color: { argb: 'FF64748B' } };

  // Listas desplegables sobre un rango generoso de filas.
  const lastRow = 500;
  const listFormula = (values: readonly string[]) => [`"${values.join(',')}"`];

  for (let row = 2; row <= lastRow; row += 1) {
    sheet.getCell(`B${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: listFormula(['RC', 'TI', 'CC', 'CE', 'PA', 'PEP']),
      showErrorMessage: true,
      errorTitle: 'Tipo de documento',
      error: 'Elige uno de la lista: RC, TI, CC, CE, PA o PEP.',
    };
    sheet.getCell(`G${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: listFormula(options.branchIds),
      showErrorMessage: true,
      errorTitle: 'Rama',
      error: 'Elige una de las ramas configuradas por la organización.',
    };
    sheet.getCell(`H${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: listFormula(['F', 'M', 'O']),
    };
    sheet.getCell(`K${row}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: listFormula(['ACTIVO', 'INACTIVO']),
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
    sheet.getCell(`C${row}`).numFmt = '@';
    sheet.getCell(`I${row}`).numFmt = '@';
  }

  // ─── Hoja de instrucciones ───────────────────────────────────────────────
  const help = workbook.addWorksheet('Instrucciones');
  help.columns = [{ width: 22 }, { width: 96 }];

  const lines: [string, string][] = [
    ['Columna', 'Qué escribir'],
    ['CODIGO_GRUPO', 'Código del grupo scout, por ejemplo GS-001. Debe existir y estar aprobado.'],
    ['TIPO_DOCUMENTO', 'RC, TI, CC, CE, PA o PEP.'],
    ['NUMERO_DOCUMENTO', 'Entre 3 y 20 caracteres. Único por tipo de documento.'],
    ['NOMBRES', 'Nombres completos, mínimo 2 caracteres.'],
    ['APELLIDOS', 'Apellidos completos, mínimo 2 caracteres.'],
    ['FECHA_NACIMIENTO', 'AAAA-MM-DD (por ejemplo 2012-05-20) o DD/MM/AAAA.'],
    ['RAMA', `Una de: ${options.branchIds.join(', ')}.`],
    ['GENERO', 'F, M u O. Puede quedar vacío.'],
    ['TELEFONO', 'Entre 7 y 20 dígitos. Puede quedar vacío.'],
    ['CORREO', 'Correo válido. Puede quedar vacío.'],
    ['ESTADO', 'ACTIVO o INACTIVO. Un participante inactivo no puede inscribirse.'],
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
