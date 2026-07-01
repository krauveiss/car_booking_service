import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface AdminUser {
  id: number;
  username: string;
  accepted: boolean;
  role: string;
  position: string;
  created_at: string;
}

interface AdminUsersResponse {
  data: AdminUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Component({
  selector: 'app-users',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  private http = inject(HttpClient);

  users = signal<AdminUser[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  meta = signal({ total: 0, page: 1, limit: 10, totalPages: 1 });

  filterForm = new FormGroup({
    search: new FormControl(''),
    accepted: new FormControl('all')
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(page = 1): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    const search = this.filterForm.value.search?.trim() || '';
    const accepted = this.filterForm.value.accepted || 'all';
    const params: Record<string, string | number> = { page, limit: this.meta().limit };

    if (search) {
      params['search'] = search;
    }

    if (accepted !== 'all') {
      params['accepted'] = accepted;
    }

    this.http.get<AdminUsersResponse>(`${environment.apiUrl}/admin/users`, { params }).subscribe({
      next: (response) => {
        this.users.set(response.data);
        this.meta.set(response.meta);
        this.loading.set(false);
        this.successMessage.set(null);
      },
      error: () => {
        this.errorMessage.set('Не удалось загрузить пользователей');
        this.loading.set(false);
      }
    });
  }

  applyFilters(): void {
    this.loadUsers(1);
  }

  changePage(page: number): void {
    this.loadUsers(page);
  }

  updateUser(user: AdminUser): void {
    this.http.put(`${environment.apiUrl}/admin/users/${user.id}`, {
      role: user.role,
      accepted: user.accepted,
      position: user.position
    }).subscribe({
      next: () => {
        this.successMessage.set('Пользователь обновлён');
        this.loadUsers(this.meta().page);
      },
      error: () => {
        this.errorMessage.set('Не удалось обновить пользователя');
      }
    });
  }
}
