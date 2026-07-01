import { Routes } from '@angular/router';
import { authGuard } from './guards/auth/auth.guard';
import { adminGuard } from './guards/admin/admin.guard';


export const routes: Routes = [
    {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
    },
    {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.Dashboard),
        canActivate: [authGuard]
    },
    {
        path: 'register',
        loadComponent: () => import('./features/auth/register/register.component').then(m => m.Register)
    },
    {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.Login)
    },
    {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.Profle),
        canActivate: [authGuard]
    },
    {
        path: 'booking/cars',
        loadComponent: () => import('./features/booking/cars/cars.component').then(m => m.CarsComponent),
        canActivate: [authGuard]
    },
    {
        path: 'admin',
        loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        canActivate: [authGuard, adminGuard]
    },
    {
        path: 'admin/users',
        loadComponent: () => import('./features/admin/users/users.component').then(m => m.UsersComponent),
        canActivate: [authGuard, adminGuard]
    },
    {
        path: 'admin/booking-logs',
        loadComponent: () => import('./features/admin/booking-logs/booking-logs.component').then(m => m.BookingLogsComponent),
        canActivate: [authGuard, adminGuard]
    },
    {
        path: 'admin/users/:id',
        loadComponent: () => import('./features/admin/view-user/view-user.component').then(m => m.ViewUserComponent),
        canActivate: [authGuard, adminGuard]
    }

];
