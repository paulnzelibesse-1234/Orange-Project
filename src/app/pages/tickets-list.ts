import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { messageErreur } from '../core/auth.interceptor';
import { MOTIF_ATTENTE_LABELS, STATUT_LABELS, STATUTS, TYPE_ICONES, TYPE_LABELS, aValider, infoDelai, infoDelaiTerrain } from '../core/labels';
import { Ticket, Zone } from '../core/models';

@Component({
  selector: 'app-tickets-list',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="page-head">
      <div>
        <h1>GLPI — Tickets</h1>
        <p class="muted">
          @switch (auth.role()) {
            @case ('RESPONSABLE_IT') { Tous les tickets, toutes zones confondues }
            @case ('IT') { Tous les tickets, toutes zones confondues — cochez « Mes tickets » pour voir ceux qui vous sont attribués }
            @default { Vos demandes de dépannage }
          }
        </p>
      </div>
      @if (!auth.hasRole('RESPONSABLE_IT')) { <a class="btn primary" routerLink="/glpi/nouveau">+ Nouveau ticket</a> }
    </header>

    <form class="card filters" (ngSubmit)="charger()">
      <input name="q" [(ngModel)]="f.q" placeholder="Rechercher (réf., titre…)" />
      <select name="type" [(ngModel)]="f.type" (change)="charger()" aria-label="Type">
        <option value="">Incidents et demandes</option>
        <option value="INCIDENT">⚠ Incidents</option>
        <option value="DEMANDE">📝 Demandes</option>
      </select>
      <select name="statut" [(ngModel)]="f.statut" (change)="charger()">
        <option value="">Tous statuts</option>
        @for (s of statuts; track s) { <option [value]="s">{{ statutLabels[s] }}</option> }
      </select>
      <select name="zone" [(ngModel)]="f.zone_id" (change)="charger()">
        <option value="">Toutes zones</option>
        @for (z of zones(); track z.id) { <option [value]="z.id">{{ z.nom }}</option> }
      </select>
      <label class="check"><input type="checkbox" name="hd" [(ngModel)]="f.hors_delai" (change)="charger()" /> Hors délai</label>
      @if (auth.hasRole('IT')) {
        <label class="check"><input type="checkbox" name="mine" [(ngModel)]="f.mine" (change)="charger()" /> Mes tickets</label>
      }
      <button class="btn">Filtrer</button>
    </form>

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }

    <div class="card no-pad">
      <table class="table">
        <thead>
          <tr>
            <th>Réf.</th><th>Type</th><th>Titre</th><th>Localisation</th><th>Zone</th><th>Demandeur</th><th>Technicien</th>
            <th>Créé le</th><th>Statut</th><th>Délai (8 h)</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (t of tickets(); track t.id) {
            <tr class="clickable" [routerLink]="['/glpi', t.id]">
              <td class="ref">{{ t.reference }}</td>
              <td><span class="badge t-{{ t.type }}">{{ typeIcones[t.type] }} {{ typeLabels[t.type] }}</span></td>
              <td><a class="titre" [routerLink]="['/glpi', t.id]">{{ t.titre }}</a></td>
              <td class="loc">{{ t.localisation ?? '—' }}</td>
              <td>{{ t.zone_nom }}</td>
              <td>{{ t.createur_nom }}</td>
              <td>{{ t.technicien_nom ?? '—' }}</td>
              <td>{{ t.cree_le | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>
                <span class="badge s-{{ t.statut }}">{{ statutLabels[t.statut] }}</span>
                @if (t.statut === 'EN_ATTENTE' && t.motif_attente) { <br /><small class="muted">{{ motifLabels[t.motif_attente] }}</small> }
                @if (aValider(t)) { <br /><span class="badge b-valider mt">Validation client</span> }
                @else if (+t.action_terrain && t.statut !== 'RESOLU') { <br /><span class="badge b-terrain mt">🛠 Terrain</span> }
              </td>
              <td>
                @let d = delai(t);
                <span class="badge {{ d.classe }}" [title]="d.titre">{{ d.texte }}</span>
                @let dt = delaiTerrain(t);
                @if (dt) { <br /><span class="badge mt {{ dt.classe }}" [title]="dt.titre">{{ dt.texte }}</span> }
              </td>
              <td><a class="btn voir" [routerLink]="['/glpi', t.id]">Voir le détail</a></td>
            </tr>
          } @empty {
            <tr><td colspan="10" class="muted center">{{ loading() ? 'Chargement…' : 'Aucun ticket' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    .filters input[name=q] { flex: 1; min-width: 200px; }
    .check { display: flex; gap: 6px; align-items: center; margin: 0; }
    .mt { margin-top: 4px; }
    .titre { color: inherit; font-weight: 600; text-decoration: none; }
    .titre:hover { color: var(--orange-dark); text-decoration: underline; }
    .voir { white-space: nowrap; padding: 5px 10px; font-size: 13px; }
    .loc { font-size: 13px; color: var(--muted); max-width: 220px; }
    .no-pad { overflow-x: auto; }
  `,
})
export class TicketsListPage {
  auth = inject(AuthService);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  statuts = STATUTS;
  statutLabels = STATUT_LABELS;
  delai = infoDelai;
  delaiTerrain = infoDelaiTerrain;
  aValider = aValider;
  motifLabels = MOTIF_ATTENTE_LABELS;
  typeLabels = TYPE_LABELS;
  typeIcones = TYPE_ICONES;

  tickets = signal<Ticket[]>([]);
  zones = signal<Zone[]>([]);
  loading = signal(false);
  erreur = signal('');
  f = { q: '', type: '', statut: '', zone_id: '', mine: false, hors_delai: false };

  constructor() {
    this.api.zones().subscribe((z) => this.zones.set(z));
    this.route.queryParamMap.subscribe((p) => {
      this.f.statut = p.get('statut') ?? '';
      this.f.type = p.get('type') ?? '';
      this.f.hors_delai = p.get('hors_delai') === '1';
      this.charger();
    });
  }

  charger() {
    this.loading.set(true);
    this.erreur.set('');
    this.api.tickets({ ...this.f, mine: this.f.mine ? 1 : '', hors_delai: this.f.hors_delai ? 1 : '' }).subscribe({
      next: (t) => { this.tickets.set(t); this.loading.set(false); },
      error: (e) => { this.erreur.set(messageErreur(e)); this.loading.set(false); },
    });
  }
}
