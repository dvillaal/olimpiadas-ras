import { describe, expect, it } from 'vitest';
import { normalizeSupabaseUrl } from '@/lib/supabase/env';

/**
 * La *Data API URL* del panel de Supabase termina en `/rest/v1/` y es muy fácil
 * copiarla en lugar de la *Project URL*. Cuando eso pasa, cada petición sale
 * como `.../rest/v1/auth/v1/...` y el gateway responde con un críptico
 * «Invalid path specified in request URL».
 */
describe('normalizeSupabaseUrl', () => {
  const esperado = 'https://sjnilexarriwkfuffzxw.supabase.co';

  it('deja intacta una Project URL correcta', () => {
    expect(normalizeSupabaseUrl(esperado)).toBe(esperado);
  });

  it('quita la barra final', () => {
    expect(normalizeSupabaseUrl(`${esperado}/`)).toBe(esperado);
  });

  it('quita la ruta de la Data API', () => {
    expect(normalizeSupabaseUrl(`${esperado}/rest/v1/`)).toBe(esperado);
    expect(normalizeSupabaseUrl(`${esperado}/auth/v1`)).toBe(esperado);
    expect(normalizeSupabaseUrl(`${esperado}/storage/v1/`)).toBe(esperado);
  });

  it('tolera comillas y espacios sobrantes del archivo .env', () => {
    expect(normalizeSupabaseUrl(`  "${esperado}/rest/v1/"  `)).toBe(esperado);
  });

  it('acepta un Supabase local en http', () => {
    expect(normalizeSupabaseUrl('http://localhost:54321')).toBe('http://localhost:54321');
  });

  it('rechaza algo que no es una dirección', () => {
    expect(() => normalizeSupabaseUrl('sjnilexarriwkfuffzxw')).toThrow(/no es una dirección válida/);
  });

  it('rechaza http en un dominio remoto', () => {
    expect(() => normalizeSupabaseUrl('http://ejemplo.supabase.co')).toThrow(/https/);
  });
});
