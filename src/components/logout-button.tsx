'use client';

import { useFormStatus } from 'react-dom';
import { logoutAction } from '@/app/(auth)/actions';

function Inner() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px]
                 font-semibold text-white/75 transition-colors hover:bg-white/10
                 hover:text-white disabled:opacity-60"
    >
      <span aria-hidden className="w-5 text-center text-base">
        ⏻
      </span>
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Inner />
    </form>
  );
}
