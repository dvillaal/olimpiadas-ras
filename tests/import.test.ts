import { describe, expect, it } from 'vitest';
import {
  normalizeDate,
  normalizeHeader,
  parseCsv,
  validateRows,
  type ImportContext,
} from '@/lib/import/participants';

const context: ImportContext = {
  groupsByCode: new Map([
    ['GS-001', 'group-1'],
    ['GS-002', 'group-2'],
  ]),
  branchIds: new Set(['manada', 'tropa', 'caminantes', 'rovers']),
  existingDocuments: new Set(['TI:9999999']),
};

const HEADER =
  'CODIGO_GRUPO;TIPO_DOCUMENTO;NUMERO_DOCUMENTO;NOMBRES;APELLIDOS;FECHA_NACIMIENTO;RAMA;GENERO;OBSERVACIONES';

describe('normalizeHeader', () => {
  it('quita acentos, espacios y el BOM', () => {
    expect(normalizeHeader('﻿Número documento')).toBe('NUMERO_DOCUMENTO');
    expect(normalizeHeader('  fecha-nacimiento ')).toBe('FECHA_NACIMIENTO');
    expect(normalizeHeader('CÓDIGO GRUPO')).toBe('CODIGO_GRUPO');
  });
});

describe('normalizeDate', () => {
  it('acepta el formato ISO', () => {
    expect(normalizeDate('2012-05-20')).toBe('2012-05-20');
  });

  it('convierte DD/MM/AAAA', () => {
    expect(normalizeDate('20/05/2012')).toBe('2012-05-20');
    expect(normalizeDate('5/3/2011')).toBe('2011-03-05');
  });

  it('convierte el número de serie de Excel', () => {
    // Excel cuenta días desde el 30/12/1899 (compensa su error del año 1900).
    // Ancla conocida: 44927 = 01/01/2023.
    expect(normalizeDate('44927')).toBe('2023-01-01');
    expect(normalizeDate('41000')).toBe('2012-04-01');
  });

  it('acepta un objeto Date', () => {
    expect(normalizeDate(new Date('2012-05-20T00:00:00Z'))).toBe('2012-05-20');
  });

  it('devuelve null ante basura', () => {
    expect(normalizeDate('ayer')).toBeNull();
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});

describe('parseCsv', () => {
  /**
   * El prototipo hacía `line.split(';')`, así que este caso partía la fila en
   * columnas equivocadas y corrompía el registro entero.
   */
  it('respeta los puntos y coma dentro de un campo entrecomillado', () => {
    const csv = `${HEADER}\nGS-001;TI;1001;Ana;Ruiz;2012-05-20;tropa;F;"Alergia a nueces; requiere dieta especial"`;
    const rows = parseCsv(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.values.OBSERVACIONES).toBe('Alergia a nueces; requiere dieta especial');
  });

  it('respeta las comas dentro de un campo entrecomillado', () => {
    const csv = `${HEADER}\nGS-001;TI;1002;Luis;Mora;2011-01-10;tropa;M;"Vegetariano, sin lácteos"`;
    const rows = parseCsv(csv);
    expect(rows[0]?.values.OBSERVACIONES).toBe('Vegetariano, sin lácteos');
  });

  it('detecta el separador coma automáticamente', () => {
    const csv = `${HEADER.replace(/;/g, ',')}\nGS-001,TI,1003,Sara,Gil,2012-02-02,tropa,F,Sin novedad`;
    const rows = parseCsv(csv);
    expect(rows[0]?.values.NOMBRES).toBe('Sara');
  });

  it('ignora el BOM del inicio', () => {
    const csv = `﻿${HEADER}\nGS-001;TI;1004;Ema;Paz;2012-03-03;tropa;F;`;
    const rows = parseCsv(csv);
    expect(rows[0]?.values.CODIGO_GRUPO).toBe('GS-001');
  });

  it('descarta líneas vacías', () => {
    const csv = `${HEADER}\n\nGS-001;TI;1005;Ivan;Paz;2012-03-03;tropa;M;\n\n`;
    expect(parseCsv(csv)).toHaveLength(1);
  });

  it('numera las filas como las ve el usuario en Excel', () => {
    const csv = `${HEADER}\nGS-001;TI;1006;A;B;2012-01-01;tropa;F;\nGS-001;TI;1007;C;D;2012-01-01;tropa;M;`;
    const rows = parseCsv(csv);
    expect(rows[0]?.row).toBe(2);
    expect(rows[1]?.row).toBe(3);
  });
});

describe('validateRows', () => {
  const row = (overrides: Record<string, string> = {}) => ({
    row: 2,
    values: {
      CODIGO_GRUPO: 'GS-001',
      TIPO_DOCUMENTO: 'TI',
      NUMERO_DOCUMENTO: '1001',
      NOMBRES: 'Ana María',
      APELLIDOS: 'Ruiz Gómez',
      FECHA_NACIMIENTO: '2012-05-20',
      RAMA: 'tropa',
      GENERO: 'F',
      OBSERVACIONES: 'Ninguna',
      ...overrides,
    },
  });

  it('acepta una fila correcta y la mapea al grupo', () => {
    const result = validateRows([row()], context);
    expect(result.issues).toEqual([]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.groupId).toBe('group-1');
    expect(result.valid[0]?.fullName).toBe('Ana María Ruiz Gómez');
    expect(result.valid[0]?.active).toBe(true);
  });

  it('rechaza un código de grupo inexistente', () => {
    const result = validateRows([row({ CODIGO_GRUPO: 'GS-999' })], context);
    expect(result.valid).toHaveLength(0);
    expect(result.issues[0]?.column).toBe('CODIGO_GRUPO');
  });

  it('rechaza una rama no configurada', () => {
    const result = validateRows([row({ RAMA: 'lobatos' })], context);
    expect(result.issues.some((i) => i.column === 'RAMA')).toBe(true);
  });

  it('detecta un documento que ya existe en el sistema', () => {
    const result = validateRows([row({ NUMERO_DOCUMENTO: '9999999' })], context);
    expect(result.issues.some((i) => i.message.includes('ya está registrado'))).toBe(true);
  });

  it('detecta documentos repetidos dentro del mismo archivo', () => {
    const result = validateRows([row(), { ...row(), row: 3 }], context);
    expect(result.valid).toHaveLength(1);
    expect(result.issues.some((i) => i.message.includes('repetido'))).toBe(true);
  });

  /**
   * En el prototipo el documento era único de forma global, así que una TI y
   * una CC con el mismo número colisionaban. Aquí son personas distintas.
   */
  it('permite el mismo número con distinto tipo de documento', () => {
    const result = validateRows(
      [row(), { ...row({ TIPO_DOCUMENTO: 'CC' }), row: 3 }],
      context,
    );
    expect(result.valid).toHaveLength(2);
    expect(result.issues).toEqual([]);
  });

  it('rechaza una fecha de nacimiento futura', () => {
    const result = validateRows([row({ FECHA_NACIMIENTO: '2099-01-01' })], context);
    expect(result.issues.some((i) => i.column === 'FECHA_NACIMIENTO')).toBe(true);
  });

  // El formulario ya no pide teléfono, correo ni estado: todo participante
  // importado entra activo, sin necesidad de columna alguna para lograrlo.
  it('siempre entra activo, sin importar la fila', () => {
    const result = validateRows([row()], context);
    expect(result.valid[0]?.active).toBe(true);
  });

  it('ignora el código de grupo cuando se fuerza uno', () => {
    const result = validateRows([row({ CODIGO_GRUPO: 'GS-999' })], {
      ...context,
      forceGroupId: 'group-7',
    });
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.groupId).toBe('group-7');
  });

  it('acumula varios problemas de la misma fila', () => {
    const result = validateRows(
      [row({ NOMBRES: '', RAMA: 'inventada' })],
      context,
    );
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('separa las filas buenas de las malas en lugar de rechazar todo', () => {
    const result = validateRows(
      [row(), { ...row({ NUMERO_DOCUMENTO: '', NOMBRES: '' }), row: 3 }],
      context,
    );
    expect(result.valid).toHaveLength(1);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.totalRows).toBe(2);
  });
});
