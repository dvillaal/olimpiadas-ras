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
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5 shrink-0"
      >
        <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
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
