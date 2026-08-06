import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/auth/session';

/**
 * Puerta de entrada: reparte a cada quien su panel.
 * No renderiza nada, así que no hay parpadeo de contenido equivocado.
 */
export default async function HomePage() {
  const context = await getSessionContext();

  if (!context) redirect('/ingresar');
  if (context.profile.must_change_password) redirect('/cambiar-clave');
  if (context.isAdmin) redirect('/admin');
  if (context.group && context.group.status !== 'approved') redirect('/registro/estado');

  redirect('/panel');
}
