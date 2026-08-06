import type { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Ingresar' };

async function getEventName(): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from('settings').select('event_name').single();
    return data?.event_name ?? 'Olimpiadas Scouts';
  } catch {
    return 'Olimpiadas Scouts';
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const { siguiente } = await searchParams;
  const eventName = await getEventName();

  return (
    <main id="contenido" className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      {/* Panel de marca: se oculta en móvil para dejar el formulario arriba. */}
      <section className="relative hidden flex-col justify-center overflow-hidden bg-gradient-to-br from-scout-700 to-scout-500 p-16 text-white lg:flex">
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-12 select-none text-[380px] leading-none opacity-10"
        >
          ⚜
        </span>
        <div className="relative">
          <div className="mb-9 flex items-center gap-3 text-xl font-black">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-2xl text-scout-600">
              ⚜
            </span>
            {eventName}
          </div>
          <h1 className="max-w-lg text-5xl font-black leading-[1.05]">
            Competimos con alegría.
            <br />
            Crecemos en equipo.
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/85">
            Gestiona países, participantes, deportes, equipos intergrupales, pagos y stands desde un
            solo lugar.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2 text-sm font-semibold">
            {['🌍 Países disponibles', '🤝 Equipos entre grupos', '💳 Pagos y comprobantes'].map(
              (pill) => (
                <li key={pill} className="rounded-full bg-white/15 px-3.5 py-1.5 backdrop-blur">
                  {pill}
                </li>
              ),
            )}
          </ul>
        </div>
      </section>

      <section className="flex items-center justify-center bg-canvas px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2.5 text-lg font-black text-scout-700 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-scout-600 text-xl text-white">
              ⚜
            </span>
            {eventName}
          </div>

          <div className="panel p-7">
            <span className="kicker">Acceso</span>
            <h2 className="mt-1 text-2xl font-extrabold text-navy">Iniciar sesión</h2>
            <p className="mb-6 mt-1 text-sm text-slate-500">
              Ingresa con el correo del responsable del grupo.
            </p>

            <LoginForm next={siguiente} />
          </div>

          <p className="mt-5 text-center text-sm text-slate-600">
            ¿Tu grupo todavía no está registrado?{' '}
            <Link href="/registro" className="font-bold text-scout-700 underline underline-offset-2">
              Solicita el registro
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
