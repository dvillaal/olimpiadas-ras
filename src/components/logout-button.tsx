'use client';

import { useFormStatus } from 'react-dom';
import { logoutAction } from '@/app/(auth)/actions';

function Inner({ tone }: { tone: 'light' | 'dark' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px]
                 font-semibold transition-colors disabled:opacity-60 ${
                   tone === 'dark'
                     ? 'text-navy/70 hover:bg-navy/10 hover:text-navy'
                     : 'text-white/75 hover:bg-white/10 hover:text-white'
                 }`}
    >
      <span aria-hidden className="w-5 text-center text-base">
        ⏻
      </span>
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}

/** tone="dark" es para barras laterales claras (el sidebar dorado del jefe de grupo). */
export function LogoutButton({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <form action={logoutAction}>
      <Inner tone={tone} />
    </form>
  );
}
