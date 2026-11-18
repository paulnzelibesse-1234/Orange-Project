import { Component, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Performances } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';

@Component({
  selector: 'app-performances',
  imports: [FormsModule, DecimalPipe],
  template: `
    <header class="page-head">
      <div>
        <h1>Performances des IT</h1>
        <p class="muted">Suivi de l'activité des techniciens et du respect du délai de traitement de 8 h</p>
      </div>
      <form class="period" (ngSubmit)="charger()">
        <label>Du <input type="date" name="du" [(ngModel)]="du" /></label>
        <label>Au <input type="date" name="au" [(ngModel)]="au" /></label>
        <button class="btn">Appliquer</button>
      </form>
    </header>

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }

    @if (data(); as d) {
      <section class="stats">
        <div class="card stat"><span class="muted">Tickets</span><strong>{{ d.global.total }}</strong></div>
        <div class="card stat"><span class="muted">Non attribués</span><strong>{{ d.global.non_attribues ?? 0 }}</strong></div>
        <div class="card stat"><span class="muted">Résolus</span><strong>{{ d.global.resolus ?? 0 }}</strong></div>
        <div class="card stat"><span class="muted">Hors délai (8 h)</span><strong class="rouge">{{ d.global.hors_delai ?? 0 }}</strong></div>
        <div class="card stat"><span class="muted">Temps de traitement moyen</span>
          <strong>{{ d.global.delai_moyen_h !== null ? (d.global.delai_moyen_h | number: '1.0-1') + ' h' : '—' }}</strong>
        </div>
      </section>

      <section class="card no-pad">
        <table class="table">
          <thead>
            <tr>
              <th>Technicien</th><th>Groupe</th><th>Zone</th><th>Attribués</th><th>En cours</th>
              <th>Résolus</th><th>Dans les délais</th><th>Respect du délai</th><th>Hors délai</th><th>Temps moyen</th>
            </tr>
          </thead>
          <tbody>
            @for (t of d.techniciens; track t.id) {
              <tr>
                <td>{{ t.technicien }}</td>
                <td>{{ t.groupe ?? '—' }}</td>
                <td>{{ t.zone ?? '—' }}</td>
                <td>{{ t.attribues }}</td>
                <td>{{ t.en_cours ?? 0 }}</td>
                <td>{{ t.resolus ?? 0 }}</td>
                <td>{{ t.dans_delai ?? 0 }}</td>
                <td>
                  @if (+(t.resolus ?? 0) > 0) {
                    <div class="bar"><span [style.width.%]="taux(t.dans_delai, t.resolus)"></span></div>
                    {{ taux(t.dans_delai, t.resolus) | number: '1.0-0' }} %
                  } @else { — }
                </td>
                <td [class.rouge]="+(t.hors_delai ?? 0) > 0">{{ t.hors_delai ?? 0 }}</td>
                <td>{{ t.delai_moyen_h !== null ? (t.delai_moyen_h | number: '1.0-1') + ' h' : '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="10" class="muted center">Aucun technicien</td></tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
  styles: `
    .period { display: flex; gap: 10px; align-items: end; }
    .period label { margin: 0; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .stat { display: flex; flex-direction: column; gap: 6px; }
    .stat strong { font-size: 26px; }
    .rouge { color: var(--danger); font-weight: 600; }
    .bar { width: 80px; height: 6px; background: var(--border); border-radius: 3px; display: inline-block; vertical-align: middle; margin-right: 6px; }
    .bar span { display: block; height: 100%; background: var(--orange); border-radius: 3px; }
  `,
})
export class PerformancesPage {
  private api = inject(ApiService);
  data = signal<Performances | null>(null);
  erreur = signal('');
  du = '';
  au = '';

  constructor() {
    this.charger();
  }

  charger() {
    this.api.performances(this.du || undefined, this.au || undefined).subscribe({
      next: (d) => this.data.set(d),
      error: (e) => this.erreur.set(messageErreur(e)),
    });
  }

  taux(part: number | null, total: number | null) {
    return Number(total) ? (Number(part ?? 0) / Number(total)) * 100 : 0;
  }
}
