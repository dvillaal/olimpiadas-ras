import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { Alert } from '@/components/ui';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Registrar mi grupo' };

async function getEventState(): Promise<{ eventName: string; open: boolean }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('settings').select('event_name, registration_open').single();
    return {
      eventName: data?.event_name ?? 'Olimpiadas Scouts',
      open: data?.registration_open ?? true,
    };
  } catch {
    return { eventName: 'Olimpiadas Scouts', open: true };
  }
}

export default async function RegisterPage() {
  const { eventName, open } = await getEventState();

  return (
    <main id="contenido" className="min-h-screen bg-canvas px-5 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/ingresar" className="mb-6 inline-flex items-center gap-2.5 font-black text-scout-700">
          <span className="relative grid size-10 place-items-center rounded-xl bg-scout-600 p-1.5">
            <Image src="/login/trofeo.png" alt="" aria-hidden fill className="object-contain p-1" />
          </span>
          {eventName}
        </Link>

        <header className="mb-6">
          <span className="kicker">Registro de grupos</span>
          <h1 className="mt-1 text-3xl font-extrabold text-navy">Solicita el registro de tu grupo</h1>
          <p className="mt-2 text-slate-600">
            Completa los datos del grupo y de la persona responsable. La organización revisará la
            solicitud y, si es aprobada, enviará las credenciales de acceso al correo que registres.
          </p>
        </header>

        {open ? (
          <div className="panel p-6 sm:p-7">
            <RegisterForm />
          </div>
        ) : (
          <Alert tone="warning" title="Inscripciones cerradas">
            Por ahora la organización no está recibiendo solicitudes nuevas. Si crees que se trata
            de un error, comunícate con el equipo organizador.
          </Alert>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          ¿Tu grupo ya está registrado?{' '}
          <Link href="/ingresar" className="font-bold text-scout-700 underline underline-offset-2">
            Ingresa aquí
          </Link>
        </p>
      </div>
    </main>
  );
}
