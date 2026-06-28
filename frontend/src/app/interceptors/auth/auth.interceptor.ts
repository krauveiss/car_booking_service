import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const matches = document.cookie.match(/(?:^|; )token=([^;]*)/);
  const token = matches ? decodeURIComponent(matches[1]) : null;

  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(cloned)
  }
  return next(req);
};
