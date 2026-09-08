import { describe, expect, it } from 'vitest';
import { parseRegionalCsv, validateRegionalRows } from '@/lib/import/regional-members';

const HEADER = 'ID SCOUT;NOMBRE;DOCUMENTO;FECHA DE NACIMIENTO;GENERO;TELEFONO 1;GRUPO;UNIDAD;FUNCIÓN;Estado';

describe('parseRegionalCsv', () => {
  it('normaliza encabezados con acentos y espacios', () => {
    const csv = `${HEADER}\n555;Ana Ruiz;1001;2012-05-20;F;3001234567;G.S 1 TAHAMIES;TROPA;JOVEN;ACTIVO`;
    const rows = parseRegionalCsv(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.values.ID_SCOUT).toBe('555');
    expect(rows[0]?.values.FUNCION).toBe('JOVEN');
    expect(rows[0]?.values.ESTADO).toBe('ACTIVO');
  });
});

describe('validateRegionalRows', () => {
  const row = (overrides: Record<string, string> = {}) => ({
    row: 2,
    values: {
      ID_SCOUT: '555',
      NOMBRE: 'Ana María Ruiz Gómez',
      DOCUMENTO: '1001',
      FECHA_DE_NACIMIENTO: '2012-05-20',
      GENERO: 'F',
      TELEFONO_1: '3001234567',
      GRUPO: 'G.S 1 TAHAMIES',
      UNIDAD: 'TROPA',
      FUNCION: 'JOVEN',
      ESTADO: 'ACTIVO',
      ...overrides,
    },
  });

  it('acepta una fila completa', () => {
    const result = validateRegionalRows([row()]);
    expect(result.issues).toEqual([]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.scoutId).toBe(555);
    expect(result.valid[0]?.fullName).toBe('Ana María Ruiz Gómez');
    expect(result.valid[0]?.gender).toBe('F');
  });

  it('solo exige Id Scout y nombre: el resto puede faltar', () => {
    const result = validateRegionalRows([
      row({ DOCUMENTO: '', FECHA_DE_NACIMIENTO: '', GENERO: '', TELEFONO_1: '' }),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.document).toBe('');
    expect(result.valid[0]?.birthdate).toBeNull();
    expect(result.valid[0]?.gender).toBeNull();
  });

  it('rechaza un Id Scout vacío o inválido', () => {
    const result = validateRegionalRows([row({ ID_SCOUT: '' })]);
    expect(result.valid).toHaveLength(0);
    expect(result.issues[0]?.column).toBe('ID_SCOUT');
  });

  it('rechaza un nombre vacío', () => {
    const result = validateRegionalRows([row({ NOMBRE: '' })]);
    expect(result.valid).toHaveLength(0);
    expect(result.issues.some((i) => i.column === 'NOMBRE')).toBe(true);
  });

  it('detecta Id Scout repetido dentro del archivo', () => {
    const result = validateRegionalRows([row(), { ...row(), row: 3 }]);
    expect(result.valid).toHaveLength(1);
    expect(result.issues.some((i) => i.message.includes('repetido'))).toBe(true);
  });

  it('acepta variantes de género en texto', () => {
    const result = validateRegionalRows([
      row({ ID_SCOUT: '1', GENERO: 'Masculino' }),
      { ...row({ ID_SCOUT: '2', GENERO: 'Femenino' }), row: 3 },
    ]);
    expect(result.valid.map((m) => m.gender)).toEqual(['M', 'F']);
  });

  it('un género no reconocido queda vacío, sin rechazar la fila', () => {
    const result = validateRegionalRows([row({ GENERO: 'NS/NR' })]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.gender).toBeNull();
  });
});
