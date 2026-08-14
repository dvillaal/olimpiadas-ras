'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/** Cuenta regresiva hasta la fecha de inicio del evento. */

function splitRemaining(targetMs: number): { days: number; h: number; m: number; s: number } | null {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    h: Math.floor((totalSeconds % 86400) / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function CountdownBanner({ targetIso }: { targetIso: string | null }) {
  const targetMs = targetIso ? new Date(targetIso).getTime() : null;
  const valid = targetMs != null && !Number.isNaN(targetMs);

  // Arranca en null y se resuelve en el cliente: evita que el render del
  // servidor y el primer render del cliente calculen segundos distintos.
  const [remaining, setRemaining] = useState<ReturnType<typeof splitRemaining>>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!valid) return;
    // Reloj en vivo: el primer tick se calcula aquí a propósito, antes de
    // que arranque el intervalo, para no esperar un segundo completo a que
    // aparezca el número inicial.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(splitRemaining(targetMs));
    const id = setInterval(() => setRemaining(splitRemaining(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs, valid]);

  if (!valid) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-scout-500 px-6 py-4 text-white shadow-[var(--shadow-card)]">
      <p className="text-xl font-black tracking-tight sm:text-2xl">
        {!mounted ? (
          'FALTAN --:--:--'
        ) : remaining ? (
          <>
            FALTAN{' '}
            {remaining.days > 0 && <span>{remaining.days}d </span>}
            {pad(remaining.h)}:{pad(remaining.m)}:{pad(remaining.s)}
          </>
        ) : (
          '¡El evento ya comenzó!'
        )}
      </p>
      <Image
        src="/login/logos-ras.png"
        alt="Scouts de Colombia y Antioquia Scout"
        width={1309}
        height={290}
        className="h-8 w-auto shrink-0"
      />
    </div>
  );
}
