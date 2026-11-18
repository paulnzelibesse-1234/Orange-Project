import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { STATUT_LABELS, TYPE_LABELS, dureeMinutes } from '../core/labels';
import { TicketDetail } from '../core/models';
import { libellePostes } from '../core/modeles-rapport';
import { reunirRapports } from '../core/rapports';

/**
 * Rapport d'intervention au format A4, prêt à être enregistré en PDF (impression du navigateur).
 * Hors du menu de l'application : seule la feuille est imprimée.
 * Paramètres : ?r=<id rapport de résolution> ou ?i=<id intervention terrain> (sinon le rapport le plus récent).
 */
@Component({
  selector: 'app-rapport-pdf',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="barre no-print">
      <a class="btn" [routerLink]="['/glpi', id()]">← Retour au ticket</a>
      <span class="aide">Dans la fenêtre qui s’ouvre, choisissez <strong>« Enregistrer au format PDF »</strong> comme destination.</span>
      <button class="btn primary" [disabled]="!item()" (click)="imprimer()">📄 Télécharger en PDF</button>
    </div>

    @if (erreur()) { <p class="alert error no-print">{{ erreur() }}</p> }

    @if (t(); as t) {
      @if (item(); as x) {
        @let r = x.resolution;
        @let it = x.terrain;
        <article class="feuille">
          <header class="entete">
            <img src="images/logo-orange.jpg" alt="Orange" class="logo" />
            <div class="titres">
              <div class="societe">Orange Côte d'Ivoire — Interventions &amp; dépannage</div>
              <h1>Rapport d'intervention</h1>
            </div>
            <div class="ref">
              <strong>{{ t.reference }}</strong>
              <span>Édité le {{ maintenant | date: 'dd/MM/yyyy à HH:mm' }}</span>
            </div>
          </header>

          <section>
            <h2>Ticket</h2>
            <table class="infos">
              <tr><th>Objet</th><td colspan="3">{{ t.titre }}</td></tr>
              <tr>
                <th>Type</th><td>{{ typeLabels[t.type] }}</td>
                <th>Nature</th><td>{{ (r ? r.modele : it?.modele) || '—' }}</td>
              </tr>
              <tr><th>Localisation</th><td colspan="3">{{ t.localisation || '—' }} — zone {{ t.zone_nom }}</td></tr>
              <tr>
                <th>Demandeur</th><td>{{ t.createur_nom }}</td>
                <th>Signalé le</th><td>{{ t.cree_le | date: 'dd/MM/yyyy à HH:mm' }}</td>
              </tr>
              <tr>
                <th>Statut</th><td>{{ statutLabels[t.statut] }}</td>
                <th>Résolu le</th><td>{{ t.resolu_le ? (t.resolu_le | date: 'dd/MM/yyyy à HH:mm') : '—' }}</td>
              </tr>
            </table>
          </section>

          @if (it) {
            <section>
              <h2>Intervention terrain</h2>
              <table class="infos">
                <tr>
                  <th>Groupe</th><td>{{ it.groupe_nom || '—' }}</td>
                  <th>Résultat</th><td>{{ it.resultat === 'TERMINEE' ? 'Intervention terminée' : 'Intervention interrompue' }}</td>
                </tr>
                <tr><th>Intervenants</th><td colspan="3">{{ noms(it) }}</td></tr>
                <tr>
                  <th>Début</th><td>{{ it.debut_le | date: 'dd/MM/yyyy à HH:mm' }}</td>
                  <th>Fin</th><td>{{ it.fin_le | date: 'dd/MM/yyyy à HH:mm' }}</td>
                </tr>
                <tr><th>Durée</th><td colspan="3">{{ duree(it.duree_min) }}</td></tr>
                @if (it.motif_interruption) { <tr><th>Motif d'interruption</th><td colspan="3">{{ it.motif_interruption }}</td></tr> }
              </table>
            </section>
          }

          <section>
            <h2>Rapport</h2>
            @let details = r ? r.details : it?.details;
            @if (details?.length) {
              <table class="infos">
                @for (d of details; track d.cle) { <tr><th>{{ d.libelle }}</th><td>{{ d.valeur }}</td></tr> }
              </table>
            }
            <div class="bloc"><h3>Diagnostic</h3><p>{{ r ? r.diagnostic : it?.diagnostic }}</p></div>
            <div class="bloc"><h3>{{ r ? 'Actions réalisées' : 'Travaux réalisés' }}</h3><p>{{ r ? r.actions_realisees : it?.compte_rendu }}</p></div>
            @if (r ? r.materiel_utilise : it?.materiel; as mat) { <div class="bloc"><h3>Matériel utilisé</h3><p>{{ mat }}</p></div> }
            @if (it?.observations) { <div class="bloc"><h3>Observations / recommandations</h3><p>{{ it?.observations }}</p></div> }
            @if (r?.duree_minutes && !it) { <div class="bloc"><h3>Durée</h3><p>{{ duree(r?.duree_minutes ?? 0) }}</p></div> }
          </section>

          @let postes = (r ? r.postes : it?.postes) ?? [];
          <section>
            <h2>{{ libellePostes(r ? r.modele : it?.modele) }} ({{ postes.length }})</h2>
            @if (postes.length) {
              <table class="postes">
                <thead><tr><th>#</th><th>Tatouage</th><th>N° de série</th><th>Marque</th><th>Modèle</th><th>Utilisateur</th></tr></thead>
                <tbody>
                  @for (p of postes; track $index) {
                    <tr>
                      <td>{{ $index + 1 }}</td><td>{{ p.tatouage || p.numero || '—' }}</td><td>{{ p.serie || '—' }}</td>
                      <td>{{ p.marque || '—' }}</td><td>{{ p.modele || '—' }}</td><td>{{ p.utilisateur }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="vide">Aucun poste renseigné.</p>
            }
          </section>

          <section class="validation">
            <h2>Validation</h2>
            <div class="signatures">
              <div class="signature">
                <h3>Technicien</h3>
                <p><strong>{{ r ? r.technicien_nom : it?.rapport_par_nom }}</strong></p>
                <p>Rapport du {{ (r ? r.cree_le : it?.valide_le) | date: 'dd/MM/yyyy à HH:mm' }}</p>
                <div class="zone-signature">Signature</div>
              </div>
              <div class="signature">
                <h3>Responsable du site</h3>
                @if (it) {
                  <p><strong>{{ it.responsable_site_nom }}</strong>{{ it.responsable_site_fonction ? ' — ' + it.responsable_site_fonction : '' }}</p>
                  <p>Appréciation : {{ it.appreciation === 'SATISFAIT' ? 'satisfait' : 'avec réserves' }}</p>
                  @if (it.commentaire_site) { <p>« {{ it.commentaire_site }} »</p> }
                  <p class="code">✔ Validé le {{ it.valide_le | date: 'dd/MM/yyyy à HH:mm' }} avec son code de validation</p>
                } @else {
                  <p>Nom : ……………………………………</p>
                  <div class="zone-signature">Signature</div>
                }
              </div>
            </div>
          </section>

          <footer class="pied">Orange Côte d'Ivoire — {{ t.reference }} — rapport généré par l'application de suivi des interventions</footer>
        </article>
      } @else {
        <p class="alert no-print">Aucun rapport d'intervention pour ce ticket.</p>
      }
    } @else if (!erreur()) {
      <p class="muted no-print">Chargement…</p>
    }
  `,
  styles: `
    :host { display: block; background: #e9e9e9; min-height: 100vh; padding: 16px; color: #111; }
    .barre { max-width: 210mm; margin: 0 auto 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .barre .aide { flex: 1; font-size: 13px; color: #555; min-width: 200px; }
    .feuille { background: #fff; max-width: 210mm; margin: 0 auto; padding: 14mm 14mm 10mm; box-shadow: 0 2px 12px rgba(0,0,0,.15); font-size: 12.5px; line-height: 1.4; }
    .entete { display: flex; align-items: center; gap: 14px; border-bottom: 4px solid #ff7900; padding-bottom: 10px; margin-bottom: 14px; }
    .logo { width: 52px; height: 52px; object-fit: cover; }
    .titres { flex: 1; }
    .societe { font-size: 12px; color: #555; }
    h1 { font-size: 22px; margin: 2px 0 0; }
    .ref { text-align: right; display: flex; flex-direction: column; font-size: 11.5px; color: #555; }
    .ref strong { font-size: 15px; color: #111; }
    section { margin-bottom: 12px; break-inside: avoid; }
    h2 { font-size: 13.5px; text-transform: uppercase; letter-spacing: .5px; color: #fff; background: #111; padding: 4px 8px; margin: 0 0 6px; }
    h3 { font-size: 12px; margin: 0 0 2px; color: #ff7900; }
    table { width: 100%; border-collapse: collapse; }
    .infos th, .infos td { border: 1px solid #ccc; padding: 4px 7px; text-align: left; vertical-align: top; }
    .infos th { background: #f4f4f4; width: 22%; font-weight: 600; }
    .bloc { margin: 6px 0; }
    .bloc p { margin: 0; white-space: pre-wrap; }
    .postes th, .postes td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
    .postes thead th { background: #ff7900; color: #fff; }
    .postes tbody tr:nth-child(even) td { background: #fafafa; }
    .vide { color: #777; margin: 0; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .signature { border: 1px solid #ccc; padding: 8px 10px; min-height: 90px; }
    .signature p { margin: 2px 0; }
    .zone-signature { margin-top: 18px; border-top: 1px dashed #999; padding-top: 2px; font-size: 11px; color: #777; }
    .code { color: #1b5e20; font-weight: 600; }
    .pied { border-top: 1px solid #ccc; margin-top: 14px; padding-top: 6px; font-size: 10.5px; color: #777; text-align: center; }
    @media print {
      :host { background: #fff; padding: 0; }
      .no-print { display: none !important; }
      .feuille { box-shadow: none; max-width: none; padding: 0; }
      h2, .postes thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .entete, .postes thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media (max-width: 640px) { .feuille { padding: 16px; } .signatures { grid-template-columns: 1fr; } }
  `,
})
export class RapportPdfPage {
  private api = inject(ApiService);
  id = input.required<string>();
  r = input<string>();
  i = input<string>();

  t = signal<TicketDetail | null>(null);
  erreur = signal('');
  maintenant = new Date();
  typeLabels = TYPE_LABELS;
  statutLabels = STATUT_LABELS;
  libellePostes = libellePostes;

  item = computed(() => {
    const items = reunirRapports(this.t());
    const r = this.r(), i = this.i();
    return items.find((x) => (r && x.resolution?.id === +r) || (i && x.terrain?.id === +i)) ?? items[0] ?? null;
  });

  constructor() {
    const titre = document.title;
    inject(DestroyRef).onDestroy(() => (document.title = titre));
    effect(() => {
      this.api.ticket(Number(this.id())).subscribe({
        next: (t) => {
          this.t.set(t);
          document.title = `Rapport-${t.reference}`; // nom proposé pour le fichier PDF
        },
        error: (e) => this.erreur.set(messageErreur(e)),
      });
    });
  }

  imprimer() {
    window.print();
  }
  duree(min: number) {
    return dureeMinutes(min);
  }
  noms(it: { intervenants: { nom: string }[] }) {
    return it.intervenants.map((x) => x.nom).join(', ');
  }
}
