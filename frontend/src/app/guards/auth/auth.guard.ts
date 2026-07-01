import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { Auth } from '../../services/auth/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(Auth);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  return authService.getProfile().pipe(
    map((profile) => {
      if (!profile.accepted) {
        router.navigate(['/dashboard']);
        return false;
      }

      return true;
    }),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};
