import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from './auth.service.models';
import { Router } from '@angular/router';


@Injectable({
  providedIn: 'root',
})

export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<AuthResponse | null>(null);

  register(cred: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, cred).pipe(
      tap((response) => {
        this.currentUser.set(response);
        const cookieName = 'token';
        const cookieValue = response.token;
        const maxAge = 7 * 24 * 60 * 60;

        document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}` +
          `; max-age=${maxAge}` +
          `; path=/` +
          `; secure` +
          `; SameSite=Strict`;


      })
    )
  }

  login(cred: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, cred).pipe(
      tap((response) => {
        if (response.accepted) {

          this.currentUser.set(response);
          const cookieName = 'token';
          const cookieValue = response.token;
          const maxAge = 7 * 24 * 60 * 60;

          document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}` +
            `; max-age=${maxAge}` +
            `; path=/` +
            `; secure` +
            `; SameSite=Strict`;
        }
      })
    );
  }

  logout(): void {
    this.currentUser.set(null);
    document.cookie = 'token=; max-age=0; path=/; secure; SameSite=Strict';
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return document.cookie.includes('token=');
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/auth/me`);
  }

}
