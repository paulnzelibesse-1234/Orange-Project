import { Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { AuthLayout } from '../layout/auth-layout';
import { messageErreur } from '../core/auth.interceptor';

/**
 * Vérification de l'adresse email : saisie du code OTP à 6 chiffres reçu par email.
 * Paramètres : ?email=…&attendre=<s avant renvoi>&dev=1 (SMTP non configuré)&validation=1 (profil à faire valider)
 */
@Component({
  selector: 'app-verification',
  imports: [FormsModule, RouterLink, AuthLayout],
  styles: `
    .cases { display: flex; gap: 8px; justify-content: center; margin: 8px 0 16px; }
    .cases input { width: 48px; height: 56px; text-align: center; font-size: 26px; font-weight: 700; padding: 0; border-radius: 8px; }
    .cases input.erreur { border-color: var(--danger); background: #fff5f5; }
    .email { font-weight: 700; word-break: break-all; }
    .renvoi { text-align: center; margin-top: 14px; font-size: 14px; }
    .dev { background: #fff8e1; border: 1px solid #ffe082; color: #6d4c00; border-radius: 6px; padding: 8px 12px; font-size: 13px; margin-bottom: 14px; }
    .attente { text-align: center; }
    .attente .grand { font-size: 46px; }
  `,
  template: `
    <app-auth-layout>
      @if (enAttente()) {
        <div class="auth-form attente">
          <div class="grand" aria-hidden="true">⏳</div>
          <div class="auth-head"><h1>Email vérifié</h1></div>
          <div class="alert success">{{ enAttente() }}</div>
          <a class="btn primary full" routerLink="/login">Retour à la connexion</a>
        </div>
      } @else {
        <form class="auth-form" (ngSubmit)="verifier()">
          <div class="auth-head">
            <h1>Vérifiez votre email</h1>
            <p class="muted">Saisissez le code à 6 chiffres envoyé à <span class="email">{{ email() }}</span>. Il est valable 10 minutes.</p>
          </div>

          @if (dev()) {
            <p class="dev">🧪 Mode développement : aucun service d'email n'est configuré. Le code est affiché dans la console de l'API
              (et dans <code>orange-back/logs/emails-dev.log</code>).</p>
          }
          @if (erreur()) { <div class="alert error" role="alert">{{ erreur() }}</div> }
          @if (info()) { <div class="alert success" role="status">{{ info() }}</div> }

          <div class="cases" (paste)="coller($event)">
            @for (i of [0, 1, 2, 3, 4, 5]; track i) {
              <input #caseCode inputmode="numeric" autocomplete="one-time-code" maxlength="1" [class.erreur]="!!erreur()"
                     [attr.aria-label]="'Chiffre ' + (i + 1)" [value]="chiffres()[i]"
                     (input)="saisir(i, $event)" (keydown)="touche(i, $event)" />
            }
          </div>

          <button class="btn primary full" [disabled]="code().length !== 6 || loading()">
            {{ loading() ? 'Vérification…' : 'Vérifier mon email' }}
          </button>

          <p class="renvoi">
            Vous n'avez rien reçu ? Vérifiez vos courriers indésirables, puis
            @if (attendre() > 0) {
              <span class="muted">renvoyez un code dans {{ attendre() }} s</span>
            } @else {
              <button type="button" class="btn-link" [disabled]="loading()" (click)="renvoyer()">renvoyez un code</button>
            }
          </p>
          <p class="muted center"><a routerLink="/inscription">Modifier mes informations</a> · <a routerLink="/login">Connexion</a></p>
        </form>
      }
    </app-auth-layout>
  `,
})
export class VerificationPage {
  private auth = inject(AuthService);
  private router = inject(Router);
  email = input<string>('');
  attendreInitial = input<string>('60', { alias: 'attendre' });
  dev = input<string>();
  validation = input<string>();

  cases = viewChildren<ElementRef<HTMLInputElement>>('caseCode');
  chiffres = signal<string[]>(['', '', '', '', '', '']);
  code = () => this.chiffres().join('');
  loading = signal(false);
  erreur = signal('');
  info = signal('');
  enAttente = signal('');
  attendre = signal(60);

  constructor() {
    effect(() => this.attendre.set(Number(this.attendreInitial()) || 60));
    effect(() => { if (!this.email()) this.router.navigate(['/inscription']); });
    effect(() => this.cases()[0]?.nativeElement.focus());
    const t = setInterval(() => this.attendre.update((s) => Math.max(0, s - 1)), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  saisir(i: number, e: Event) {
    const input = e.target as HTMLInputElement;
    const v = input.value.replace(/\D/g, '');
    if (v.length > 1) return this.remplir(v); // saisie automatique du code complet
    const c = [...this.chiffres()];
    c[i] = v;
    this.chiffres.set(c);
    input.value = v;
    this.erreur.set('');
    if (v && i < 5) this.cases()[i + 1].nativeElement.focus();
    if (this.code().length === 6) this.verifier();
  }
  touche(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !this.chiffres()[i] && i > 0) this.cases()[i - 1].nativeElement.focus();
    if (e.key === 'ArrowLeft' && i > 0) this.cases()[i - 1].nativeElement.focus();
    if (e.key === 'ArrowRight' && i < 5) this.cases()[i + 1].nativeElement.focus();
  }
  coller(e: ClipboardEvent) {
    const v = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (!v) return;
    e.preventDefault();
    this.remplir(v);
  }
  private remplir(v: string) {
    const c = v.slice(0, 6).split('');
    while (c.length < 6) c.push('');
    this.chiffres.set(c);
    this.cases()[Math.min(v.length, 5)].nativeElement.focus();
    if (this.code().length === 6) this.verifier();
  }
  private vider() {
    this.chiffres.set(['', '', '', '', '', '']);
    this.cases()[0]?.nativeElement.focus();
  }

  verifier() {
    if (this.code().length !== 6 || this.loading()) return;
    this.loading.set(true);
    this.erreur.set('');
    this.info.set('');
    this.auth.verifierOtp(this.email(), this.code()).subscribe({
      next: (r) => {
        this.loading.set(false);
        if (r.token) this.router.navigate(['/tableau-de-bord']);
        else this.enAttente.set(r.message);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.erreur.set(messageErreur(e));
        if (e.status === 409) this.router.navigate(['/login']);
        else this.vider();
      },
    });
  }

  renvoyer() {
    this.loading.set(true);
    this.erreur.set('');
    this.auth.renvoyerOtp(this.email()).subscribe({
      next: (r) => {
        this.loading.set(false);
        this.attendre.set(r.attendre || 60);
        this.info.set('Un nouveau code vous a été envoyé. Les codes précédents ne sont plus valables.');
        this.vider();
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.erreur.set(messageErreur(e));
        if (e.error?.attendre) this.attendre.set(e.error.attendre);
      },
    });
  }
}
