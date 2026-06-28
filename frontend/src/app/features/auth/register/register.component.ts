import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Auth } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class Register {

  private authService = inject(Auth);

  errorMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  registerForm = new FormGroup(
    {
      username: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3)]
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)]
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      })
    }, {
    validators: this.passwordMatchValidator
  }
  )

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    return password === confirmPassword ? null : { passwordMissmatch: true }
  };

  onSubmit(): void {
    if (this.registerForm.valid) {
      const { username, password } = this.registerForm.getRawValue();

      this.authService.register({ username, password }).subscribe({
        next: (response) => {
          this.isLoading.set(true);
          console.log("Успешный рег", response)
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.error?.message || "Ошибка");
        }
      })
    }
  }
}
