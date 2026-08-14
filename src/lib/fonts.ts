import localFont from 'next/font/local';

/**
 * Tipografía de marca (FatFrank), provista por la organización.
 *
 * Se declara una sola vez aquí y se reusa donde haga falta (portada de login,
 * portada del panel de grupo, etc.) para que Next no la cargue por duplicado.
 * El archivo vive en public/fonts/FatFrank.otf.
 */
export const displayFont = localFont({
  src: '../../public/fonts/FatFrank.otf',
  variable: '--font-display',
  display: 'swap',
});

/**
 * Tipografía de texto (Seravek), provista por la organización.
 *
 * Acompaña a FatFrank: FatFrank va en los títulos vistosos, Seravek en todo
 * el texto de apoyo (descripciones, listas, cifras) de esas mismas tarjetas.
 */
export const bodyFont = localFont({
  src: [
    { path: '../../public/fonts/Seravek/Seravek-ExtraLight.otf', weight: '200', style: 'normal' },
    {
      path: '../../public/fonts/Seravek/Seravek-ExtraLightItalic.otf',
      weight: '200',
      style: 'italic',
    },
    { path: '../../public/fonts/Seravek/Seravek-Light.otf', weight: '300', style: 'normal' },
    { path: '../../public/fonts/Seravek/Seravek-LightItalic.otf', weight: '300', style: 'italic' },
    { path: '../../public/fonts/Seravek/Seravek.otf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Seravek/Seravek-Italic.otf', weight: '400', style: 'italic' },
    { path: '../../public/fonts/Seravek/Seravek-Medium.otf', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Seravek/Seravek-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: '../../public/fonts/Seravek/Seravek-Bold.otf', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Seravek/Seravek-BoldItalic.otf', weight: '700', style: 'italic' },
  ],
  variable: '--font-seravek',
  display: 'swap',
});

/** Clase de Tailwind que aplica FatFrank vía la variable --font-display. */
export const titleFontClass = 'font-[family-name:var(--font-display)]';

/** Título vistoso estándar de una tarjeta de color en el panel del grupo. */
export const cardTitleClass = `${titleFontClass} text-2xl font-black uppercase tracking-wide`;
