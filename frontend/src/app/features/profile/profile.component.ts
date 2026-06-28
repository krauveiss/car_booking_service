import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Auth } from '../../services/auth.service';
import { UserProfile } from '../../services/auth.service.models';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, DatePipe],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class Profle implements OnInit {
  private authService = inject(Auth);

  profile = signal<UserProfile | null>(null);
  isLoading = signal<boolean>(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.authService.getProfile().subscribe({
      next: (data) => {
        this.profile.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Не удалось загрузить данные профиля');
        this.isLoading.set(false);
      }
    });
  }
}