import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { messageErreur } from '../core/auth.interceptor';
import { dureeMinutes } from '../core/labels';
import { Groupe, InterventionTerrain } from '../core/models';

/** Journal de toutes les interventions terrain menées par les groupes de techniciens */
@Component({
  selector: 'app-journal-terrain',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="page-head">
      <div>
        <h1>🚐 Journal terrain</h1>
        <p class="muted">Toutes les interventions terrain menées par les groupes de techniciens : qui, quand, combien de temps, quelles actions.</p>
      </div>
      <button class="btn" (click)="charger()" [disabled]="loading()">↻ Actualiser</button>
    </header>

    <form class="card filtres" (ngSubmit)="charger()">
      <label>Groupe
        <select name="groupe" [(ngModel)]="f.groupe_id" (change)="charger()">
          <option value="">Tous les groupes</option>
          @for (g of groupes(); track g.id) { <option [value]="g.id">{{ g.nom }} ({{ g.zone_nom }})</option> }
        </select>
      </label>
      <label>Résultat
        <select name="statut" [(ngModel)]="f.statut" (change)="charger()">
          <option value="">Tous</option>
          <option value="EN_COURS">En cours</option>
          <option value="A_VALIDER">Rapport à valider</option>
          <option value="VALIDEE">Validée</option>
        </select>
      </label>
      <label>Du <input type="date" name="du" [(ngModel)]="f.du" (change)="charger()" /></label>
      <label>Au <input type="date" name="au" [(ngModel)]="f.au" (change)="charger()" /></label>
    </form>

    <section class="compteurs">
      <div class="card stat"><span class="muted">Interventions</span><strong>{{ liste().length }}</strong></div>
      <div class="card stat"><span class="muted">En cours</span><strong class="bleu">{{ compte('EN_COURS') }}</strong></div>
      <div class="card stat"><span class="muted">Rapports à valider</span><strong class="orange">{{ compte('A_VALIDER') }}</strong></div>
      <div class="card stat"><span class="muted">Validées</span><strong class="vert">{{ compte('VALIDEE') }}</strong></div>
      <div class="card stat"><span class="muted">Dont interrompues</span><strong class="rouge">{{ interrompues() }}</strong></div>
      <div class="card stat"><span class="muted">Temps terrain total</span><strong>{{ duree(totalMin()) }}</strong></div>
    </section>

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }

    <div class="card no-pad">
      <table class="table">
        <thead>
          <tr>
            <th>Ticket</th><th>Groupe / intervenants</th><th>Début</th><th>Fin</th><th>Durée</th>
            <th>Statut</th><th>Rapport d'intervention</th>
          </tr>
        </thead>
        <tbody>
          @for (it of liste(); track it.id) {
            <tr class="clickable" [routerLink]="['/glpi', it.ticket_id]">
              <td>
                <span class="ref">{{ it.reference }}</span><br />
                <a class="titre" [routerLink]="['/glpi', it.ticket_id]">{{ it.titre }}</a><br />
                <small class="muted">{{ it.localisation }} · {{ it.zone_nom }}</small>
              </td>
              <td>{{ it.groupe_nom ?? '—' }}<br /><small class="muted">{{ noms(it) }}</small></td>
              <td>{{ it.debut_le | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ it.fin_le ? (it.fin_le | date: 'dd/MM/yyyy HH:mm') : '—' }}</td>
              <td>{{ duree(it.duree_min) }}</td>
              <td>
                <span class="badge" [class]="'b-' + it.statut">{{ libelles[it.statut] }}</span>
                @if (it.resultat === 'INTERROMPUE') { <br /><span class="badge b-INTERROMPUE mt">Interrompue</span> }
              </td>
              <td class="cr">
                @if (it.statut === 'VALIDEE') {
                  {{ it.compte_rendu }}
                  @if (it.motif_interruption) { <br /><small class="rouge">Motif : {{ it.motif_interruption }}</small> }
                  <br /><small class="muted">Validé par {{ it.responsable_site_nom }} le {{ it.valide_le | date: 'dd/MM HH:mm' }}{{ it.appreciation === 'RESERVES' ? ' (avec réserves)' : '' }}</small>
                } @else if (it.statut === 'A_VALIDER') {
                  <span class="muted">En attente du rapport validé par le responsable du site</span>
                } @else {
                  <span class="muted">{{ it.note_depart ? 'Objectif : ' + it.note_depart : 'Intervention en cours' }}</span>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="7" class="muted center">{{ loading() ? 'Chargement…' : 'Aucune intervention terrain sur cette période.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .filtres { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; margin-bottom: 14px; }
    .filtres label { margin: 0; }
    .compteurs { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 14px; }
    .stat { display: flex; flex-direction: column; gap: 6px; }
    .stat strong { font-size: 24px; }
    .bleu { color: #1565c0; } .vert { color: var(--success); } .rouge { color: var(--danger); }
    .no-pad { overflow-x: auto; }
    .titre { color: inherit; font-weight: 600; text-decoration: none; }
    .titre:hover { color: var(--orange-dark); text-decoration: underline; }
    .cr { max-width: 320px; font-size: 13px; }
    .b-EN_COURS { background: #e3f2fd; color: #1565c0; }
    .b-A_VALIDER { background: #fff3e0; color: #e65100; }
    .b-VALIDEE { background: #e8f5e9; color: #2e7d32; }
    .b-INTERROMPUE { background: #fdecea; color: #c62828; }
    .orange { color: #e65100; }
    .mt { margin-top: 4px; }
  `,
})
export class JournalTerrainPage {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  libelles = { EN_COURS: 'En cours', A_VALIDER: 'Rapport à valider', VALIDEE: 'Validée' };
  liste = signal<InterventionTerrain[]>([]);
  groupes = signal<Groupe[]>([]);
  loading = signal(true);
  erreur = signal('');
  // Un technicien voit par défaut les interventions de son groupe
  f = { groupe_id: this.auth.hasRole('IT') && this.auth.user()?.groupe_id ? String(this.auth.user()!.groupe_id) : '', statut: '', du: '', au: '' };

  interrompues = computed(() => this.liste().filter((i) => i.resultat === 'INTERROMPUE').length);
  totalMin = computed(() => this.liste().reduce((s, i) => s + Number(i.duree_min || 0), 0));

  constructor() {
    this.api.groupes().subscribe((g) => this.groupes.set(g));
    this.charger();
  }

  charger() {
    this.loading.set(true);
    this.erreur.set('');
    this.api.journalTerrain(this.f).subscribe({
      next: (l) => { this.liste.set(l); this.loading.set(false); },
      error: (e) => { this.erreur.set(messageErreur(e)); this.loading.set(false); },
    });
  }

  compte(statut: InterventionTerrain['statut']) {
    return this.liste().filter((i) => i.statut === statut).length;
  }

  duree(min: number) {
    return dureeMinutes(min);
  }

  noms(it: InterventionTerrain) {
    return it.intervenants.map((i) => i.nom).join(', ');
  }
}
