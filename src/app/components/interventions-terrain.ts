import { Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Disponibilite } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { messageErreur } from '../core/auth.interceptor';
import { dureeMinutes } from '../core/labels';
import { InterventionTerrain, TicketDetail } from '../core/models';
import {
  PosteRapport, champsIncomplets, detailsPourApi, detecterModele, modeleParCode, modelesDuType,
  posteVide, postesIncomplets, postesPourApi,
} from '../core/modeles-rapport';
import { ChampsModeleComponent, PostesRapportComponent } from './rapport-modele';

/** Maintenant au format attendu par <input type="datetime-local"> */
function maintenant() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
const versDate = (s: string) => new Date(s.replace(' ', 'T'));

/**
 * Interventions terrain d'un ticket :
 *  1. Démarrer → le chronomètre tourne
 *  2. Fin de l'intervention → le chronomètre s'arrête, l'intervention est « à valider »
 *  3. Rapport d'intervention rempli par le technicien et le responsable du site, validé par le code du responsable du site
 */
@Component({
  selector: 'app-interventions-terrain',
  imports: [FormsModule, DatePipe, ChampsModeleComponent, PostesRapportComponent],
  template: `
    @if (erreur() && !aValider()) { <div class="alert error">{{ erreur() }}</div> }

    <!-- 1-2. Intervention en cours : chronomètre -->
    @if (enCours(); as it) {
      <div class="chrono">
        <div>
          <span class="muted">🚐 Intervention en cours — démarrée le {{ it.debut_le | date: 'dd/MM/yyyy à HH:mm' }}</span>
          <div class="temps" aria-live="off">{{ chrono() }}</div>
          <small class="muted">{{ noms(it) }}{{ it.note_depart ? ' — ' + it.note_depart : '' }}</small>
        </div>
        @if (peutAgir()) {
          <div class="fin">
            <label>Heure de fin
              <input type="datetime-local" [(ngModel)]="finLe" [max]="max()" />
            </label>
            <button class="btn danger" [disabled]="busy()" (click)="terminer()">⏹ Fin de l'intervention</button>
          </div>
        }
      </div>
    } @else if (peutDemarrer() && !aValider() && !ticket().technicien_id) {
      <div class="alert warning non-attribue" role="status">
        🔒 <strong>Intervention non attribuée</strong> : ce ticket n'est attribué à aucun technicien,
        l'intervention terrain ne peut pas encore être démarrée.<br />
        <small>{{ auth.hasRole('RESPONSABLE_IT')
          ? 'Attribuez-le à un technicien dans « Affecter le ticket ».'
          : 'Le Responsable IT doit l’attribuer à un technicien, ou passez-le vous-même en « En cours (planifié) » pour le prendre en charge.' }}</small>
      </div>
    } @else if (peutDemarrer() && !aValider()) {
      <h3>Démarrer une intervention terrain</h3>
      <fieldset class="intervenants">
        <legend>Techniciens qui partent sur le terrain *</legend>
        @for (it of techniciensDuGroupe(); track it.id) {
          <label class="check">
            <input type="checkbox" [checked]="choisis().has(it.id)" (change)="basculer(it.id)" />
            {{ it.prenom }} {{ it.nom }}{{ it.id === auth.user()?.id ? ' (moi)' : '' }}
          </label>
        } @empty {
          <p class="muted">Aucun technicien actif dans le groupe de ce ticket.</p>
        }
      </fieldset>
      <div class="grid-2">
        <label>Heure de début
          <input type="datetime-local" [(ngModel)]="debutLe" [max]="max()" />
        </label>
        <label>Objectif / remarque (facultatif)
          <input [(ngModel)]="note" placeholder="Ex : remplacement de la prise réseau" />
        </label>
      </div>
      <button class="btn primary" [disabled]="!choisis().size || busy()" (click)="demarrer()">
        {{ busy() ? 'Sauvegarde…' : '▶ Démarrer l’intervention terrain' }}
      </button>
    }

    <!-- 3. Rapport d'intervention à valider -->
    @if (aValider(); as it) {
      @if (peutAgir()) {
        <form class="rapport" (ngSubmit)="valider(it)">
          <h3>📝 Rapport d'intervention — à valider</h3>
          <p class="muted">
            Intervention du {{ it.debut_le | date: 'dd/MM/yyyy HH:mm' }} au {{ it.fin_le | date: 'dd/MM/yyyy HH:mm' }}
            (durée : {{ duree(it.duree_min) }}) — {{ noms(it) }}.
            L'intervention n'est validée qu'avec le code du responsable du site.
          </p>

          <fieldset>
            <legend>Volet technicien</legend>
            <div class="resultats">
              <label class="choix" [class.choisi]="r.resultat === 'TERMINEE'">
                <input type="radio" name="resultat" value="TERMINEE" [(ngModel)]="r.resultat" />
                <span><strong>Intervention terminée</strong><br /><small class="muted">Les travaux prévus ont été réalisés.</small></span>
              </label>
              <label class="choix" [class.choisi]="r.resultat === 'INTERROMPUE'">
                <input type="radio" name="resultat" value="INTERROMPUE" [(ngModel)]="r.resultat" />
                <span><strong>Intervention interrompue</strong><br /><small class="muted">Elle n'a pas pu être menée à terme.</small></span>
              </label>
            </div>
            <label>Nature de l'intervention *
              <select name="t-modele" [ngModel]="modeleCode()" (ngModelChange)="modeleCode.set($event)">
                @for (m of modeles(); track m.code) { <option [value]="m.code">{{ m.libelle }}</option> }
              </select>
            </label>
            @let mod = modele();
            <!-- Un seul onglet « Rapport » : informations de l'intervention + postes travaillés -->
            <div class="onglets"><span class="onglet actif">📋 Rapport</span></div>
            <h4 class="partie">Intervention{{ voletIncomplet() ? ' •' : '' }}</h4>
            <app-champs-modele prefixe="t-" [modele]="mod" [details]="details" />
            @if (r.resultat === 'INTERROMPUE') {
              <label>Motif de l'interruption *
                <textarea name="motif" rows="2" [(ngModel)]="r.motif_interruption" placeholder="Ex : pièce de remplacement non disponible"></textarea>
              </label>
            }
            <label>Diagnostic / constat sur site *
              <textarea name="diag" rows="2" [(ngModel)]="r.diagnostic"></textarea>
            </label>
            <label>Travaux réalisés *
              <textarea name="cr" rows="3" [(ngModel)]="r.compte_rendu"></textarea>
            </label>
            <div class="grid-2">
              <label>Matériel utilisé / remplacé <input name="mat" [(ngModel)]="r.materiel" /></label>
              <label>Observations / recommandations <input name="obs" [(ngModel)]="r.observations" /></label>
            </div>
            <h4 class="partie">🖥 {{ mod?.postes }} ({{ postes.length }}){{ postesIncomplets() ? ' •' : '' }}</h4>
            <app-postes-rapport prefixe="t-" [postes]="postes" [libelle]="mod?.postes ?? 'Postes concernés'" />
          </fieldset>

          <fieldset>
            <legend>Volet responsable du site — {{ ticket().localisation?.split(' › ')?.[0] }}</legend>
            <div class="grid-2">
              <label>Nom du responsable du site *
                <input name="rnom" [(ngModel)]="r.responsable_site_nom" />
              </label>
              <label>Fonction
                <input name="rfct" [(ngModel)]="r.responsable_site_fonction" placeholder="Ex : chef d'agence" />
              </label>
            </div>
            <div class="resultats deux">
              <label class="choix" [class.choisi]="r.appreciation === 'SATISFAIT'">
                <input type="radio" name="appr" value="SATISFAIT" [(ngModel)]="r.appreciation" />
                <span><strong>Satisfait</strong></span>
              </label>
              <label class="choix" [class.choisi]="r.appreciation === 'RESERVES'">
                <input type="radio" name="appr" value="RESERVES" [(ngModel)]="r.appreciation" />
                <span><strong>Avec réserves</strong></span>
              </label>
            </div>
            <label>Commentaire du responsable du site{{ r.appreciation === 'RESERVES' ? ' *' : '' }}
              <textarea name="csite" rows="2" [(ngModel)]="r.commentaire_site"></textarea>
            </label>
            <label class="code">Code de validation du responsable du site *
              <input name="code" type="password" inputmode="numeric" autocomplete="off" maxlength="8"
                     [(ngModel)]="r.code" placeholder="••••" />
              <small class="muted">Le responsable du site saisit lui-même son code personnel pour valider ce rapport.</small>
            </label>
          </fieldset>

          @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }
          <button class="btn primary" [disabled]="!rapportComplet() || busy()">
            {{ busy() ? 'Validation…' : '✔ Valider le rapport d’intervention' }}
          </button>
        </form>
      } @else {
        <p class="alert terrain">📝 Rapport d'intervention en attente de validation par le responsable du site.</p>
      }
    }

    <!-- Historique -->
    <h3>Historique des interventions ({{ ticket().interventions.length }})</h3>
    @for (it of ticket().interventions; track it.id) {
      <article class="intervention" [class]="'i-' + it.statut">
        <div class="tete">
          <span class="badge" [class]="'b-' + it.statut">{{ libelles[it.statut] }}</span>
          @if (it.resultat) { <span class="badge" [class]="'r-' + it.resultat">{{ it.resultat === 'TERMINEE' ? 'Terminée' : 'Interrompue' }}</span> }
          <strong>{{ it.groupe_nom ?? 'Sans groupe' }}</strong>
          <span class="muted">{{ noms(it) }}</span>
        </div>
        <dl>
          <dt>Début</dt><dd>{{ it.debut_le | date: 'dd/MM/yyyy à HH:mm' }} <small class="muted">par {{ it.demarree_par_nom }}</small></dd>
          <dt>Fin</dt>
          <dd>
            @if (it.fin_le) { {{ it.fin_le | date: 'dd/MM/yyyy à HH:mm' }} <small class="muted">par {{ it.terminee_par_nom }}</small> }
            @else { <span class="muted">en cours</span> }
          </dd>
          <dt>Durée</dt><dd>{{ it.statut === 'EN_COURS' ? chrono() + ' (en cours)' : duree(it.duree_min) }}</dd>
          @if (it.note_depart) { <dt>Objectif</dt><dd>{{ it.note_depart }}</dd> }
          @if (it.statut === 'VALIDEE') {
            @if (it.modele) { <dt>Nature</dt><dd>{{ it.modele }}{{ it.postes?.length ? ' — ' + it.postes!.length + ' poste' + (it.postes!.length > 1 ? 's' : '') : '' }}</dd> }
            <dt>Validé par</dt>
            <dd>
              {{ it.responsable_site_nom }} — le {{ it.valide_le | date: 'dd/MM/yyyy à HH:mm' }}
              <br /><button type="button" class="lien" (click)="voirRapport(it.id)">📄 Voir le rapport d’intervention</button>
            </dd>
          }
        </dl>
      </article>
    } @empty {
      <p class="muted">Aucune intervention terrain pour le moment.</p>
    }
  `,
  styles: `
    h3 { font-size: 15px; margin: 16px 0 8px; }
    .non-attribue { background: #fff3e0; color: #8a4b00; border: 1px solid #ffcc80; margin-top: 12px; }
    .chrono { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
              background: #e3f2fd; border-radius: 10px; padding: 14px 16px; margin-bottom: 8px; }
    .temps { font: 700 40px/1.1 Consolas, 'Courier New', monospace; color: #0d47a1; margin: 4px 0; letter-spacing: 1px; }
    .fin { display: flex; gap: 10px; align-items: end; flex-wrap: wrap; }
    .fin label { margin: 0; }
    .rapport { border: 1px solid var(--orange); border-radius: 10px; padding: 4px 16px 16px; margin: 12px 0; background: #fffaf5; }
    .rapport fieldset { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px 2px; margin: 0 0 12px; background: var(--card); }
    .rapport legend { font-weight: 600; padding: 0 6px; }
    .resultats, .intervenants { display: grid; gap: 8px; margin: 0 0 12px; border: none; padding: 0; }
    .resultats.deux { grid-template-columns: 1fr 1fr; }
    .intervenants legend { font-weight: 500; margin-bottom: 6px; padding: 0; }
    .choix { display: flex; flex-direction: row; gap: 10px; align-items: flex-start; margin: 0; padding: 10px 12px;
             border: 1px solid var(--border); border-radius: 8px; cursor: pointer; font-weight: normal; }
    .choix.choisi { border-color: var(--orange); background: #fff7f0; }
    .choix input, .check input { width: auto; margin-top: 3px; }
    .check { display: flex; flex-direction: row; gap: 8px; align-items: center; margin: 0; font-weight: normal; }
    .onglets { display: flex; gap: 4px; border-bottom: 2px solid var(--border); margin: 4px 0 12px; }
    .onglets button { border: 0; background: none; padding: 8px 12px; cursor: pointer; font: inherit; color: var(--muted); border-bottom: 3px solid transparent; margin-bottom: -2px; }
    .onglets button.actif, .onglet.actif { color: var(--orange-dark); border-bottom: 3px solid var(--orange); margin-bottom: -2px; padding: 8px 12px; font-weight: 600; }
    .partie { font-size: 14px; margin: 14px 0 8px; padding-bottom: 4px; border-bottom: 1px dashed var(--border); }
    .lien { border: 0; background: none; padding: 0; color: var(--orange-dark); cursor: pointer; font: inherit; text-decoration: underline; }
    .code input { max-width: 220px; letter-spacing: 4px; font-size: 18px; }
    .intervention { border: 1px solid var(--border); border-left-width: 4px; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
    .i-EN_COURS { border-left-color: #1565c0; }
    .i-A_VALIDER { border-left-color: #ef6c00; }
    .i-VALIDEE { border-left-color: #2e7d32; }
    .tete { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
    .b-EN_COURS { background: #e3f2fd; color: #1565c0; }
    .b-A_VALIDER { background: #fff3e0; color: #e65100; }
    .b-VALIDEE { background: #e8f5e9; color: #2e7d32; }
    .r-TERMINEE { background: #eceff1; color: #37474f; }
    .r-INTERROMPUE { background: #fdecea; color: #c62828; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 14px; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    @media (max-width: 600px) { .resultats.deux { grid-template-columns: 1fr; } .temps { font-size: 32px; } }
  `,
})
export class InterventionsTerrainComponent {
  private api = inject(ApiService);
  auth = inject(AuthService);

  ticket = input.required<TicketDetail>();
  /** Émis après un enregistrement, avec le message de confirmation (la fiche recharge le ticket) */
  modifie = output<string>();

  libelles = { EN_COURS: 'En cours', A_VALIDER: 'Rapport à valider', VALIDEE: 'Validée' };
  dispo = signal<Disponibilite | null>(null);
  choisis = signal(new Set<number>());
  busy = signal(false);
  erreur = signal('');
  /** Horloge (rafraîchie chaque seconde) pour le chronomètre */
  private maintenantMs = signal(Date.now());
  debutLe = maintenant();
  finLe = maintenant();
  note = '';
  r = this.rapportVide();
  /** Rapport par nature : champs propres et postes configurés / impactés (saisis avant le code du responsable du site) */
  onglet = signal<'rapport' | 'postes'>('rapport');
  modeles = computed(() => modelesDuType(this.ticket().type));
  modeleCode = signal<string | null>(null);
  modele = computed(() => modeleParCode(this.modeleCode()));
  details: Record<string, string> = {};
  postes: PosteRapport[] = [posteVide()];

  enCours = computed(() => this.ticket().interventions.find((i) => i.statut === 'EN_COURS') ?? null);
  aValider = computed(() => this.ticket().interventions.find((i) => i.statut === 'A_VALIDER') ?? null);
  /** Chronomètre HH:MM:SS de l'intervention en cours */
  chrono = computed(() => {
    const it = this.enCours();
    if (!it) return '';
    const s = Math.max(0, Math.floor((this.maintenantMs() - versDate(it.debut_le).getTime()) / 1000));
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  });
  /** Technicien du groupe du ticket, ou Responsable IT */
  peutAgir = computed(() => {
    const t = this.ticket();
    if (this.auth.hasRole('RESPONSABLE_IT')) return true;
    return this.auth.hasRole('IT') && (!t.groupe_id || t.groupe_id === this.auth.user()?.groupe_id);
  });
  peutDemarrer = computed(() => this.peutAgir() && this.ticket().statut !== 'RESOLU' && !!Number(this.ticket().action_terrain));
  techniciensDuGroupe = computed(() => {
    const g = this.ticket().groupe_id ?? this.auth.user()?.groupe_id;
    return (this.dispo()?.techniciens ?? []).filter((t) => t.groupe_id === g);
  });

  constructor() {
    effect(() => {
      if (this.aValider() && !this.r.responsable_site_nom) this.r.responsable_site_nom = this.ticket().site_responsable_nom ?? '';
      // Nature présélectionnée d'après le titre (ou conservée si elle appartient toujours au type du ticket)
      const t = this.ticket();
      const code = untracked(() => this.modeleCode());
      if (!this.modeles().some((m) => m.code === code)) this.modeleCode.set(detecterModele(t).code);
    });
    const timer = setInterval(() => this.maintenantMs.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    this.api.disponibilite().subscribe({
      next: (d) => {
        this.dispo.set(d);
        const moi = this.auth.user()?.id;
        if (moi && d.techniciens.some((t) => t.id === moi)) this.choisis.set(new Set([moi]));
      },
      error: (e) => this.erreur.set(messageErreur(e)),
    });
  }

  private rapportVide() {
    return {
      resultat: null as 'TERMINEE' | 'INTERROMPUE' | null,
      motif_interruption: '', diagnostic: '', compte_rendu: '', materiel: '', observations: '',
      responsable_site_nom: '', responsable_site_fonction: '',
      appreciation: null as 'SATISFAIT' | 'RESERVES' | null, commentaire_site: '', code: '',
    };
  }

  rapportComplet() {
    const r = this.r;
    const t = (v: string) => !!v.trim();
    return !!r.resultat && t(r.diagnostic) && t(r.compte_rendu) && (r.resultat !== 'INTERROMPUE' || t(r.motif_interruption)) &&
      t(r.responsable_site_nom) && !!r.appreciation && (r.appreciation !== 'RESERVES' || t(r.commentaire_site)) && t(r.code) &&
      !champsIncomplets(this.modele(), this.details) && !this.postesIncomplets();
  }
  /** Onglet Rapport du volet technicien incomplet */
  voletIncomplet() {
    const r = this.r;
    return !r.resultat || !r.diagnostic.trim() || !r.compte_rendu.trim() ||
      (r.resultat === 'INTERROMPUE' && !r.motif_interruption.trim()) || champsIncomplets(this.modele(), this.details);
  }
  postesIncomplets() {
    return postesIncomplets(this.postes);
  }
  private reinitialiserNature() {
    this.details = {};
    this.postes = [posteVide()];
    this.onglet.set('rapport');
  }

  max() {
    return maintenant();
  }

  /**
   * Heure saisie à envoyer : null si elle correspond à la minute en cours (le serveur prend alors l'heure exacte,
   * à la seconde près, pour le chronomètre) ; sinon l'heure corrigée par le technicien.
   */
  private heureSaisie(v: string): string | null {
    if (!v || v >= maintenant()) return null;
    return v.replace('T', ' ') + ':00';
  }

  duree(min: number) {
    return dureeMinutes(min);
  }

  noms(it: InterventionTerrain) {
    return it.intervenants.map((i) => i.nom).join(', ');
  }

  basculer(id: number) {
    const s = new Set(this.choisis());
    if (s.has(id)) s.delete(id); else s.add(id);
    this.choisis.set(s);
  }

  private enregistrer(obs: ReturnType<ApiService['demarrerTerrain']>, message: string | ((rep: any) => string), apres?: () => void) {
    this.busy.set(true);
    this.erreur.set('');
    obs.subscribe({
      next: (rep) => {
        this.busy.set(false);
        apres?.();
        this.modifie.emit(typeof message === 'function' ? message(rep) : message);
      },
      error: (e) => {
        this.erreur.set(messageErreur(e));
        this.busy.set(false);
        this.r.code = ''; // un code refusé est effacé
      },
    });
  }

  demarrer() {
    this.enregistrer(
      this.api.demarrerTerrain(this.ticket().id, {
        intervenants: [...this.choisis()],
        debut_le: this.heureSaisie(this.debutLe),
        note: this.note.trim() || null,
      }),
      '✔ Intervention terrain démarrée : le chronomètre tourne',
      () => { this.note = ''; this.debutLe = maintenant(); this.finLe = maintenant(); }
    );
  }

  terminer() {
    this.enregistrer(
      this.api.terminerTerrain(this.ticket().id, { fin_le: this.heureSaisie(this.finLe) }),
      '⏹ Intervention arrêtée : remplissez le rapport d’intervention et faites-le valider par le responsable du site',
      () => {
        this.finLe = maintenant();
        // Préremplit le nom du responsable du site
        this.r = { ...this.rapportVide(), responsable_site_nom: this.ticket().site_responsable_nom ?? '' };
        this.reinitialiserNature();
      }
    );
  }

  /** Le rapport complet est dans la section « Rapports d'intervention » de la fiche */
  voirRapport(id: number) {
    document.getElementById('rapport-terrain-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  valider(it: InterventionTerrain) {
    if (!this.rapportComplet()) return;
    this.enregistrer(
      this.api.validerRapportTerrain(this.ticket().id, it.id, {
        ...this.r,
        modele: this.modele()?.libelle ?? null,
        details: detailsPourApi(this.modele(), this.details),
        postes: postesPourApi(this.postes),
      }),
      (rep) => rep?.resolu
        ? '✔ Rapport d’intervention validé par le responsable du site — le ticket est passé en Résolu'
        : '✔ Rapport d’intervention validé par le responsable du site',
      () => { this.r = this.rapportVide(); this.reinitialiserNature(); }
    );
  }
}
