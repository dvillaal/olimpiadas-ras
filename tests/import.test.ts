import { describe, expect, it } from 'vitest';
import {
  branchFromRole,
  CURRENT_ENROLLMENT_YEAR,
  docTypeFromAge,
  normalizeDate,
  normalizeHeader,
  parseCsv,
  splitFullName,
  validateRows,
  type ImportContext,
  type RegionalMemberLookup,
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

  /**
   * La tabla `participants` exige `birthdate > '1950-01-01'`. Sin este
   * chequeo aquí, una sola fila con la fecha mal digitada (un problema común
   * en la base regional) no se veía en la previsualización y tumbaba TODO
   * el lote de inserción al confirmar, sin explicación.
   */
  it('rechaza una fecha de nacimiento anterior a 1950', () => {
    const result = validateRows([row({ FECHA_NACIMIENTO: '1900-01-01' })], context);
    expect(result.issues.some((i) => i.column === 'FECHA_NACIMIENTO')).toBe(true);
    expect(result.valid).toHaveLength(0);
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

describe('docTypeFromAge', () => {
  it('usa registro civil para menores de 7', () => {
    expect(docTypeFromAge(0)).toBe('RC');
    expect(docTypeFromAge(6)).toBe('RC');
  });

  it('usa tarjeta de identidad entre 7 y 17', () => {
    expect(docTypeFromAge(7)).toBe('TI');
    expect(docTypeFromAge(17)).toBe('TI');
  });

  it('usa cédula de ciudadanía de 18 en adelante', () => {
    expect(docTypeFromAge(18)).toBe('CC');
    expect(docTypeFromAge(45)).toBe('CC');
  });
});

describe('splitFullName', () => {
  it('reparte los últimos dos términos como apellidos', () => {
    expect(splitFullName('María Fernanda Ríos Gómez')).toEqual({
      firstNames: 'María Fernanda',
      lastNames: 'Ríos Gómez',
    });
  });

  it('reparte uno y uno cuando solo hay dos palabras', () => {
    expect(splitFullName('Ana Ruiz')).toEqual({ firstNames: 'Ana', lastNames: 'Ruiz' });
  });

  it('con tres palabras deja una en nombres y dos en apellidos', () => {
    expect(splitFullName('Juan Pérez Gómez')).toEqual({
      firstNames: 'Juan',
      lastNames: 'Pérez Gómez',
    });
  });

  it('con una sola palabra la deja toda en nombres', () => {
    expect(splitFullName('Ana')).toEqual({ firstNames: 'Ana', lastNames: '' });
  });

  it('ignora espacios repetidos', () => {
    expect(splitFullName('  Ana   María   Ruiz   Gómez  ')).toEqual({
      firstNames: 'Ana María',
      lastNames: 'Ruiz Gómez',
    });
  });
});

describe('validateRows con cruce regional (por Id Scout)', () => {
  const row = (overrides: Record<string, string> = {}) => ({
    row: 2,
    values: {
      CODIGO_GRUPO: 'GS-001',
      ...overrides,
    },
  });

  const regionalMembers = new Map<number, RegionalMemberLookup>([
    [
      555,
      {
        fullName: 'María Fernanda Ríos Gómez',
        document: '1234567890',
        birthdate: '2012-05-20',
        gender: 'F',
        unit: 'TROPA',
        functionName: 'JOVEN',
        status: 'ACTIVO',
        enrollmentYear: '2026',
      },
    ],
  ]);

  const branchAgeRanges = [
    { id: 'lobatos', name: 'Lobatos', min_age: 7, max_age: 10 },
    { id: 'scouts', name: 'Scouts', min_age: 11, max_age: 14 },
  ];

  const crossRefContext: ImportContext = {
    ...context,
    branchIds: new Set(['lobatos', 'scouts', 'adultos', 'jefe-de-grupo', 'jefatura', 'consejero']),
    regionalMembers,
    branchAgeRanges,
  };

  it('completa documento, nombres, nacimiento, género y rama solo con el Id Scout', () => {
    const result = validateRows([row({ ID_SCOUT: '555' })], crossRefContext);

    expect(result.issues).toEqual([]);
    expect(result.valid).toHaveLength(1);
    const participant = result.valid[0]!;
    expect(participant.document).toBe('1234567890');
    expect(participant.firstNames).toBe('María Fernanda');
    expect(participant.lastNames).toBe('Ríos Gómez');
    expect(participant.birthdate).toBe('2012-05-20');
    expect(participant.gender).toBe('F');
    // La rama sale de la unidad regional (TROPA → scouts), no de la edad.
    expect(participant.branchId).toBe('scouts');
    // Sin TIPO_DOCUMENTO en el archivo, se deduce de la edad: 14 años → TI.
    expect(participant.docType).toBe('TI');
  });

  it('lo que trae el archivo manda sobre la base regional', () => {
    const result = validateRows(
      [
        row({
          ID_SCOUT: '555',
          NOMBRES: 'Otro',
          APELLIDOS: 'Nombre',
          NUMERO_DOCUMENTO: '9999999999',
        }),
      ],
      crossRefContext,
    );

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.firstNames).toBe('Otro');
    expect(result.valid[0]?.lastNames).toBe('Nombre');
    expect(result.valid[0]?.document).toBe('9999999999');
  });

  it('sin Id Scout que coincida, sigue exigiendo los datos del archivo', () => {
    const result = validateRows([row({ ID_SCOUT: '000' })], crossRefContext);
    expect(result.valid).toHaveLength(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('sin base regional en el contexto, se comporta como antes', () => {
    const result = validateRows([row({ ID_SCOUT: '555' })], context);
    expect(result.valid).toHaveLength(0);
  });

  /**
   * Bug real: el archivo simple que entrega cada grupo solo tiene una
   * columna "Nombres" con el nombre COMPLETO (no solo los nombres de pila).
   * Antes, esa columna se tomaba tal cual como "nombres" y además se le
   * pegaban los apellidos deducidos de la base regional, duplicando el
   * nombre completo (p. ej. "GABRIELA LUCIA HINCAPIE POSADA HINCAPIE
   * POSADA").
   */
  it('no duplica el nombre cuando el archivo solo trae una columna con el nombre completo', () => {
    const result = validateRows(
      [row({ ID_SCOUT: '555', NOMBRES: 'María Fernanda Ríos Gómez' })],
      crossRefContext,
    );

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.firstNames).toBe('María Fernanda');
    expect(result.valid[0]?.lastNames).toBe('Ríos Gómez');
    expect(result.valid[0]?.fullName).toBe('María Fernanda Ríos Gómez');
  });

  it('reparte el nombre completo de una sola columna cuando no hay coincidencia regional', () => {
    const result = validateRows(
      [row({ NOMBRES: 'Carlos David Cruz Zuluaga' })],
      { ...context, branchAgeRanges: [] },
    );

    // Sin base regional ni RAMA/FECHA_NACIMIENTO en el archivo, la fila sigue
    // sin pasar por esos otros campos, pero el nombre no debe duplicarse.
    const issue = result.issues.find((i) => i.column === 'APELLIDOS');
    expect(issue).toBeUndefined();
  });

  /**
   * Réplica de la herramienta externa que ya usa la organización: alguien de
   * la base regional solo es candidato válido si figura ACTIVO e inscrito
   * este año. Si no, se descarta igual que si no estuviera en la base.
   */
  it('descarta el cruce cuando el estado regional no es ACTIVO', () => {
    const inactiveMembers = new Map<number, RegionalMemberLookup>([
      [
        555,
        {
          fullName: 'María Fernanda Ríos Gómez',
          document: '1234567890',
          birthdate: '2012-05-20',
          gender: 'F',
          unit: 'TROPA',
          functionName: 'JOVEN',
          status: 'RETIRADO',
          enrollmentYear: CURRENT_ENROLLMENT_YEAR,
        },
      ],
    ]);

    const result = validateRows(
      [row({ ID_SCOUT: '555' })],
      { ...crossRefContext, regionalMembers: inactiveMembers },
    );

    expect(result.valid).toHaveLength(0);
    const message = result.issues.map((i) => i.message).join(' ');
    expect(message).toContain('no figura activo e inscrito');
  });

  it('descarta el cruce cuando el año de inscripción no es el del evento actual', () => {
    const staleMembers = new Map<number, RegionalMemberLookup>([
      [
        555,
        {
          fullName: 'María Fernanda Ríos Gómez',
          document: '1234567890',
          birthdate: '2012-05-20',
          gender: 'F',
          unit: 'TROPA',
          functionName: 'JOVEN',
          status: 'ACTIVO',
          enrollmentYear: '2025',
        },
      ],
    ]);

    const result = validateRows(
      [row({ ID_SCOUT: '555' })],
      { ...crossRefContext, regionalMembers: staleMembers },
    );

    expect(result.valid).toHaveLength(0);
    const message = result.issues.map((i) => i.message).join(' ');
    expect(message).toContain('no figura activo e inscrito');
  });

  it('usa el cruce cuando está activo e inscrito en el año actual', () => {
    const eligibleMembers = new Map<number, RegionalMemberLookup>([
      [
        555,
        {
          fullName: 'María Fernanda Ríos Gómez',
          document: '1234567890',
          birthdate: '2012-05-20',
          gender: 'F',
          unit: 'TROPA',
          functionName: 'JOVEN',
          status: 'activo', // minúsculas: el estado se normaliza antes de comparar
          enrollmentYear: CURRENT_ENROLLMENT_YEAR,
        },
      ],
    ]);

    const result = validateRows(
      [row({ ID_SCOUT: '555' })],
      { ...crossRefContext, regionalMembers: eligibleMembers },
    );

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.branchId).toBe('scouts');
  });
});

describe('branchFromRole (deducción de rama por cargo, igual que la herramienta externa)', () => {
  it('reconoce jefe de grupo o director de grupo por función', () => {
    expect(branchFromRole('GRUPO', 'JEFE DE GRUPO')).toBe('jefe-de-grupo');
    expect(branchFromRole('GRUPO', 'DIRECTOR DE GRUPO')).toBe('jefe-de-grupo');
  });

  it('reconoce consejero por función con "CONSEJO"', () => {
    expect(branchFromRole('GRUPO', 'CONSEJO DE GRUPO')).toBe('consejero');
  });

  it('reconoce jefatura por jefe/sub-jefe/scouter/dirigente', () => {
    expect(branchFromRole('TROPA', 'JEFE DE TROPA')).toBe('jefatura');
    expect(branchFromRole('TROPA', 'SUB JEFE')).toBe('jefatura');
    expect(branchFromRole('TROPA', 'SUBJEFE')).toBe('jefatura');
    expect(branchFromRole('MANADA', 'SCOUTER')).toBe('jefatura');
    expect(branchFromRole('CLAN', 'DIRIGENTE')).toBe('jefatura');
  });

  it('un cargo de jefatura pesa más que la unidad, aunque la unidad sea de rama juvenil', () => {
    // "Jefe de Tropa" no es un scout de esa tropa: el cargo manda sobre la unidad.
    expect(branchFromRole('TROPA', 'JEFE DE TROPA')).toBe('jefatura');
  });

  it('reconoce cachorros por unidad o función con CACHORRO/CASTOR', () => {
    expect(branchFromRole('CACHORROS', 'JOVEN')).toBe('cachorros');
    expect(branchFromRole('CASTORES', 'JOVEN')).toBe('cachorros');
  });

  it('reconoce lobatos por unidad MANADA o función LOBATO', () => {
    expect(branchFromRole('MANADA', 'JOVEN')).toBe('lobatos');
    expect(branchFromRole('', 'LOBATO')).toBe('lobatos');
  });

  it('reconoce webelos por unidad o función con WEBELO', () => {
    expect(branchFromRole('WEBELOS', 'JOVEN')).toBe('webelos');
  });

  it('reconoce scouts por unidad TROPA/SCOUT o función exacta "SCOUT"', () => {
    expect(branchFromRole('TROPA', 'JOVEN')).toBe('scouts');
    expect(branchFromRole('', 'SCOUT')).toBe('scouts');
  });

  it('reconoce nomadas por unidad COMUNIDAD o función con NOMADA', () => {
    expect(branchFromRole('COMUNIDAD', 'JOVEN')).toBe('nomadas');
    expect(branchFromRole('', 'NOMADA')).toBe('nomadas');
  });

  it('reconoce rovers por unidad CLAN o función con ROVER', () => {
    expect(branchFromRole('CLAN', 'JOVEN')).toBe('rovers');
    expect(branchFromRole('', 'ROVER')).toBe('rovers');
  });

  it('cae en adultos cuando nada coincide', () => {
    expect(branchFromRole('OTRA UNIDAD', 'VOLUNTARIO')).toBe('adultos');
    expect(branchFromRole('', '')).toBe('adultos');
  });

  it('ignora acentos y mayúsculas/minúsculas', () => {
    expect(branchFromRole('tropa', 'jóven')).toBe('scouts');
    expect(branchFromRole('CLÁN', 'róver')).toBe('rovers');
  });
});
