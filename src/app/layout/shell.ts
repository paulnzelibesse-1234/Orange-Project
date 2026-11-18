import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Notification, NotificationsService } from '../core/notifications.service';
import { AuthService } from '../core/auth.service';
import { ROLE_LABELS } from '../core/labels';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="images/logo-orange.jpg" alt="Orange" class="brand-logo" />
          <div>
            <strong>Orange CI</strong>
            <small>Interventions & dépannage</small>
          </div>
        </div>

        <!-- Notifications (techniciens IT et Responsable IT) -->
        @if (!auth.hasRole('UTILISATEUR')) {
          <button class="cloche" [class.active]="panneau()" (click)="panneau.set(!panneau())" aria-label="Notifications">
            🔔 Notifications
            @if (notifs.nonLues()) { <span class="pastille">{{ notifs.nonLues() }}</span> }
          </button>
        }

        <nav>
          <a routerLink="/tableau-de-bord" routerLinkActive="active">Tableau de bord</a>
          @if (!auth.hasRole('UTILISATEUR')) {
            <a routerLink="/glpi" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">GLPI — Tickets</a>
            <a routerLink="/corbeille-terrain" routerLinkActive="active">
              🛠 Corbeille terrain
              @if (notifs.ticketsTerrainNonLus().size) {
                <span class="pastille" title="Nouveaux points nécessitant une action terrain">{{ notifs.ticketsTerrainNonLus().size }}</span>
              }
            </a>
            <a routerLink="/journal-terrain" routerLinkActive="active">🚐 Journal terrain</a>
          }
          @if (!auth.hasRole('RESPONSABLE_IT')) {
            <a routerLink="/glpi/nouveau" routerLinkActive="active">Signaler un problème</a>
          }
          @if (auth.hasRole('UTILISATEUR')) {
            <a routerLink="/mes-signalements" routerLinkActive="active">Mes signalements</a>
          }
          @if (auth.hasRole('RESPONSABLE_IT')) {
            <div class="nav-section">Administration</div>
            <a routerLink="/performances" routerLinkActive="active">Performances</a>
            <a routerLink="/utilisateurs" routerLinkActive="active">Utilisateurs & groupes</a>
            <a routerLink="/sites" routerLinkActive="active">Sites & responsables</a>
          }
        </nav>

        <div class="profile">
          <div class="avatar">{{ initiales() }}</div>
          <div class="who">
            <strong>{{ auth.user()?.prenom }} {{ auth.user()?.nom }}</strong>
            <small>{{ roleLabel() }}@if (auth.user()?.groupe_nom) { · {{ auth.user()?.groupe_nom }} }</small>
          </div>
          <button class="btn-link" (click)="auth.logout()" title="Se déconnecter">Déconnexion</button>
        </div>
      </aside>

      @if (panneau()) {
        <div class="voile" (click)="panneau.set(false)"></div>
        <section class="panneau-notifs" role="dialog" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            @if (notifs.nonLues()) { <button class="btn-link" (click)="notifs.toutMarquerLu()">Tout marquer comme lu</button> }
          </header>
          @for (n of notifs.liste(); track n.id) {
            <button class="notif" [class.non-lue]="!n.lu" (click)="ouvrir(n)">
              <span class="icone">{{ n.type === 'TERRAIN' ? '🛠' : n.type === 'COMPTE' ? '👤' : '🔔' }}</span>
              <span>
                <span class="texte">{{ n.message }}</span>
                <small>{{ n.cree_le | date: 'dd/MM/yyyy HH:mm' }}</small>
              </span>
            </button>
          } @empty {
            <p class="vide">Aucune notification.</p>
          }
        </section>
      }

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .shell { display: flex; min-height: 100vh; }
    .sidebar { width: 250px; background: #1b1b1b; color: #eee; display: flex; flex-direction: column; padding: 18px 14px; position: sticky; top: 0; height: 100vh; }
    .brand { display: flex; gap: 10px; align-items: center; margin-bottom: 28px; }
    .brand small { display: block; color: #aaa; font-size: 12px; }
    .brand-logo { width: 46px; height: 46px; object-fit: cover; flex-shrink: 0; clip-path: inset(4%); }
    nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    nav a { color: #ddd; text-decoration: none; padding: 9px 12px; border-radius: 6px; }
    nav a:hover { background: #2c2c2c; }
    nav a.active { background: var(--orange); color: #000; font-weight: 600; }
    .nav-section { margin: 18px 12px 6px; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: .05em; }
    .profile { border-top: 1px solid #333; padding-top: 14px; display: grid; grid-template-columns: auto 1fr; gap: 8px 10px; align-items: center; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: #444; display: grid; place-items: center; font-weight: 700; }
    .who small { display: block; color: #aaa; font-size: 12px; }
    .profile .btn-link { grid-column: 1 / -1; color: #ff9d4d; text-align: left; }
    .content { flex: 1; padding: 28px 32px; min-width: 0; }
    .cloche { display: flex; align-items: center; gap: 8px; width: 100%; margin: -12px 0 14px; padding: 9px 12px;
              background: #2a2a2a; color: #eee; border: 1px solid #3a3a3a; border-radius: 6px; cursor: pointer; font: inherit; text-align: left; }
    .cloche:hover, .cloche.active { border-color: var(--orange); }
    .pastille { margin-left: auto; min-width: 20px; padding: 1px 7px; border-radius: 999px; background: #e53935; color: #fff;
                font-size: 12px; font-weight: 700; text-align: center; }
    nav a { display: flex; align-items: center; gap: 6px; }
    .voile { position: fixed; inset: 0; z-index: 20; }
    .panneau-notifs { position: fixed; z-index: 21; left: 262px; top: 16px; width: 400px; max-width: calc(100vw - 32px);
                      max-height: 75vh; overflow-y: auto; background: var(--card); color: var(--text); border: 1px solid var(--border);
                      border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.18); }
    .panneau-notifs header { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px;
                             border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--card); }
    .notif { display: flex; gap: 10px; width: 100%; padding: 10px 14px; border: none; border-bottom: 1px solid var(--border);
             background: none; text-align: left; cursor: pointer; font: inherit; color: inherit; }
    .notif:hover { background: var(--bg-soft); }
    .notif.non-lue { background: #fff7f0; }
    .notif.non-lue .texte { font-weight: 600; }
    .notif small { display: block; color: var(--muted); margin-top: 3px; font-size: 12px; }
    .notif .icone { font-size: 18px; }
    .vide { padding: 18px 14px; color: var(--muted); margin: 0; }
    @media (max-width: 800px) {
      .shell { flex-direction: column; }
      .sidebar { width: auto; height: auto; position: static; }
      .content { padding: 16px; }
      .panneau-notifs { left: 16px; right: 16px; width: auto; }
    }
  `,
})
export class Shell {
  auth = inject(AuthService);
  notifs = inject(NotificationsService);
  private router = inject(Router);
  panneau = signal(false);

  constructor() {
    if (!this.auth.hasRole('UTILISATEUR')) {
      this.notifs.demarrer();
      inject(DestroyRef).onDestroy(() => this.notifs.arreter());
    }
  }

  ouvrir(n: Notification) {
    this.panneau.set(false);
    if (n.ticket_id) this.router.navigate(['/glpi', n.ticket_id]);
    else if (n.type === 'COMPTE') this.router.navigate(['/utilisateurs']);
  }
  roleLabel = computed(() => (this.auth.role() ? ROLE_LABELS[this.auth.role()!] : ''));
  initiales = computed(() => {
    const u = this.auth.user();
    return u ? (u.prenom[0] + u.nom[0]).toUpperCase() : '';
  });
}
