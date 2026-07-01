import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface BookingLog {
  id: number;
  car_id: number;
  car_brand: string;
  car_model: string;
  registration_number: string;
  action: string;
  user_id: number | null;
  username: string | null;
  details: string;
  created_at: string;
}

@Component({
  selector: 'app-booking-logs',
  imports: [CommonModule, RouterLink],
  templateUrl: './booking-logs.component.html',
  styleUrl: './booking-logs.component.scss'
})
export class BookingLogsComponent implements OnInit {
  private http = inject(HttpClient);

  logs = signal<BookingLog[]>([]);
  loading = signal(false);
  meta = signal({ total: 0, page: 1, limit: 20, totalPages: 1 });

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(page = 1): void {
    this.loading.set(true);
    this.http.get<{ data: BookingLog[]; meta: { total: number; page: number; limit: number; totalPages: number } }>(`${environment.apiUrl}/admin/booking-logs`, { params: { page, limit: this.meta().limit } }).subscribe({
      next: (response) => {
        this.logs.set(response.data);
        this.meta.set(response.meta);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  changePage(page: number): void {
    this.loadLogs(page);
  }
}
