import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseXlsxColumns } from '@/lib/import/xlsx';
import { PARTICIPANT_COLUMNS } from '@/lib/import/participants';
import { REGIONAL_MEMBER_COLUMNS } from '@/lib/import/regional-members';

/**
 * Simula lo que hacen algunos exportadores (como el reporte regional de
 * SISCOUT): todas las etiquetas del XML interno bajo un prefijo de espacio de
 * nombres, en vez del espacio de nombres por defecto que produce Excel. Es
 * XML válido, pero rompía a ExcelJS antes de normalizarlo en `parseXlsxColumns`.
 */
async function addNamespacePrefix(buffer: ArrayBuffer, prefix = 'x'): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const xmlEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.startsWith('xl/') && entry.name.endsWith('.xml'),
  );

  for (const entry of xmlEntries) {
    const text = await entry.async('string');
    const declMatch = text.match(/^<\?xml[^>]*\?>/);
    const decl = declMatch ? declMatch[0] : '';
    const rest = text.slice(decl.length);
    const prefixed = rest.replace(/<(\/?)([A-Za-z])/g, `<$1${prefix}:$2`);
    zip.file(entry.name, decl + prefixed);
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

async function buildSimpleWorkbook(rows: { header: string; title?: string }): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Datos');

  if (rows.title) {
    sheet.addRow([rows.title]);
    sheet.addRow([]);
  }

  sheet.addRow(rows.header.split(';'));
  sheet.addRow(['GS-001', '555', 'TI', '1001', 'Ana', 'Ruiz', '2012-05-20', 'tropa', 'F', '']);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe('parseXlsxColumns', () => {
  const header =
    'CODIGO_GRUPO;ID_SCOUT;TIPO_DOCUMENTO;NUMERO_DOCUMENTO;NOMBRES;APELLIDOS;FECHA_NACIMIENTO;RAMA;GENERO;OBSERVACIONES';

  it('lee un archivo normal con encabezado en la fila 1', async () => {
    const buffer = await buildSimpleWorkbook({ header });
    const rows = await parseXlsxColumns(buffer, PARTICIPANT_COLUMNS);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.values.NOMBRES).toBe('Ana');
    expect(rows[0]?.values.ID_SCOUT).toBe('555');
  });

  it('encuentra el encabezado aunque venga después de una fila de título', async () => {
    const buffer = await buildSimpleWorkbook({ header, title: 'LISTADO GENERAL DE MIEMBROS' });
    const rows = await parseXlsxColumns(buffer, PARTICIPANT_COLUMNS);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.values.NOMBRES).toBe('Ana');
    // La fila de datos real es la 4 (título, vacía, encabezado, datos).
    expect(rows[0]?.row).toBe(4);
  });

  it('lee un archivo cuyo XML interno usa un prefijo de espacio de nombres', async () => {
    const plain = await buildSimpleWorkbook({ header });
    const namespaced = await addNamespacePrefix(plain);

    const rows = await parseXlsxColumns(namespaced, PARTICIPANT_COLUMNS);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.values.NOMBRES).toBe('Ana');
  });

  it('combina prefijo de espacio de nombres y fila de título, como el reporte regional', async () => {
    const regionalHeader =
      'GRUPO;UNIDAD;FUNCION;ID_SCOUT;NOMBRE;GENERO;DOCUMENTO;FECHA_DE_NACIMIENTO;TELEFONO_1;ESTADO';
    const plain = await buildSimpleWorkbook({
      header: regionalHeader,
      title: 'LISTADO GENERAL DE MIEMBROS',
    });
    const namespaced = await addNamespacePrefix(plain);

    const rows = await parseXlsxColumns(namespaced, REGIONAL_MEMBER_COLUMNS);

    expect(rows).toHaveLength(1);
    // La fila de prueba usa el orden GRUPO;UNIDAD;FUNCION;ID_SCOUT;NOMBRE;...
    expect(rows[0]?.values.ID_SCOUT).toBe('1001');
    expect(rows[0]?.values.NOMBRE).toBe('Ana');
  });
});
