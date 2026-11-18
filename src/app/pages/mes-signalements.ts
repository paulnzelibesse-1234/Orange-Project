import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { MOTIF_ATTENTE_LABELS, STATUT_LABELS, TYPE_ICONES, TYPE_LABELS, aValider, infoDelai } from '../core/labels';
import { Statut, Ticket } from '../core/models';

type Onglet = 'TOUS' | 'COURS' | 'ATTENTE' | 'RESOLUS';

const ONGLETS: { id: Onglet; label: string; statuts: Statut[] }[] = [
  { id: 'TOUS', label: 'Tous', statuts: [] },
  { id: 'COURS', label: 'En cours', statuts: ['EN_COURS_ATTRIBUE', 'EN_COURS_PLANIFIE'] },
  { id: 'ATTENTE', label: 'En attente', statuts: ['EN_ATTENTE'] },
  { id: 'RESOLUS', label: 'Résolus', statuts: ['RESOLU'] },
];

@Component({
  selector: 'app-mes-signalements',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="page-head">
      <div>
        <h1>Mes signalements</h1>
        <p class="muted">Suivez l'avancement des problèmes que vous avez signalés. Cliquez sur un signalement pour voir le détail.</p>
      </div>
      <a class="btn primary" routerLink="/glpi/nouveau">+ Signaler un problème</a>
    </header>

    @if (nbAValider() > 0) {
      <div class="alert action">
        <strong>{{ nbAValider() }} intervention{{ nbAValider() > 1 ? 's' : '' }} terrain</strong>
        attend{{ nbAValider() > 1 ? 'ent' : '' }} votre validation. Ouvrez le signalement pour confirmer que le problème est résolu.
      </div>
    }

    <div class="onglets" role="tablist">
      @for (o of onglets; track o.id) {
        <button type="button" role="tab" [class.actif]="onglet() === o.id" [attr.aria-selected]="onglet() === o.id"
                (click)="onglet.set(o.id)">
          {{ o.label }} <span class="compte">{{ compte(o.id) }}</span>
        </button>
      }
      <input class="recherche" [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Rechercher (réf., titre, lieu…)" />
    </div>

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }

    <div class="liste">
      @for (t of visibles(); track t.id) {
        <a class="item card" [routerLink]="['/glpi', t.id]" [queryParams]="{ depuis: 'mes-signalements' }"
           [class.a-valider]="aValider(t)">
          <div class="item-head">
            <span class="ref">{{ t.reference }}</span>
            <span class="badges">
              <span class="badge t-{{ t.type }}">{{ typeIcones[t.type] }} {{ typeLabels[t.type] }}</span>
              <span class="badge s-{{ t.statut }}">{{ statutLabels[t.statut] }}</span>
              @let d = delai(t);
              <span class="badge {{ d.classe }}" [title]="d.titre">⏱ {{ d.texte }}</span>
              @if (t.statut === 'EN_ATTENTE' && t.motif_attente) { <span class="badge s-EN_ATTENTE">{{ motifLabels[t.motif_attente] }}</span> }
              @if (aValider(t)) { <span class="badge b-valider">À valider</span> }
            </span>
          </div>
          <h3>{{ t.titre }}</h3>
          <p class="desc muted">{{ t.description }}</p>

          <ol class="etapes" [attr.aria-label]="'Étape : ' + statutLabels[t.statut]">
            @for (e of etapes; track e; let i = $index) {
              <li [class.fait]="i <= etape(t.statut)">{{ i === 1 && t.statut === 'EN_ATTENTE' ? 'En attente' : e }}</li>
            }
          </ol>

          <div class="item-foot">
            @if (t.localisation) { <span>📍 {{ t.localisation }}</span> }
            <span>👤 {{ t.technicien_nom ?? 'Pas encore attribué' }}</span>
            @if (t.capture) { <span>📎 Capture jointe</span> }
            <span class="date">Signalé le {{ t.cree_le | date: 'dd/MM/yyyy à HH:mm' }}</span>
          </div>
        </a>
      } @empty {
        <div class="card vide">
          @if (loading()) {
            Chargement…
          } @else if (tickets().length === 0) {
            <p>Vous n'avez encore signalé aucun problème.</p>
            <a class="btn primary" routerLink="/glpi/nouveau">Signaler un problème</a>
          } @else {
            Aucun signalement dans cette catégorie.
          }
        </div>
      }
    </div>
  `,
  styles: `
    .onglets { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
    .onglets button {
      border: 1px solid var(--border); background: var(--card); color: var(--text); border-radius: 999px;
      padding: 7px 14px; cursor: pointer; font: inherit; display: inline-flex; gap: 8px; align-items: center;
    }
    .onglets button:hover { border-color: var(--orange); }
    .onglets button.actif { background: var(--orange); border-color: var(--orange); color: #000; font-weight: 600; }
    .compte { background: rgba(0,0,0,.08); border-radius: 999px; padding: 0 7px; font-size: 12px; }
    .recherche { margin-left: auto; min-width: 220px; flex: 0 1 300px; }
    .liste { display: grid; gap: 12px; }
    .item { display: block; color: inherit; text-decoration: none; transition: border-color .15s, box-shadow .15s; }
    .item:hover { border-color: var(--orange); box-shadow: 0 2px 10px rgba(0,0,0,.06); }
    .alert.action { background: #fff3e0; color: #8a4b00; }
    .item.a-valider { border-left: 4px solid var(--orange); }
    .badges { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .item-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .item h3 { margin: 6px 0 4px; font-size: 16px; }
    .desc { margin: 0 0 12px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .etapes { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0; margin: 0 0 12px; }
    .etapes li { font-size: 12px; color: var(--muted); padding-top: 6px; border-top: 4px solid var(--border); }
    .etapes li.fait { color: var(--text); border-top-color: var(--orange); }
    .item-foot { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--muted); }
    .item-foot .date { margin-left: auto; }
    .vide { text-align: center; color: var(--muted); padding: 30px; }
    @media (max-width: 700px) {
      .recherche { margin-left: 0; flex: 1 1 100%; }
      .item-foot .date { margin-left: 0; }
    }
  `,
})
export class MesSignalementsPage {
  private api = inject(ApiService);

  onglets = ONGLETS;
  statutLabels = STATUT_LABELS;
  typeLabels = TYPE_LABELS;
  typeIcones = TYPE_ICONES;
  delai = infoDelai;
  aValider = aValider;
  motifLabels = MOTIF_ATTENTE_LABELS;
  etapes = ['En cours (attribué)', 'En cours (planifié)', 'Résolu'];

  tickets = signal<Ticket[]>([]);
  onglet = signal<Onglet>('TOUS');
  q = signal('');
  loading = signal(true);
  erreur = signal('');

  nbAValider = computed(() => this.tickets().filter(aValider).length);

  visibles = computed(() => {
    const statuts = ONGLETS.find((o) => o.id === this.onglet())!.statuts;
    const q = this.q().trim().toLowerCase();
    return this.tickets().filter(
      (t) =>
        (!statuts.length || statuts.includes(t.statut)) &&
        (!q || [t.reference, t.titre, t.description, t.localisation ?? ''].some((v) => v.toLowerCase().includes(q)))
    );
  });

  constructor() {
    this.api.tickets({ crees: 1 }).subscribe({
      next: (t) => {
        // Les plus récents d'abord
        this.tickets.set([...t].sort((a, b) => b.cree_le.localeCompare(a.cree_le)));
        this.loading.set(false);
      },
      error: (e) => { this.erreur.set(messageErreur(e)); this.loading.set(false); },
    });
  }

  compte(id: Onglet) {
    const statuts = ONGLETS.find((o) => o.id === id)!.statuts;
    return statuts.length ? this.tickets().filter((t) => statuts.includes(t.statut)).length : this.tickets().length;
  }

  etape(s: Statut) {
    return { EN_COURS_ATTRIBUE: 0, EN_COURS_PLANIFIE: 1, EN_ATTENTE: 1, RESOLU: 2 }[s];
  }
}
