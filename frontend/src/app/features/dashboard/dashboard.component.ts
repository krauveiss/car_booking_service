import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class Dashboard {
  private authService = inject(Auth);
  private router = inject(Router);

  onLogout(): void {
    this.authService.logout();
  }

  navigateToBooking(): void {
    this.router.navigate(['/booking/cars'])
  }
}
