import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Disponibilite } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { AffectationComponent } from '../components/affectation';
import { NotificationsService } from '../core/notifications.service';
import { MOTIF_ATTENTE_LABELS, STATUT_LABELS, aValider, infoDelai, infoDelaiTerrain } from '../core/labels';
import { Ticket, Zone } from '../core/models';

type Onglet = 'A_TRAITER' | 'VALIDATION' | 'CLOTURES' | 'TOUS';

const ONGLETS: { id: Onglet; label: string; filtre: (t: Ticket) => boolean }[] = [
  { id: 'A_TRAITER', label: 'À traiter', filtre: (t) => t.statut !== 'RESOLU' },
  { id: 'VALIDATION', label: 'En attente de validation client', filtre: (t) => aValider(t) },
  { id: 'CLOTURES', label: 'Clôturées', filtre: (t) => t.statut === 'RESOLU' && !aValider(t) },
  { id: 'TOUS', label: 'Toutes', filtre: () => true },
];

/**
 * Corbeille des interventions terrain : tous les tickets marqués « action terrain »
 * (mis en attente pour intervention terrain, ou signalés depuis les commentaires).
 */
@Component({
  selector: 'app-corbeille-terrain',
  imports: [FormsModule, RouterLink, DatePipe, AffectationComponent],
  template: `
    <header class="page-head">
      <div>
        <h1>🛠 Corbeille terrain</h1>
        <p class="muted">Tous les tickets qui nécessitent une intervention sur le terrain. Le groupe affecté a <strong>2 jours</strong> pour les résoudre ; leur résolution doit être validée par le client.</p>
      </div>
      <div class="actions-tete">
        <a class="btn" routerLink="/journal-terrain">🚐 Journal terrain</a>
        <button class="btn" (click)="charger()" [disabled]="loading()">↻ Actualiser</button>
      </div>
    </header>

    <!-- Technicien : tous les points terrain (par défaut), puis les points assignés à son équipe -->
    @if (monEquipe(); as equipe) {
      <div class="portee" role="tablist" aria-label="Points affichés">
        <button type="button" role="tab" [class.actif]="!monGroupe()" [attr.aria-selected]="!monGroupe()" (click)="choisirPortee(false)">
          🛠 Tous les points terrain
          <span class="nb">{{ aTraiterTous() }} à traiter</span>
        </button>
        <button type="button" role="tab" [class.actif]="monGroupe()" [attr.aria-selected]="monGroupe()" (click)="choisirPortee(true)">
          👥 Points terrain assignés à mon équipe — {{ equipe }}
          <span class="nb">{{ aTraiterEquipe() }} à traiter</span>
        </button>
      </div>
    }

    <section class="compteurs">
      <div class="card stat"><span class="muted">À traiter</span><strong>{{ compte('A_TRAITER') }}</strong></div>
      <div class="card stat"><span class="muted">Hors délai terrain (2 j)</span><strong class="rouge">{{ horsDelai() }}</strong></div>
      <div class="card stat"><span class="muted">En attente de validation client</span><strong>{{ compte('VALIDATION') }}</strong></div>
      <div class="card stat"><span class="muted">Clôturées</span><strong>{{ compte('CLOTURES') }}</strong></div>
    </section>

    <div class="barre">
      <div class="onglets" role="tablist">
        @for (o of onglets; track o.id) {
          <button type="button" role="tab" [class.actif]="onglet() === o.id" [attr.aria-selected]="onglet() === o.id"
                  (click)="onglet.set(o.id)">
            {{ o.label }} <span class="nb">{{ compte(o.id) }}</span>
          </button>
        }
      </div>
      <select [ngModel]="zone()" (ngModelChange)="zone.set($event)" aria-label="Zone">
        <option [ngValue]="null">Toutes zones</option>
        @for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.nom }}</option> }
      </select>
      <input class="recherche" [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Rechercher (réf., titre, lieu…)" />
    </div>

    @if (nouveaux().length) {
      <div class="alert nouveau">
        🔔 <strong>{{ nouveaux().length }} nouveau{{ nouveaux().length > 1 ? 'x' : '' }} point{{ nouveaux().length > 1 ? 's' : '' }}</strong>
        nécessitant une action terrain {{ nouveaux().length > 1 ? 'ont été affectés' : 'a été affecté' }} à votre groupe.
        <button class="btn-link" (click)="notifs.toutMarquerLu()">Marquer comme vu</button>
      </div>
    }
    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }
    @if (succes()) { <div class="alert success">{{ succes() }}</div> }

    <!-- Responsable IT : disponibilité des groupes de techniciens par zone -->
    @if (auth.hasRole('RESPONSABLE_IT') && dispo(); as d) {
      <details class="card dispo" open>
        <summary><strong>Disponibilité des groupes de techniciens</strong> <span class="muted">— tickets en cours par groupe et par zone</span></summary>
        <div class="zones">
          @for (z of zonesDispo(); track z.zone) {
            <div>
              <h3>Zone {{ z.zone }}</h3>
              @for (g of z.groupes; track g.id) {
                <div class="groupe">
                  <span>{{ g.nom }}</span>
                  <span class="badge" [class.d-ok]="charge(g) < 2" [class.d-proche]="charge(g) >= 2 && charge(g) < 4" [class.d-hors]="charge(g) >= 4">
                    {{ g.nb_it ? (charge(g) < 2 ? 'Disponible' : charge(g) < 4 ? 'Chargé' : 'Surchargé') : 'Aucun IT' }}
                  </span>
                  <small class="muted">{{ g.nb_it }} IT · {{ g.tickets_ouverts }} en cours · {{ g.terrain_ouverts }} terrain</small>
                  @if (g.terrain_hors_delai) { <span class="badge d-hors">{{ g.terrain_hors_delai }} hors délai</span> }
                </div>
              }
            </div>
          }
        </div>
      </details>
    }

    <div class="card no-pad">
      <table class="table">
        <thead>
          <tr>
            <th>Réf.</th><th>Titre</th><th>Localisation</th><th>Zone</th><th>Groupe / technicien</th>
            <th>Créé le</th><th>Statut</th><th>Délai terrain (2 j)</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (t of visibles(); track t.id) {
            <tr class="clickable" [routerLink]="['/glpi', t.id]" [class.ligne-nouvelle]="notifs.ticketsTerrainNonLus().has(t.id)"
                [class.ligne-equipe]="!monGroupe() && estMonEquipe(t)">
              <td class="ref">
                {{ t.reference }}
                @if (notifs.ticketsTerrainNonLus().has(t.id)) { <br /><span class="badge b-nouveau">Nouveau</span> }
              </td>
              <td><a class="titre" [routerLink]="['/glpi', t.id]">{{ t.titre }}</a></td>
              <td class="loc">{{ t.localisation ?? '—' }}</td>
              <td>{{ t.zone_nom }}</td>
              <td>
                @if (t.groupe_nom) {
                  {{ t.groupe_nom }}
                  @if (estMonEquipe(t)) { <span class="badge b-equipe">Mon équipe</span> }
                  <br /><small class="muted">{{ t.technicien_nom ?? 'Technicien non désigné' }}</small>
                }
                @else { <span class="badge d-proche">Non affecté</span> }
              </td>
              <td>{{ t.cree_le | date: 'dd/MM/yyyy HH:mm' }}</td>
              <td>
                <span class="badge s-{{ t.statut }}">{{ statutLabels[t.statut] }}</span>
                @if (t.statut === 'EN_ATTENTE' && t.motif_attente) { <br /><small class="muted">{{ motifLabels[t.motif_attente] }}</small> }
                @if (t.terrain_en_cours_depuis) { <br /><span class="badge b-sur-terrain mt">🚐 Sur le terrain depuis {{ t.terrain_en_cours_depuis | date: 'dd/MM HH:mm' }}</span> }
                @else if (t.nb_interventions_a_valider) { <br /><span class="badge b-valider mt">📝 Rapport d'intervention à valider</span> }
                @else if (t.nb_interventions) { <br /><small class="muted">{{ t.nb_interventions }} intervention(s) terrain</small> }
                @if (aValider(t)) { <br /><span class="badge b-valider mt">Validation client</span> }
                @else if (t.statut === 'RESOLU' && t.validation_client === 'VALIDE') { <br /><span class="badge b-valide mt">Validé par le client</span> }
              </td>
              <td>
                @let dt = delaiTerrain(t);
                @if (dt) {
                  <span class="badge {{ dt.classe }}" [title]="dt.titre">{{ dt.texte }}</span>
                  @if (t.statut !== 'RESOLU' && t.terrain_echeance) { <br /><small class="muted">échéance : {{ t.terrain_echeance | date: 'dd/MM HH:mm' }}</small> }
                } @else {
                  <small class="muted">Démarre à l'affectation</small>
                }
              </td>
              <td class="actions-ligne" (click)="$event.stopPropagation()">
                @if (auth.hasRole('RESPONSABLE_IT') && t.statut !== 'RESOLU') {
                  <button class="btn primary voir" (click)="basculer(t.id)">{{ ouvert() === t.id ? 'Fermer' : (t.groupe_id ? 'Réaffecter' : 'Affecter') }}</button>
                }
                <a class="btn voir" [routerLink]="['/glpi', t.id]">Voir le détail</a>
              </td>
            </tr>
            @if (ouvert() === t.id) {
              <tr class="panneau">
                <td colspan="9">
                  <h3>Affecter {{ t.reference }} à un groupe de techniciens</h3>
                  <p class="muted">Zone du ticket : {{ t.zone_nom }} — les groupes de cette zone sont proposés en premier, du plus disponible au plus chargé.</p>
                  <app-affectation [ticket]="t" (affecte)="apresAffectation($event)" />
                </td>
              </tr>
            }
          } @empty {
            <tr><td colspan="9" class="muted center">
              {{ loading() ? 'Chargement…'
                 : monGroupe() ? 'Aucun point terrain assigné à votre équipe dans cette catégorie.'
                 : tickets().length ? 'Aucun ticket dans cette catégorie.' : 'Aucun ticket ne nécessite d’intervention terrain.' }}
            </td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .compteurs { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .stat { display: flex; flex-direction: column; gap: 6px; }
    .stat strong { font-size: 26px; }
    .rouge { color: var(--danger); }
    .barre { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
    .barre select { width: auto; }
    .onglets { display: flex; gap: 6px; flex-wrap: wrap; }
    .onglets button {
      border: 1px solid var(--border); background: var(--card); color: var(--text); border-radius: 999px;
      padding: 7px 14px; cursor: pointer; font: inherit; display: inline-flex; gap: 8px; align-items: center;
    }
    .onglets button:hover { border-color: var(--orange); }
    .onglets button.actif { background: var(--orange); border-color: var(--orange); color: #000; font-weight: 600; }
    .nb { background: rgba(0,0,0,.08); border-radius: 999px; padding: 0 7px; font-size: 12px; }
    .recherche { margin-left: auto; flex: 0 1 280px; min-width: 200px; }
    .no-pad { overflow-x: auto; }
    .titre { color: inherit; font-weight: 600; text-decoration: none; }
    .titre:hover { color: var(--orange-dark); text-decoration: underline; }
    .loc { font-size: 13px; color: var(--muted); max-width: 220px; }
    .mt { margin-top: 4px; }
    .voir { white-space: nowrap; padding: 5px 10px; font-size: 13px; }
    .alert.nouveau { background: #fff3e0; color: #8a4b00; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    tr.ligne-nouvelle td { background: #fffaf3; }
    tr.ligne-nouvelle td:first-child { box-shadow: inset 4px 0 0 var(--orange); }
    .b-nouveau { background: #e53935; color: #fff; margin-top: 4px; }
    .portee { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .portee button { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 16px;
                     border: 2px solid var(--border); border-radius: 10px; background: var(--card); color: var(--text);
                     font: inherit; font-weight: 600; cursor: pointer; text-align: left; }
    .portee button:hover { border-color: var(--orange); }
    .portee button.actif { border-color: var(--orange); background: #fff7f0; }
    .b-equipe { background: #fff3e0; color: #e65100; margin-left: 4px; }
    tr.ligne-equipe td { background: #fffaf3; }
    @media (max-width: 700px) { .portee { grid-template-columns: 1fr; } }
    .actions-tete { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions-ligne { display: flex; gap: 6px; flex-wrap: wrap; }
    tr.panneau td { background: #fff7f0; padding: 16px 18px; }
    tr.panneau h3 { margin: 0 0 4px; font-size: 15px; }
    tr.panneau app-affectation { display: block; max-width: 640px; margin-top: 10px; }
    .check { display: flex; flex-direction: row; gap: 6px; align-items: center; margin: 0; font-weight: normal; }
    .check input { width: auto; }
    .dispo { margin-bottom: 14px; }
    .dispo summary { cursor: pointer; }
    .zones { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-top: 12px; }
    .zones h3 { font-size: 14px; margin: 0 0 6px; }
    .groupe { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
    @media (max-width: 700px) { .recherche { margin-left: 0; flex: 1 1 100%; } }
  `,
})
export class CorbeilleTerrainPage {
  private api = inject(ApiService);
  auth = inject(AuthService);
  notifs = inject(NotificationsService);
  /** Tickets de la corbeille avec une notification non lue */
  nouveaux = computed(() => this.tickets().filter((t) => this.notifs.ticketsTerrainNonLus().has(t.id)));

  dispo = signal<Disponibilite | null>(null);
  succes = signal('');
  /** Ticket dont le panneau d'affectation est ouvert */
  ouvert = signal<number | null>(null);
  /** Nom de l'équipe (groupe) du technicien connecté — null pour le Responsable IT ou un IT sans groupe */
  monEquipe = computed(() => (this.auth.hasRole('IT') && this.auth.user()?.groupe_id ? this.auth.user()?.groupe_nom ?? 'Mon groupe' : null));
  /** Vrai : seuls les points assignés à l'équipe du technicien sont affichés (par défaut : tous les points ; choix mémorisé) */
  monGroupe = signal(this.porteeInitiale());

  private porteeInitiale() {
    if (!this.auth.hasRole('IT') || !this.auth.user()?.groupe_id) return false;
    try { return localStorage.getItem('corbeille-portee') === 'equipe'; } catch { return false; }
  }

  choisirPortee(equipe: boolean) {
    this.monGroupe.set(equipe);
    try { localStorage.setItem('corbeille-portee', equipe ? 'equipe' : 'tous'); } catch { /* stockage indisponible */ }
  }

  estMonEquipe(t: Ticket) {
    return !!this.monEquipe() && t.groupe_id === this.auth.user()?.groupe_id;
  }

  aTraiterEquipe = computed(() => this.tickets().filter((t) => t.statut !== 'RESOLU' && this.estMonEquipe(t)).length);
  aTraiterTous = computed(() => this.tickets().filter((t) => t.statut !== 'RESOLU').length);

  zonesDispo = computed(() => {
    const parZone = new Map<string, Disponibilite['groupes']>();
    for (const g of this.dispo()?.groupes ?? []) parZone.set(g.zone_nom, [...(parZone.get(g.zone_nom) ?? []), g]);
    return [...parZone.entries()].map(([zone, groupes]) => ({ zone, groupes }));
  });

  charge(g: Disponibilite['groupes'][number]) {
    return g.nb_it ? g.tickets_ouverts / g.nb_it : Infinity;
  }

  basculer(id: number) {
    this.succes.set('');
    this.ouvert.set(this.ouvert() === id ? null : id);
  }

  apresAffectation(message: string) {
    this.succes.set(message);
    this.ouvert.set(null);
    this.charger();
  }

  onglets = ONGLETS;
  statutLabels = STATUT_LABELS;
  motifLabels = MOTIF_ATTENTE_LABELS;
  delai = infoDelai;
  delaiTerrain = infoDelaiTerrain;
  aValider = aValider;

  tickets = signal<Ticket[]>([]);
  zones = signal<Zone[]>([]);
  onglet = signal<Onglet>('A_TRAITER');
  zone = signal<number | null>(null);
  q = signal('');
  loading = signal(true);
  erreur = signal('');

  /** Tickets de la zone choisie et correspondant à la recherche */
  private filtres = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.tickets().filter(
      (t) =>
        (this.zone() === null || t.zone_id === this.zone()) &&
        (!this.monGroupe() || t.groupe_id === this.auth.user()?.groupe_id) &&
        (!q || [t.reference, t.titre, t.description, t.localisation ?? ''].some((v) => v.toLowerCase().includes(q)))
    );
  });

  visibles = computed(() => this.filtres().filter(ONGLETS.find((o) => o.id === this.onglet())!.filtre));
  horsDelai = computed(() => this.filtres().filter((t) => t.statut !== 'RESOLU' && Number(t.terrain_hors_delai)).length);

  constructor() {
    this.api.zones().subscribe((z) => this.zones.set(z));
    this.charger();
    this.notifs.charger();
    // Nouvelle notification reçue : on recharge la liste pour afficher le ticket à jour (groupe, technicien…)
    let dejaVus: Set<number> | null = null; // null tant que les notifications n'ont pas été chargées
    effect(() => {
      if (!this.notifs.pret()) return;
      const ids = this.notifs.ticketsTerrainNonLus();
      if (dejaVus === null) { dejaVus = new Set(ids); return; } // état initial : déjà couvert par charger()
      const nouveaux = [...ids].filter((id) => !dejaVus!.has(id));
      nouveaux.forEach((id) => dejaVus!.add(id));
      if (nouveaux.length && !untracked(this.loading)) this.charger();
    });
  }

  charger() {
    this.loading.set(true);
    this.erreur.set('');
    if (this.auth.hasRole('RESPONSABLE_IT')) this.api.disponibilite().subscribe((d) => this.dispo.set(d));
    this.api.tickets({ terrain: 1 }).subscribe({
      next: (t) => {
        // Hors délai terrain d'abord, puis l'échéance la plus proche, puis les non affectés
        this.tickets.set([...t].sort((a, b) =>
          Number(b.terrain_hors_delai) - Number(a.terrain_hors_delai) ||
          (a.terrain_echeance ?? '9999').localeCompare(b.terrain_echeance ?? '9999') ||
          a.cree_le.localeCompare(b.cree_le)));
        this.loading.set(false);
      },
      error: (e) => { this.erreur.set(messageErreur(e)); this.loading.set(false); },
    });
  }

  compte(id: Onglet) {
    return this.filtres().filter(ONGLETS.find((o) => o.id === id)!.filtre).length;
  }
}
