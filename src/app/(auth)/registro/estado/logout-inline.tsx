'use client';

import { logoutAction } from '../../actions';
import { Button } from '@/components/ui';

export function LogoutInline() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost">
        Cerrar sesión
      </Button>
    </form>
  );
}
