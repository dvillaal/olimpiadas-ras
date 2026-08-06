import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/auth/session';
import { groupStatusView } from '@/lib/domain/status';
import { Alert, StatusBadge } from '@/components/ui';
import { LogoutInline } from './logout-inline';

export const metadata: Metadata = { title: 'Estado de la solicitud' };

/**
 * Pantalla para un grupo con sesión iniciada cuya solicitud dejó de estar
 * aprobada (rechazada o suspendida). Evita dejarlo en un panel vacío sin
 * explicación.
 */
export default async function RegistrationStatusPage() {
  const context = await getSessionContext();
  if (!context) redirect('/ingresar');
  if (!context.group) redirect('/ingresar');
  if (context.group.status === 'approved') redirect('/panel');

  const status = groupStatusView(context.group.status);

  return (
    <main id="contenido" className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="w-full max-w-lg">
        <div className="panel p-7 text-center">
          <span className="mb-4 inline-grid size-16 place-items-center rounded-2xl bg-scout-100 text-3xl">
            ⚜
          </span>
          <h1 className="text-2xl font-extrabold text-navy">{context.group.name}</h1>
          <div className="mt-3">
            <StatusBadge status={status} />
          </div>

          {context.group.status === 'rejected' && context.group.rejection_reason && (
            <Alert tone="error" title="Motivo" className="mt-5 text-left">
              {context.group.rejection_reason}
            </Alert>
          )}

          {context.group.status === 'suspended' && (
            <Alert tone="warning" className="mt-5 text-left">
              La organización suspendió temporalmente el acceso de tu grupo. Comunícate con el
              equipo organizador para conocer los detalles.
            </Alert>
          )}

          <p className="mt-5 text-sm text-slate-600">
            Si crees que se trata de un error, responde el correo que te enviamos o escribe al
            equipo organizador.
          </p>

          <div className="mt-6">
            <LogoutInline />
          </div>
        </div>
      </div>
    </main>
  );
}
