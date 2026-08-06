import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth/session';
import { Alert } from '@/components/ui';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = { title: 'Cambiar contraseña' };

export default async function ChangePasswordPage() {
  const context = await requireSession();
  const forced = context.profile.must_change_password;

  return (
    <main id="contenido" className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="w-full max-w-md">
        <div className="panel p-7">
          <span className="kicker">Seguridad</span>
          <h1 className="mt-1 text-2xl font-extrabold text-navy">
            {forced ? 'Define tu contraseña' : 'Cambiar contraseña'}
          </h1>

          {forced && (
            <Alert tone="warning" className="mt-4">
              Ingresaste con la contraseña temporal que te enviamos por correo. Defínete una propia
              para continuar: nadie más debería conocerla.
            </Alert>
          )}

          <p className="mb-5 mt-3 text-sm text-slate-500">
            Usa al menos 10 caracteres, con mayúsculas, minúsculas y números.
          </p>

          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
