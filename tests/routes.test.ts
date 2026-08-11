import { describe, expect, it } from 'vitest';
import { internalRoute, isInternalRoute } from '@/lib/routes';

/**
 * El parámetro `?siguiente=` de la pantalla de ingreso decide a dónde va el
 * usuario después de autenticarse. Si aceptara destinos externos, un enlace
 * preparado lo sacaría del sistema justo después de escribir su contraseña.
 */
describe('isInternalRoute', () => {
  it('acepta rutas internas', () => {
    expect(isInternalRoute('/panel')).toBe(true);
    expect(isInternalRoute('/admin/pagos')).toBe(true);
    expect(isInternalRoute('/panel/equipos?filtro=activos')).toBe(true);
    expect(isInternalRoute('/')).toBe(true);
  });

  it('rechaza direcciones absolutas', () => {
    expect(isInternalRoute('https://sitio-malicioso.com')).toBe(false);
    expect(isInternalRoute('http://sitio-malicioso.com')).toBe(false);
  });

  /** `//sitio.com` es una URL relativa al protocolo: el navegador sale del sitio. */
  it('rechaza las URL relativas al protocolo', () => {
    expect(isInternalRoute('//sitio-malicioso.com')).toBe(false);
    expect(isInternalRoute('//sitio-malicioso.com/panel')).toBe(false);
  });

  /** Algunos navegadores normalizan `\` a `/`, así que `/\sitio.com` escaparía. */
  it('rechaza las barras invertidas', () => {
    expect(isInternalRoute('/\\sitio-malicioso.com')).toBe(false);
    expect(isInternalRoute('\\\\sitio-malicioso.com')).toBe(false);
  });

  it('rechaza esquemas ejecutables', () => {
    expect(isInternalRoute('javascript:alert(1)')).toBe(false);
    expect(isInternalRoute('data:text/html,<script>')).toBe(false);
  });

  it('rechaza rutas relativas y valores vacíos', () => {
    expect(isInternalRoute('panel')).toBe(false);
    expect(isInternalRoute('')).toBe(false);
    expect(isInternalRoute(null)).toBe(false);
    expect(isInternalRoute(undefined)).toBe(false);
  });
});

describe('internalRoute', () => {
  it('devuelve la ruta cuando es válida', () => {
    expect(internalRoute('/panel/pagos')).toBe('/panel/pagos');
  });

  it('cae al respaldo cuando no lo es', () => {
    expect(internalRoute('//sitio-malicioso.com')).toBe('/');
    expect(internalRoute(null)).toBe('/');
  });

  it('admite un respaldo propio', () => {
    expect(internalRoute(null, '/panel')).toBe('/panel');
  });
});
