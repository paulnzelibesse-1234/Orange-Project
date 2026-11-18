import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, Disponibilite } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { Ticket } from '../core/models';

/**
 * Affectation d'un ticket à un groupe de techniciens IT (et, au choix, à un technicien du groupe),
 * avec la disponibilité de chaque groupe / technicien. Réservé au Responsable IT.
 */
@Component({
  selector: 'app-affectation',
  imports: [FormsModule],
  template: `
    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }

    @if (dispo(); as d) {
      <label>Groupe de techniciens *
        <select [ngModel]="groupeId()" (ngModelChange)="choisirGroupe($event)">
          <option [ngValue]="null" disabled>Choisir le groupe…</option>
          @for (z of zonesTriees(); track z.zone) {
            <optgroup [label]="'Zone ' + z.zone + (z.zone === ticket().zone_nom ? ' (zone du ticket)' : '')">
              @for (g of z.groupes; track g.id) {
                <option [ngValue]="g.id">
                  {{ g.nom }} — {{ g.nb_it }} IT · {{ g.tickets_ouverts }} ticket{{ g.tickets_ouverts > 1 ? 's' : '' }} en cours{{ g.id === recommande()?.id ? ' ★ recommandé' : '' }}
                </option>
              }
            </optgroup>
          }
        </select>
      </label>

      @if (groupe(); as g) {
        <div class="dispo">
          <span class="badge" [class.d-ok]="charge(g) < 2" [class.d-proche]="charge(g) >= 2 && charge(g) < 4" [class.d-hors]="charge(g) >= 4">
            {{ disponibilite(g) }}
          </span>
          <span class="muted">{{ g.tickets_ouverts }} ticket(s) en cours dont {{ g.terrain_ouverts }} terrain · {{ g.nb_it }} technicien(s)</span>
          @if (g.zone_nom !== ticket().zone_nom) { <span class="badge d-proche">Autre zone que le ticket ({{ ticket().zone_nom }})</span> }
        </div>

        <label>Technicien (facultatif)
          <select [ngModel]="technicienId()" (ngModelChange)="technicienId.set($event)">
            <option [ngValue]="null">Laisser le groupe désigner le technicien</option>
            @for (it of techniciensDuGroupe(); track it.id) {
              <option [ngValue]="it.id">
                {{ it.prenom }} {{ it.nom }} — {{ it.tickets_ouverts === 0 ? 'disponible' : it.en_cours + ' en cours, ' + it.en_attente + ' en attente' }}
              </option>
            } @empty {
              <option disabled>Aucun technicien actif dans ce groupe</option>
            }
          </select>
        </label>
      }

      <label>Date d'intervention prévue (facultatif)
        <input type="datetime-local" [ngModel]="date()" (ngModelChange)="date.set($event)" />
      </label>

      @if (+ticket().action_terrain && groupeId() !== ticket().groupe_id) {
        <p class="muted">🛠 Ticket terrain : le groupe disposera de <strong>2 jours</strong> à partir de cette affectation pour le résoudre ; ses techniciens seront notifiés.</p>
      }
      <button class="btn primary" [disabled]="!groupeId() || busy()" (click)="sauvegarder()">
        {{ busy() ? 'Sauvegarde…' : '💾 Sauvegarder l’affectation' }}
      </button>
    } @else {
      <p class="muted">Chargement des disponibilités…</p>
    }
  `,
  styles: `
    .dispo { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: -4px 0 12px; font-size: 13px; }
  `,
})
export class AffectationComponent {
  private api = inject(ApiService);

  ticket = input.required<Ticket>();
  /** Émis après une affectation réussie, avec le message de confirmation */
  affecte = output<string>();

  dispo = signal<Disponibilite | null>(null);
  groupeId = signal<number | null>(null);
  technicienId = signal<number | null>(null);
  date = signal('');
  busy = signal(false);
  erreur = signal('');

  groupe = computed(() => this.dispo()?.groupes.find((g) => g.id === this.groupeId()) ?? null);
  techniciensDuGroupe = computed(() => (this.dispo()?.techniciens ?? []).filter((t) => t.groupe_id === this.groupeId()));

  /** Zones avec la zone du ticket en premier ; groupes du moins chargé au plus chargé */
  zonesTriees = computed(() => {
    const parZone = new Map<string, Disponibilite['groupes']>();
    for (const g of this.dispo()?.groupes ?? []) parZone.set(g.zone_nom, [...(parZone.get(g.zone_nom) ?? []), g]);
    return [...parZone.entries()]
      .map(([zone, groupes]) => ({ zone, groupes: [...groupes].sort((a, b) => this.charge(a) - this.charge(b)) }))
      .sort((a, b) => Number(b.zone === this.ticket().zone_nom) - Number(a.zone === this.ticket().zone_nom));
  });

  /** Groupe recommandé : dans la zone du ticket, avec des IT actifs, le moins chargé */
  recommande = computed<Disponibilite['groupes'][number] | null>(() =>
    (this.dispo()?.groupes ?? [])
      .filter((g) => g.zone_id === this.ticket().zone_id && g.nb_it > 0)
      .sort((a, b) => this.charge(a) - this.charge(b))[0] ?? null
  );

  constructor() {
    this.api.disponibilite().subscribe({
      next: (d) => {
        this.dispo.set(d);
        const t = this.ticket();
        this.groupeId.set(t.groupe_id ?? this.recommande()?.id ?? null);
        this.technicienId.set(t.technicien_id ?? null);
        this.date.set(t.date_planifiee ? t.date_planifiee.slice(0, 16).replace(' ', 'T') : '');
      },
      error: (e) => this.erreur.set(messageErreur(e)),
    });
  }

  /** Tickets en cours par technicien du groupe */
  charge(g: Disponibilite['groupes'][number]) {
    return g.nb_it ? g.tickets_ouverts / g.nb_it : Infinity;
  }

  disponibilite(g: Disponibilite['groupes'][number]) {
    if (!g.nb_it) return 'Aucun technicien actif';
    const c = this.charge(g);
    return c < 2 ? 'Disponible' : c < 4 ? 'Chargé' : 'Surchargé';
  }

  choisirGroupe(id: number) {
    this.groupeId.set(id);
    // Le technicien choisi doit appartenir au groupe
    if (!this.techniciensDuGroupe().some((t) => t.id === this.technicienId())) this.technicienId.set(null);
  }

  sauvegarder() {
    this.busy.set(true);
    this.erreur.set('');
    const date = this.date() ? this.date().replace('T', ' ') + ':00' : null;
    this.api.attribuer(this.ticket().id, { groupe_id: this.groupeId(), technicien_id: this.technicienId(), date_planifiee: date }).subscribe({
      next: () => {
        this.busy.set(false);
        const g = this.groupe()!;
        const tech = this.techniciensDuGroupe().find((t) => t.id === this.technicienId());
        this.affecte.emit(`✔ Affectation sauvegardée : ${g.nom}${tech ? ` — ${tech.prenom} ${tech.nom}` : ''}`);
      },
      error: (e) => { this.erreur.set(messageErreur(e)); this.busy.set(false); },
    });
  }
}
