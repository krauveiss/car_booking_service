import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { RouterLink } from '@angular/router';

interface CarItem {
  id: number;
  brand: string;
  model: string;
  registration_number: string;
  color: string;
  seats: number;
  purpose: string;
  status: string;
  reserved_by: number | null;
  reserved_at: string | null;
  expires_at: string | null;
  confirmed_at: string | null;
  isReservedByMe: boolean;
  canConfirm: boolean;
  canFinish: boolean;
  canCancel: boolean;
}

@Component({
  selector: 'app-cars',
  imports: [CommonModule, RouterLink],
  templateUrl: './cars.component.html',
  styleUrl: './cars.component.scss'
})
export class CarsComponent implements OnInit {
  private http = inject(HttpClient);

  cars = signal<CarItem[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCars();
  }

  loadCars(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.http.get<{ data: CarItem[] }>(`${environment.apiUrl}/booking/cars`).subscribe({
      next: (response) => {
        this.cars.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Не удалось загрузить список автомобилей');
        this.loading.set(false);
      }
    });
  }

  reserveCar(car: CarItem): void {
    this.http.post(`${environment.apiUrl}/booking/cars/${car.id}/reserve`, {}).subscribe({
      next: () => {
        this.successMessage.set('Автомобиль забронирован');
        this.loadCars();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Не удалось забронировать автомобиль');
      }
    });
  }

  confirmCar(car: CarItem): void {
    this.http.post(`${environment.apiUrl}/booking/cars/${car.id}/confirm`, {}).subscribe({
      next: () => {
        this.successMessage.set('Бронирование подтверждено');
        this.loadCars();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Не удалось подтвердить бронирование');
      }
    });
  }

  finishCar(car: CarItem): void {
    this.http.post(`${environment.apiUrl}/booking/cars/${car.id}/finish`, {}).subscribe({
      next: () => {
        this.successMessage.set('Использование автомобиля завершено');
        this.loadCars();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Не удалось завершить использование');
      }
    });
  }

  cancelReservation(car: CarItem): void {
    this.http.post(`${environment.apiUrl}/booking/cars/${car.id}/cancel`, {}).subscribe({
      next: () => {
        this.successMessage.set('Бронь отменена');
        this.loadCars();
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Не удалось отменить бронь');
      }
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'free':
        return 'Свободна';
      case 'reserved':
        return 'Забронирована';
      case 'busy':
        return 'Занята';
      case 'blocked':
        return 'Заблокирована';
      default:
        return status;
    }
  }
}
