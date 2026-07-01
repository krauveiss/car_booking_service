import { Routes } from '@angular/router';
import { authGuard } from './guards/auth/auth.guard';


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
    }

];
