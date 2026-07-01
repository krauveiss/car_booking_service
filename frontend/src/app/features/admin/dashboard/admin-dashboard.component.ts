import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../services/auth/auth.service';
import { UserProfile } from '../../../services/auth/auth.service.models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(Auth);
  private router = inject(Router);

  profile = signal<UserProfile | null>(null);

  ngOnInit(): void {
    this.authService.getProfile().subscribe({
      next: (profile) => this.profile.set(profile),
      error: () => this.profile.set(null)
    });
  }

  goToUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  goToBookingLogs(): void {
    this.router.navigate(['/admin/booking-logs']);
  }
}
