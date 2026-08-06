import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui';

export const metadata: Metadata = { title: 'Solicitud enviada' };

export default function RegistrationSentPage() {
  return (
    <main id="contenido" className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="w-full max-w-lg text-center">
        <span className="mb-4 inline-grid size-16 place-items-center rounded-2xl bg-scout-100 text-3xl">
          ✉️
        </span>
        <h1 className="text-3xl font-extrabold text-navy">Solicitud enviada</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600">
          Recibimos el registro de tu grupo. La organización lo revisará y te escribiremos al correo
          del responsable con la respuesta.
        </p>

        <div className="panel mt-7 text-left">
          <h2 className="mb-3 font-bold text-navy">¿Qué sigue?</h2>
          <ol className="space-y-3 text-sm text-slate-600">
            {[
              'Revisa tu bandeja de entrada: te confirmamos que la solicitud llegó.',
              'La organización verifica los datos del grupo y del responsable.',
              'Si es aprobada, recibirás un correo con tu usuario y una contraseña temporal.',
              'Al ingresar por primera vez el sistema te pedirá cambiar esa contraseña.',
            ].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-scout-600 text-xs font-black text-white">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Si el correo no llega en unos minutos, revisa la carpeta de correo no deseado.
        </p>

        <LinkButton href="/ingresar" variant="ghost" className="mt-5">
          Volver al inicio
        </LinkButton>
      </div>
    </main>
  );
}
