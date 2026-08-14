'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { markNotificationsReadAction } from './actions';
import { Button } from '@/components/ui';
import { internalRoute } from '@/lib/routes';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  kind: string;
  unread: boolean;
  when: string;
}

const KIND_DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-sky-500',
};

export function NotificationList({
  notifications,
  hasUnread,
  tone = 'light',
}: {
  notifications: NotificationItem[];
  hasUnread: boolean;
  /** "dark" se usa sobre fondos de color sólido (el panel morado de Avisos). */
  tone?: 'light' | 'dark';
}) {
  const [pending, startTransition] = useTransition();
  const dark = tone === 'dark';

  return (
    <div>
      <ul className="space-y-3">
        {notifications.map((notification) => {
          const content = (
            <>
              <span
                aria-hidden
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  KIND_DOT[notification.kind] ?? KIND_DOT.info
                }`}
              />
              <div className="min-w-0">
                <p
                  className={`text-sm ${
                    dark
                      ? 'font-semibold text-white'
                      : notification.unread
                        ? 'font-bold text-navy'
                        : 'text-navy'
                  }`}
                >
                  {notification.title}
                </p>
                {notification.body && (
                  <p className={`text-sm ${dark ? 'text-white/80' : 'text-slate-600'}`}>
                    {notification.body}
                  </p>
                )}
                <p className={`mt-0.5 text-xs ${dark ? 'text-white/55' : 'text-slate-400'}`}>
                  {notification.when}
                </p>
              </div>
            </>
          );

          return (
            <li key={notification.id}>
              {notification.link ? (
                <Link
                  href={internalRoute(notification.link)}
                  className={`flex gap-3 rounded-lg p-1 transition-colors ${
                    dark ? 'hover:bg-white/10' : 'hover:bg-canvas'
                  }`}
                >
                  {content}
                </Link>
              ) : (
                <div className="flex gap-3 p-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {hasUnread && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={`mt-4 ${dark ? '!border-white/30 !text-white hover:!bg-white/10' : ''}`}
          disabled={pending}
          onClick={() => startTransition(() => markNotificationsReadAction())}
        >
          {pending ? 'Marcando…' : 'Marcar todo como leído'}
        </Button>
      )}
    </div>
  );
}
