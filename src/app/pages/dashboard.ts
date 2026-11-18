import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Dashboard } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { messageErreur } from '../core/auth.interceptor';
import { STATUT_LABELS, STATUTS, aValider, infoDelai } from '../core/labels';
import { Statut, Ticket } from '../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe],
  template: `
    <header class="page-head">
      <div>
        <h1>Bonjour {{ auth.user()?.prenom }}</h1>
        <p class="muted">{{ sousTitre() }}</p>
      </div>
      @if (auth.hasRole('RESPONSABLE_IT')) {
        <a class="btn primary" routerLink="/corbeille-terrain">🛠 Corbeille terrain</a>
      } @else {
        <a class="btn primary" routerLink="/glpi/nouveau">+ Signaler un problème</a>
      }
    </header>

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }

    <section class="stats">
      @for (s of statuts; track s) {
        <a class="stat card" [routerLink]="['/glpi']" [queryParams]="{ statut: s }">
          <span class="badge s-{{ s }}">{{ statutLabels[s] }}</span>
          <strong>{{ compte(s) }}</strong>
        </a>
      }
      <a class="stat card" [routerLink]="['/glpi']" [queryParams]="{ hors_delai: 1 }">
        <span class="badge d-hors">Hors délai (8 h)</span>
        <strong>{{ data()?.horsDelai ?? 0 }}</strong>
      </a>
    </section>

    <div class="grid-2 gap">
      <section class="card">
        <h2>{{ titreListe() }}</h2>
        @if (aTraiter().length === 0) {
          <p class="muted">Rien à traiter pour le moment.</p>
        } @else {
          <ul class="list">
            @for (t of aTraiter(); track t.id) {
              <li>
                <a [routerLink]="['/glpi', t.id]">
                  <span class="ref">{{ t.reference }}</span> {{ t.titre }}
                </a>
                <div class="meta">
                  <span class="badge s-{{ t.statut }}">{{ statutLabels[t.statut] }}</span>
                  @let d = delai(t);
                  <span class="badge {{ d.classe }}" [title]="d.titre">{{ d.texte }}</span>
                  @if (aValider(t)) { <span class="badge b-valider">À valider</span> }
                  <span>{{ t.zone_nom }}</span>
                  <span class="muted">{{ t.cree_le | date: 'dd/MM HH:mm' }}</span>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <section class="card">
        <h2>Tickets par zone</h2>
        <table class="table">
          <thead><tr><th>Zone</th><th>Total</th><th>Ouverts</th></tr></thead>
          <tbody>
            @for (z of data()?.parZone ?? []; track z.zone) {
              <tr><td>{{ z.zone }}</td><td>{{ z.total }}</td><td>{{ z.ouverts ?? 0 }}</td></tr>
            }
          </tbody>
        </table>
      </section>
    </div>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .stat { display: flex; flex-direction: column; gap: 10px; text-decoration: none; color: inherit; }
    .stat strong { font-size: 28px; }
    .list { list-style: none; padding: 0; margin: 0; }
    .list li { padding: 10px 0; border-bottom: 1px solid var(--border); }
    .list a { color: inherit; text-decoration: none; font-weight: 500; }
    .meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; font-size: 13px; flex-wrap: wrap; }
  `,
})
export class DashboardPage {
  auth = inject(AuthService);
  private api = inject(ApiService);

  statuts = STATUTS;
  statutLabels = STATUT_LABELS;
  delai = infoDelai;
  aValider = aValider;

  data = signal<Dashboard | null>(null);
  tickets = signal<Ticket[]>([]);
  erreur = signal('');

  sousTitre = computed(() => ({
    RESPONSABLE_IT: 'Vue globale des interventions sur toutes les zones',
    IT: 'Compteurs de vos interventions attribuées',
    UTILISATEUR: 'Suivi de vos demandes de dépannage',
  })[this.auth.role() ?? 'UTILISATEUR']);

  titreListe = computed(() => ({
    RESPONSABLE_IT: 'Tickets sans technicien',
    IT: 'Tickets à prendre en charge et mes interventions',
    UTILISATEUR: 'Mes demandes en cours et résolutions à valider',
  })[this.auth.role() ?? 'UTILISATEUR']);

  aTraiter = computed(() => {
    const role = this.auth.role();
    const me = this.auth.user()?.id;
    // Les tickets hors délai d'abord
    return this.tickets()
      .filter((t) =>
        role === 'UTILISATEUR' ? t.createur_id === me && (t.statut !== 'RESOLU' || aValider(t))
        : t.statut !== 'RESOLU' && (role === 'RESPONSABLE_IT' ? !t.technicien_id : !t.technicien_id || t.technicien_id === me))
      .sort((a, b) => Number(b.hors_delai) - Number(a.hors_delai) || b.delai_ecoule_s - a.delai_ecoule_s)
      .slice(0, 8);
  });

  constructor() {
    const err = (e: unknown) => this.erreur.set(messageErreur(e));
    this.api.dashboard().subscribe({ next: (d) => this.data.set(d), error: err });
    this.api.tickets().subscribe({ next: (t) => this.tickets.set(t), error: err });
  }

  compte(s: Statut) {
    return this.data()?.parStatut.find((x) => x.statut === s)?.total ?? 0;
  }
}
