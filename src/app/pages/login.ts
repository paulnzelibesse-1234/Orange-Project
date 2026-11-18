import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AuthLayout } from '../layout/auth-layout';
import { messageErreur } from '../core/auth.interceptor';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, AuthLayout],
  styles: `
    .separateur { display: flex; align-items: center; gap: 10px; margin: 18px 0 10px; color: var(--muted); font-size: 13px; }
    .separateur::before, .separateur::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .creer { border: 2px solid var(--orange); color: var(--orange-dark); font-weight: 600; text-align: center; text-decoration: none; padding: 10px 16px; }
    .creer:hover { background: #fff7f0; }
    .petit { font-size: 12.5px; margin-top: 8px; }
    .info-attente { background: #fff8e1; color: #6d4c00; border: 1px solid #ffe082; }
  `,
  template: `
    <app-auth-layout>
      <form class="auth-form" (ngSubmit)="submit()">
        <div class="auth-head">
          <h1>Connexion</h1>
          <p class="muted">Planification et suivi des interventions de dépannage</p>
        </div>

        @if (erreur()) { <div class="alert" [class.error]="!attente()" [class.info-attente]="attente()" role="alert">{{ attente() ? '⏳ ' : '' }}{{ erreur() }}</div> }

        <label>Email
          <input type="email" name="email" [(ngModel)]="email" required autocomplete="username" />
        </label>
        <label>Mot de passe
          <input type="password" name="mdp" [(ngModel)]="motDePasse" required autocomplete="current-password" />
        </label>

        <button class="btn primary full" [disabled]="loading()">
          {{ loading() ? 'Connexion…' : 'Se connecter' }}
        </button>
        <div class="separateur"><span>Nouveau sur l'application ?</span></div>
        <a class="btn full creer" routerLink="/inscription">Créer un compte</a>
        <p class="muted center petit">Utilisateur, Technicien IT ou Responsable IT.</p>
      </form>
    </app-auth-layout>
  `,
})
export class LoginPage {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  motDePasse = '';
  loading = signal(false);
  erreur = signal('');
  attente = signal(false);

  submit() {
    this.loading.set(true);
    this.erreur.set('');
    this.auth.login(this.email, this.motDePasse).subscribe({
      next: () => this.router.navigate(['/tableau-de-bord']),
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        // Adresse non vérifiée : un nouveau code a été envoyé, on termine la vérification
        if (e.error?.code === 'EMAIL_NON_VERIFIE') {
          this.router.navigate(['/verification'], { queryParams: { email: e.error.email, attendre: e.error.attendre } });
          return;
        }
        this.attente.set(e.error?.code === 'EN_ATTENTE');
        this.erreur.set(messageErreur(e));
      },
    });
  }
}
