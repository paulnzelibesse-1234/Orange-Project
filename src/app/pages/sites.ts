import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { Site } from '../core/models';

/**
 * Sites & responsables (Responsable IT) : responsable de chaque site et son code de validation,
 * saisi sur place pour valider les rapports d'intervention terrain.
 */
@Component({
  selector: 'app-sites',
  imports: [FormsModule],
  template: `
    <header class="page-head">
      <div>
        <h1>Sites & responsables</h1>
        <p class="muted">
          Le responsable de chaque site valide les rapports d'intervention terrain en saisissant son <strong>code de validation</strong>.
          Communiquez-lui son code personnellement : il n'est jamais affiché ensuite.
        </p>
      </div>
    </header>

    <div class="barre">
      <select [ngModel]="zone()" (ngModelChange)="zone.set($event)" aria-label="Zone">
        <option [ngValue]="null">Toutes zones</option>
        @for (z of zones(); track z) { <option [ngValue]="z">{{ z }}</option> }
      </select>
      <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Rechercher un site, une commune, un responsable…" />
    </div>

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }
    @if (succes()) { <div class="alert success">{{ succes() }}</div> }

    <div class="card no-pad">
      <table class="table">
        <thead><tr><th>Zone</th><th>Commune</th><th>Site</th><th>Responsable du site</th><th>Téléphone</th><th>Code</th><th></th></tr></thead>
        <tbody>
          @for (s of visibles(); track s.id) {
            @if (edition() === s.id) {
              <tr class="edition">
                <td>{{ s.zone_nom }}</td><td>{{ s.commune }}</td><td><strong>{{ s.nom }}</strong></td>
                <td><input [(ngModel)]="form.responsable_nom" placeholder="Nom du responsable" /></td>
                <td><input [(ngModel)]="form.responsable_telephone" placeholder="Téléphone" /></td>
                <td><input [(ngModel)]="form.code" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"
                           [placeholder]="s.code_defini ? 'Inchangé' : '4 à 8 chiffres'" /></td>
                <td class="actions">
                  <button class="btn primary" [disabled]="!form.responsable_nom.trim() || busy()" (click)="sauvegarder(s)">💾 Sauvegarder</button>
                  <button class="btn" (click)="edition.set(null)">Annuler</button>
                </td>
              </tr>
            } @else {
              <tr>
                <td>{{ s.zone_nom }}</td><td>{{ s.commune }}</td><td><strong>{{ s.nom }}</strong></td>
                <td>{{ s.responsable_nom ?? '—' }}</td>
                <td>{{ s.responsable_telephone ?? '—' }}</td>
                <td>
                  @if (+(s.code_defini ?? 0)) { <span class="badge d-ok">Défini</span> } @else { <span class="badge d-hors">Aucun</span> }
                </td>
                <td><button class="btn" (click)="modifier(s)">Modifier</button></td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .barre { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
    .barre select { width: auto; }
    .barre input { flex: 1; min-width: 220px; }
    .no-pad { overflow-x: auto; }
    tr.edition td { background: #fff7f0; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
  `,
})
export class SitesPage {
  private api = inject(ApiService);

  sites = signal<Site[]>([]);
  zone = signal<string | null>(null);
  q = signal('');
  edition = signal<number | null>(null);
  busy = signal(false);
  erreur = signal('');
  succes = signal('');
  form = { responsable_nom: '', responsable_telephone: '', code: '' };

  zones = computed(() => [...new Set(this.sites().map((s) => s.zone_nom))]);
  visibles = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.sites().filter((s) =>
      (this.zone() === null || s.zone_nom === this.zone()) &&
      (!q || [s.nom, s.commune ?? '', s.responsable_nom ?? ''].some((v) => v.toLowerCase().includes(q))));
  });

  constructor() {
    this.charger();
  }

  charger() {
    this.api.sites().subscribe({ next: (s) => this.sites.set(s), error: (e) => this.erreur.set(messageErreur(e)) });
  }

  modifier(s: Site) {
    this.succes.set('');
    this.erreur.set('');
    this.form = { responsable_nom: s.responsable_nom ?? '', responsable_telephone: s.responsable_telephone ?? '', code: '' };
    this.edition.set(s.id);
  }

  sauvegarder(s: Site) {
    this.busy.set(true);
    this.erreur.set('');
    this.api.modifierSite(s.id, {
      responsable_nom: this.form.responsable_nom.trim(),
      responsable_telephone: this.form.responsable_telephone.trim() || null,
      code: this.form.code || null,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.edition.set(null);
        this.succes.set(`✔ ${s.nom} : responsable${this.form.code ? ' et code de validation' : ''} sauvegardés`);
        this.charger();
      },
      error: (e) => { this.erreur.set(messageErreur(e)); this.busy.set(false); },
    });
  }
}
