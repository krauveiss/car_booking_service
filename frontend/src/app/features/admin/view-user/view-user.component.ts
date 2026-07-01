import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface UserProfile {
  id: number;
  username: string;
  accepted: boolean;
  role: string;
  position: string;
  created_at: string;
}

@Component({
  selector: 'app-view-user',
  imports: [CommonModule, RouterLink],
  templateUrl: './view-user.component.html',
  styleUrl: './view-user.component.scss',
})
export class ViewUserComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  user = signal<UserProfile | null>(null);
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage.set('Не указан ID пользователя');
      return;
    }

    this.loadUser(Number(id));
  }

  private loadUser(id: number): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.http.get<UserProfile>(`${environment.apiUrl}/users/${id}`).subscribe({
      next: (profile) => {
        this.user.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Не удалось загрузить пользователя');
        this.loading.set(false);
      }
    });
  }
}
