import { describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/lib/supabase/pagination';

/**
 * `fetchAllRows` existe porque la API de Supabase limita cada respuesta a
 * 1000 filas por defecto: sin paginar, una tabla grande (la base regional,
 * participantes) se leía a medias sin ningún aviso, y el cruce por Id Scout
 * fallaba en silencio para quien cayera fuera de las primeras 1000 filas.
 */
describe('fetchAllRows', () => {
  function makeSource(total: number) {
    const all = Array.from({ length: total }, (_, i) => ({ id: i }));
    let calls = 0;
    const page = (from: number, to: number) => {
      calls += 1;
      return Promise.resolve({ data: all.slice(from, to + 1), error: null });
    };
    return { page, callCount: () => calls };
  }

  it('trae todo en una sola página cuando hay menos de 1000 filas', async () => {
    const { page, callCount } = makeSource(50);
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(50);
    expect(callCount()).toBe(1);
  });

  it('pagina cuando hay más de 1000 filas, sin perder ninguna', async () => {
    const { page, callCount } = makeSource(2862);
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(2862);
    expect(rows[0]).toEqual({ id: 0 });
    expect(rows[2861]).toEqual({ id: 2861 });
    // 1000 + 1000 + 862: la última página, más corta, es la que detiene el ciclo.
    expect(callCount()).toBe(3);
  });

  it('se detiene justo en un múltiplo exacto de 1000 sin pedir una página vacía de más', async () => {
    const { page, callCount } = makeSource(2000);
    const rows = await fetchAllRows(page);
    expect(rows).toHaveLength(2000);
    // Al recibir exactamente 1000 filas, no sabe si hay más: pide una página
    // más, que llega vacía y ahí para.
    expect(callCount()).toBe(3);
  });

  it('no revienta con una tabla vacía', async () => {
    const { page } = makeSource(0);
    const rows = await fetchAllRows(page);
    expect(rows).toEqual([]);
  });

  it('propaga el error si una página falla', async () => {
    let calls = 0;
    const page = () => {
      calls += 1;
      // La primera página viene llena (1000 filas), así que el ciclo pide
      // una segunda página; ahí es donde falla.
      if (calls === 1) return Promise.resolve({ data: Array(1000).fill({ id: 0 }), error: null });
      return Promise.resolve({ data: null, error: { message: 'boom' } });
    };
    await expect(fetchAllRows(page)).rejects.toThrow('boom');
  });
});
