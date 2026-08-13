import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import localFont from 'next/font/local';
import { createAdminClient } from '@/lib/supabase/admin';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Ingresar' };

/** Tipografía de la portada: FatFrank, provista por la organización. */
const display = localFont({
  src: '../../../../public/fonts/FatFrank.otf',
  variable: '--font-display',
  display: 'swap',
});

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
      <section
        className={`${display.variable} relative hidden flex-col justify-center overflow-hidden bg-scout-500 text-white lg:flex`}
      >
        <h1 className="sr-only">{eventName}</h1>

        {/* Palabra gigante de fondo, centrada, a modo de textura de marca. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex -translate-y-[10%] select-none flex-col items-center justify-center overflow-hidden text-center font-[family-name:var(--font-display)] font-extrabold uppercase text-scout-400/80"
          style={{ fontSize: 'clamp(110px, 14vw, 230px)', lineHeight: 0.85 }}
        >
          <span className="block">¡Olim</span>
          <span className="block">pia</span>
          <span className="block">das!</span>
        </div>

        {/* Trofeo, centrado y con una leve rotación, superpuesto al texto. */}
        <Image
          src="/login/trofeo.png"
          alt=""
          aria-hidden
          width={552}
          height={1080}
          priority
          className="pointer-events-none absolute left-1/2 top-[50%] h-[74%] w-auto -translate-x-1/2 -translate-y-1/2
                     -rotate-6 select-none drop-shadow-2xl z-20"
        />

        {/* Insignia con los logos de la organización. */}
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-[28px] bg-plum px-8 py-5 shadow-[var(--shadow-float)]">
          <Image
            src="/login/logos-ras.png"
            alt="Scouts de Colombia y Antioquia Scout"
            width={1309}
            height={290}
            className="h-16 w-auto z-10"
          />
        </div>
      </section>

      <section className="relative flex items-center justify-center overflow-hidden bg-canvas px-5 py-12">
        {/* Garabatos decorativos: se asoman por los bordes, detrás de la tarjeta. */}
        <Image
          src="/login/fondo.png"
          alt=""
          aria-hidden
          width={439}
          height={1080}
          className="pointer-events-none absolute right-0 top-0 hidden h-full w-auto max-w-none select-none lg:block"
        />

        <div className="relative z-10 w-full max-w-md">
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
