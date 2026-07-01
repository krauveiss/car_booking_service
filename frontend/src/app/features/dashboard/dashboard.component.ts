import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth/auth.service';
import { UserProfile } from '../../services/auth/auth.service.models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class Dashboard implements OnInit {
  private authService = inject(Auth);
  private router = inject(Router);

  currentUser = signal<UserProfile | null>(null);
  isAdmin = signal(false);

  ngOnInit(): void {
    this.authService.getProfile().subscribe({
      next: (profile) => {
        this.currentUser.set(profile);
        this.isAdmin.set(profile.role === 'Администратор');
      },
      error: () => {
        this.currentUser.set(null);
        this.isAdmin.set(false);
      }
    });
  }

  onLogout(): void {
    this.authService.logout();
  }

  navigateToBooking(): void {
    this.router.navigate(['/booking/cars'])
  }
}
