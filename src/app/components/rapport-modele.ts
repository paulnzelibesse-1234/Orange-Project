import { Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModeleRapport, PosteRapport, posteVide } from '../core/modeles-rapport';

/**
 * Éléments communs aux rapports d'intervention (résolution d'un ticket et intervention terrain) :
 * - <app-champs-modele> : champs propres à la nature (modèle d'imprimante, équipement en cause…) ;
 * - <app-postes-rapport> : postes configurés / impactés (nombre → N° de poste, N° de série, utilisateur) ;
 * - <app-rapport-details> : affichage d'un rapport enregistré (nature, champs, tableau des postes).
 */

@Component({
  selector: 'app-champs-modele',
  imports: [FormsModule],
  template: `
    @if (modele()?.champs?.length) {
      <fieldset class="specifique">
        <legend>{{ modele()?.libelle }}</legend>
        <div class="grid-2">
          @for (c of modele()?.champs ?? []; track c.cle) {
            <label>{{ c.libelle }}{{ c.obligatoire ? ' *' : '' }}
              @if (c.options) {
                <select [attr.name]="prefixe() + 'd-' + c.cle" [(ngModel)]="details()[c.cle]">
                  <option value="">—</option>
                  @for (o of c.options; track o) { <option [value]="o">{{ o }}</option> }
                </select>
              } @else {
                <input [attr.name]="prefixe() + 'd-' + c.cle" [(ngModel)]="details()[c.cle]" [placeholder]="c.placeholder ?? ''" />
              }
            </label>
          }
        </div>
      </fieldset>
    }
  `,
  styles: `
    .specifique { border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px 0; margin: 0 0 12px; background: var(--card); }
    .specifique legend { font-weight: 600; padding: 0 6px; }
  `,
})
export class ChampsModeleComponent {
  modele = input<ModeleRapport | null>(null);
  details = input.required<Record<string, string>>();
  /** Préfixe des attributs name (plusieurs formulaires sur la même page) */
  prefixe = input('');
}

@Component({
  selector: 'app-postes-rapport',
  imports: [FormsModule],
  template: `
    <label class="nb-postes">Nombre de {{ libelle().toLowerCase() }} *
      <input type="number" [attr.name]="prefixe() + 'nb-postes'" min="1" max="200"
             [ngModel]="postes().length" (ngModelChange)="definirNombre($event)" />
    </label>
    <div class="postes-wrap">
      <table class="table postes">
        <thead><tr><th>#</th><th>Tatouage</th><th>N° de série</th><th>Marque</th><th>Modèle</th><th>Utilisateur *</th><th></th></tr></thead>
        <tbody>
          @for (p of postes(); track $index; let i = $index) {
            <tr>
              <td>{{ i + 1 }}</td>
              <td><input [attr.name]="prefixe() + 'pt' + i" [(ngModel)]="p.tatouage" placeholder="Ex : OCI-012345" /></td>
              <td><input [attr.name]="prefixe() + 'ps' + i" [(ngModel)]="p.serie" placeholder="Ex : 5CG1234XYZ" /></td>
              <td><input class="court" [attr.name]="prefixe() + 'pm' + i" [(ngModel)]="p.marque" placeholder="Ex : HP" /></td>
              <td><input [attr.name]="prefixe() + 'pd' + i" [(ngModel)]="p.modele" placeholder="Ex : EliteBook 840 G8" /></td>
              <td><input [attr.name]="prefixe() + 'pu' + i" [(ngModel)]="p.utilisateur" placeholder="Prénom Nom" /></td>
              <td><button type="button" class="btn small" [disabled]="postes().length === 1" (click)="retirer(i)" aria-label="Retirer ce poste">✕</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <button type="button" class="btn small" (click)="definirNombre(postes().length + 1)">+ Ajouter un poste</button>
    <small class="muted aide">Pour chaque poste : tatouage ou N° de série, et l’utilisateur. Marque et modèle sont recommandés.</small>
  `,
  styles: `
    .nb-postes input { max-width: 120px; }
    .postes-wrap { overflow-x: auto; margin-bottom: 8px; }
    .postes input { padding: 5px 7px; min-width: 110px; }
    .postes input.court { min-width: 80px; }
    .postes td, .postes th { padding: 4px 6px; }
    .aide { display: block; margin: 6px 0 14px; }
  `,
})
export class PostesRapportComponent {
  postes = input.required<PosteRapport[]>();
  libelle = input('Postes concernés');
  prefixe = input('');

  definirNombre(n: number) {
    const nb = Math.max(1, Math.min(200, Math.floor(Number(n) || 1)));
    const p = this.postes();
    while (p.length < nb) p.push(posteVide());
    p.length = nb;
  }
  retirer(i: number) {
    if (this.postes().length > 1) this.postes().splice(i, 1);
  }
}

@Component({
  selector: 'app-rapport-details',
  template: `
    @if (modele()) { <p class="modele">{{ modele() }}</p> }
    @if (details()?.length) {
      <dl class="det">@for (d of details(); track d.cle) { <dt>{{ d.libelle }}</dt><dd>{{ d.valeur }}</dd> }</dl>
    }
    @if (postes()?.length) {
      <p class="titre-postes"><strong>{{ libellePostes() }} : {{ postes()!.length }}</strong></p>
      <div class="postes-wrap">
        <table class="table postes">
          <thead><tr><th>#</th><th>Tatouage</th><th>N° de série</th><th>Marque</th><th>Modèle</th><th>Utilisateur</th></tr></thead>
          <tbody>
            @for (p of postes(); track $index) {
              <tr>
                <td>{{ $index + 1 }}</td><td>{{ p.tatouage || p.numero || '—' }}</td><td>{{ p.serie || '—' }}</td>
                <td>{{ p.marque || '—' }}</td><td>{{ p.modele || '—' }}</td><td>{{ p.utilisateur }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .modele { font-weight: 600; color: var(--orange-dark); margin: 4px 0; }
    .det { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 6px 0; font-size: 14px; }
    .det dt { color: var(--muted); }
    .det dd { margin: 0; }
    .titre-postes { margin: 8px 0 2px; }
    .postes-wrap { overflow-x: auto; }
    .postes { font-size: 13px; }
    .postes td, .postes th { padding: 4px 6px; }
  `,
})
export class RapportDetailsComponent {
  modele = input<string | null | undefined>(null);
  details = input<{ cle: string; libelle: string; valeur: string }[] | undefined>([]);
  postes = input<Partial<PosteRapport>[] | undefined>([]);
  libellePostes = input('Postes concernés');
}
