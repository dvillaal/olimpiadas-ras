const PAGE_SIZE = 1000;

/**
 * Trae todas las filas de una consulta, paginando de a 1000.
 *
 * La API de Supabase limita cada respuesta a 1000 filas por defecto (se
 * puede subir desde el panel de Supabase, pero el código no puede asumir que
 * se subió). Sin esto, cualquier tabla que supere las 1000 filas —la base
 * regional, participantes a medida que crece el evento— se lee a medias y
 * sin ningún aviso: por ejemplo, el cruce de participantes por Id Scout
 * fallaba en silencio para cualquiera que cayera fuera de las primeras 1000
 * filas que devolviera Postgres, aunque la persona sí estuviera en la tabla.
 *
 * `page(from, to)` debe ser la misma consulta con `.range(from, to)`
 * aplicado (mismos filtros y orden en cada llamada).
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
