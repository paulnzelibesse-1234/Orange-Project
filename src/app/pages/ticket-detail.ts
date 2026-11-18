import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AffectationComponent } from '../components/affectation';
import { InterventionsTerrainComponent } from '../components/interventions-terrain';
import { NotificationsService } from '../core/notifications.service';
import { AuthService } from '../core/auth.service';
import { messageErreur } from '../core/auth.interceptor';
import {
  TYPE_ICONES, TYPE_LABELS, ACTION_LABELS, CATEGORIE_LABELS, PRIORITE_LABELS, ROLE_LABELS, STATUT_LABELS, STATUTS, UPLOADS_URL, infoDelai, infoDelaiTerrain, libelleStatut, MOTIF_ATTENTE_LABELS, MOTIFS_ATTENTE, dureeMinutes,
} from '../core/labels';
import { InterventionTerrain, MotifAttente, Rapport, Statut, TicketDetail, TypeTicket, User } from '../core/models';
import {
  ModeleRapport, PosteRapport, champsIncomplets, copierPostes, detailsPourApi, detecterModele, libellePostes, modeleParCode, modelesDuType,
  posteVide, postesIncomplets, postesPourApi,
} from '../core/modeles-rapport';
import { ChampsModeleComponent, PostesRapportComponent, RapportDetailsComponent } from '../components/rapport-modele';
import { reunirRapports } from '../core/rapports';

@Component({
  selector: 'app-ticket-detail',
  imports: [FormsModule, RouterLink, DatePipe, AffectationComponent, InterventionsTerrainComponent, ChampsModeleComponent, PostesRapportComponent, RapportDetailsComponent],
  template: `
    @if (auth.hasRole('UTILISATEUR')) {
      <a routerLink="/mes-signalements" class="back">← Retour à mes signalements</a>
    } @else {
      <a routerLink="/glpi" class="back">← Retour aux tickets</a>
    }

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }
    @if (succes()) { <div class="alert success">{{ succes() }}</div> }

    @if (t(); as t) {
      <header class="page-head">
        <div>
          <span class="ref">{{ t.reference }}</span>
          <h1>{{ t.titre }}</h1>
          <div class="meta">
            <span class="badge t-{{ t.type }}">{{ typeIcones[t.type] }} {{ typeLabels[t.type] }}</span>
            <span class="badge s-{{ t.statut }}">{{ statutLabels[t.statut] }}</span>
            @if (t.statut === 'EN_ATTENTE' && t.motif_attente) { <span class="badge s-EN_ATTENTE">{{ motifLabels[t.motif_attente] }}</span> }
            <span class="badge {{ delai().classe }}" [title]="delai().titre">⏱ {{ delai().texte }}</span>
            @if (delaiTerrain(); as dt) { <span class="badge {{ dt.classe }}" [title]="dt.titre">{{ dt.texte }}</span> }
            @if (t.terrain_en_cours_depuis) { <span class="badge b-sur-terrain">🚐 Sur le terrain depuis {{ t.terrain_en_cours_depuis | date: 'HH:mm' }}</span> }
            @if (+t.action_terrain) { <span class="badge b-terrain">🛠 Action terrain</span> }
            @if (t.validation_client === 'EN_ATTENTE') { <span class="badge b-valider">En attente de validation du client</span> }
            @if (t.validation_client === 'VALIDE' && t.statut === 'RESOLU') { <span class="badge b-valide">Validé par le client</span> }
            <span>Zone {{ t.zone_nom }}</span>
          </div>
        </div>
      </header>

      <div class="layout">
        <div class="main">
          <section class="card">
            <h2>Description</h2>
            <p class="pre">{{ t.description }}</p>
            @if (t.localisation) { <p><strong>Localisation :</strong> {{ t.localisation }}</p> }
            @if (t.capture) {
              <p><strong>Capture jointe :</strong></p>
              <a [href]="uploadsUrl + '/' + t.capture" target="_blank" rel="noopener" title="Ouvrir en taille réelle">
                <img [src]="uploadsUrl + '/' + t.capture" alt="Capture jointe au ticket"
                     style="display:block;max-width:100%;max-height:360px;border:1px solid var(--border);border-radius:6px" />
              </a>
            }
          </section>

          <!-- Responsable IT : affectation à un groupe de techniciens (selon la zone et la disponibilité) -->
          @if (peutAttribuer()) {
            <section class="card action-card">
              <h2>{{ t.groupe_id ? 'Réaffecter' : 'Affecter' }} le ticket</h2>
              @if (t.groupe_nom) {
                <p class="muted">Actuellement : {{ t.groupe_nom }}{{ t.technicien_nom ? ' — ' + t.technicien_nom : ' — technicien non désigné' }}</p>
              }
              @defer (on viewport) {
                <app-affectation [ticket]="t" (affecte)="apresAffectation($event)" />
              } @placeholder {
                <p class="muted">Chargement…</p>
              }
            </section>
          }

          <!-- IT / Responsable IT : changement de statut -->
          @if (afficherStatut()) {
            <section class="card action-card" id="statut">
              <h2>Changer le statut</h2>
              <p class="statut-actuel">
                Statut actuel : <span class="badge s-{{ t.statut }}">{{ statutLabels[t.statut] }}</span>
                <span class="badge {{ delai().classe }}" [title]="delai().titre">⏱ {{ delai().texte }}</span>
              </p>

              @if (transitions().length === 0) {
                <p class="muted">{{ raisonSansTransition() }}</p>
              } @else {
                <label>Nouveau statut *
                  <select [(ngModel)]="nouveauStatut">
                    <option [ngValue]="null" disabled>Choisir le nouveau statut…</option>
                    @for (s of statuts; track s) {
                      <option [ngValue]="s" [disabled]="!transitions().includes(s)">
                        {{ statutLabels[s] }}{{ s === t.statut ? ' (actuel)' : '' }}
                      </option>
                    }
                  </select>
                </label>

                @if (t.statut === 'RESOLU' && nouveauStatut) {
                  <p class="alert terrain">Le ticket sera rouvert : sa résolution (et la validation client éventuelle) est annulée.</p>
                }
                @if (nouveauStatut && nouveauStatut !== 'EN_COURS_ATTRIBUE' && !t.technicien_id && auth.hasRole('IT')) {
                  <p class="muted">Le ticket vous sera attribué.</p>
                }
                @switch (nouveauStatut) {
                  @case ('EN_COURS_ATTRIBUE') {
                    <label>Commentaire (facultatif)
                      <textarea rows="2" [(ngModel)]="plan.commentaire"></textarea>
                    </label>
                  }
                  @case ('EN_COURS_PLANIFIE') {
                    <label>Date d'intervention prévue (facultatif)
                      <input type="datetime-local" [(ngModel)]="plan.date_planifiee" />
                    </label>
                    <label>Commentaire (facultatif)
                      <textarea rows="2" [(ngModel)]="plan.commentaire" placeholder="Ex : pièce reçue, intervention reprise"></textarea>
                    </label>
                  }
                  @case ('EN_ATTENTE') {
                    <p class="muted">Le délai de traitement sera mis en pause jusqu'à la reprise.</p>
                    <fieldset class="motifs">
                      <legend>Motif de la mise en attente *</legend>
                      @for (m of motifsAttente; track m) {
                        <label class="motif" [class.choisi]="typeAttente === m">
                          <input type="radio" name="typeAttente" [value]="m" [(ngModel)]="typeAttente" />
                          <span>
                            <strong>{{ motifLabels[m] }}</strong><br />
                            <small class="muted">
                              @if (m === 'RESSOURCE_INDISPONIBLE') { La ressource ou l'équipement nécessaire n'est pas disponible. }
                              @else { La résolution nécessite une intervention sur le terrain : le client devra valider la résolution. }
                            </small>
                          </span>
                        </label>
                      }
                    </fieldset>
                    @if (typeAttente) {
                      <label>{{ typeAttente === 'RESSOURCE_INDISPONIBLE' ? 'Ressource ou équipement attendu *' : 'Intervention terrain à réaliser *' }}
                        <textarea rows="2" [(ngModel)]="motifAttente"
                          [placeholder]="typeAttente === 'RESSOURCE_INDISPONIBLE' ? 'Ex : cartouche d’encre, switch 24 ports, licence…' : 'Ex : déplacement sur site pour remplacer le câble réseau'"></textarea>
                      </label>
                    }
                  }
                  @case ('RESOLU') {
                    @if (+t.action_terrain) {
                      <p class="alert terrain">🛠 Action terrain : après le passage en Résolu, le client devra valider la résolution.</p>
                    }
                    <label>Nature {{ t.type === 'DEMANDE' ? 'de la demande' : 'de l’incident' }} *
                      <select name="modele" [ngModel]="rapport.modele" (ngModelChange)="choisirModele($event)">
                        @for (m of modeles(); track m.code) { <option [value]="m.code">{{ m.libelle }}</option> }
                      </select>
                      @if (prerempli(); as p) {
                        <small class="prerempli">🚐 Rapport prérempli à partir de l’intervention terrain validée par le site le {{ p | date: 'dd/MM/yyyy à HH:mm' }} : vérifiez et complétez.</small>
                      } @else {
                        <small class="muted">Présélectionnée d’après le titre du ticket — rapport « {{ typeLabels[t.type] }} ».</small>
                      }
                    </label>

                    @let mod = modele();
                    <!-- Un seul onglet « Rapport » : informations de l'intervention + postes travaillés -->
                    <div class="onglets"><span class="onglet actif">📋 Rapport</span></div>
                    <h4 class="partie">Intervention{{ rapportIncomplet() ? ' •' : '' }}</h4>
                    <app-champs-modele [modele]="mod" [details]="rapport.details" />
                    <label>Diagnostic *
                      <textarea rows="3" [(ngModel)]="rapport.diagnostic"></textarea>
                    </label>
                    <label>Actions réalisées *
                      <textarea rows="4" [(ngModel)]="rapport.actions_realisees"></textarea>
                    </label>
                    <div class="grid-2">
                      <label>Matériel utilisé <input [(ngModel)]="rapport.materiel_utilise" /></label>
                      <label>Durée (minutes) <input type="number" min="0" [(ngModel)]="rapport.duree_minutes" /></label>
                    </div>
                    <h4 class="partie">🖥 {{ mod?.postes }} ({{ rapport.postes.length }}){{ postesIncomplets() ? ' •' : '' }}</h4>
                    <app-postes-rapport [postes]="rapport.postes" [libelle]="mod?.postes ?? 'Postes concernés'" />
                  }
                }

                <button class="btn primary" [disabled]="!statutValide() || busy()" (click)="changerStatut()">
                  {{ busy() ? 'Sauvegarde…' : '💾 Sauvegarder' }}
                </button>
              }
            </section>
          }

          <!-- Demandeur : validation de la résolution (ticket « action terrain ») -->
          @if (estDemandeur() && t.statut === 'RESOLU' && t.validation_client === 'EN_ATTENTE') {
            <section class="card action-card">
              <h2>Valider la résolution</h2>
              <p class="muted">Le technicien a indiqué avoir résolu le problème sur le terrain. Consultez son rapport ci-dessous puis confirmez.</p>
              <label>Commentaire (obligatoire si le problème n'est pas résolu)
                <textarea rows="2" [(ngModel)]="commentaireValidation"></textarea>
              </label>
              <div class="actions">
                <button class="btn danger" [disabled]="busy() || !commentaireValidation"
                        (click)="action(api.valider(t.id, 'REJETE', commentaireValidation), 'Résolution rejetée : le technicien va reprendre l\\'intervention')">
                  Le problème n'est pas résolu
                </button>
                <button class="btn primary" [disabled]="busy()"
                        (click)="action(api.valider(t.id, 'VALIDE', commentaireValidation), 'Merci ! Résolution validée, ticket clôturé')">
                  Valider la résolution
                </button>
              </div>
            </section>
          }

          <!-- Journal des interventions terrain (IT / Responsable IT) -->
          @if (!auth.hasRole('UTILISATEUR') && (+t.action_terrain || t.interventions.length)) {
            <section class="card" id="terrain">
              <h2>🚐 Interventions terrain</h2>
              <app-interventions-terrain [ticket]="t" (modifie)="apresAffectation($event)" />
            </section>
          }

          <!-- Rapports d'intervention : résolution du ticket et interventions terrain validées par le site, réunis -->
          <section class="card" id="rapports">
            <h2>Rapports d'intervention ({{ rapportsReunis().length }})</h2>
            @for (x of rapportsReunis(); track x.cle) {
              @let r = x.resolution;
              @let it = x.terrain;
              <article class="rapport" [class.r-terrain]="it && !r" [class.r-resolution]="r && !it" [class.r-joint]="r && it"
                       [id]="it ? 'rapport-terrain-' + it.id : null">
                <div class="rapport-head">
                  @if (r && it) { <span class="badge b-joint">📄 Rapport d'intervention</span> }
                  @if (r) { <span class="badge s-RESOLU">✔ Résolution du ticket</span> }
                  @if (it) {
                    <span class="badge b-terrain">🚐 Intervention terrain</span>
                    <span class="badge" [class]="it.resultat === 'TERMINEE' ? 'r-ok' : 'r-ko'">{{ it.resultat === 'TERMINEE' ? 'Terminée' : 'Interrompue' }}</span>
                  }
                  <a class="btn small pdf" target="_blank" [routerLink]="['/glpi', t.id, 'rapport']"
                     [queryParams]="r ? { r: r.id } : { i: it?.id }" title="Ouvrir le rapport au format A4 pour l’enregistrer en PDF">📄 PDF</a>
                </div>
                @if (it) {
                  <p class="muted">
                    🚐 {{ it.groupe_nom ?? 'Sans groupe' }} — {{ nomsIntervenants(it) }} — du {{ it.debut_le | date: 'dd/MM/yyyy HH:mm' }}
                    au {{ it.fin_le | date: 'dd/MM/yyyy HH:mm' }} (durée : {{ dureeMin(it.duree_min) }})
                  </p>
                }
                <!-- Contenu : celui de la résolution (rapport final), sinon celui du rapport terrain -->
                <app-rapport-details [modele]="r ? r.modele : it?.modele" [details]="r ? r.details : it?.details" />
                @if (it?.motif_interruption) { <p><strong>Motif d'interruption :</strong> <span class="pre">{{ it?.motif_interruption }}</span></p> }
                <p><strong>Diagnostic :</strong> <span class="pre">{{ r ? r.diagnostic : it?.diagnostic }}</span></p>
                <p><strong>{{ r ? 'Actions réalisées' : 'Travaux réalisés' }} :</strong> <span class="pre">{{ r ? r.actions_realisees : it?.compte_rendu }}</span></p>
                @if (r ? r.materiel_utilise : it?.materiel; as mat) { <p><strong>Matériel :</strong> {{ mat }}</p> }
                @if (it?.observations) { <p><strong>Observations :</strong> {{ it?.observations }}</p> }
                @if (r?.duree_minutes && !it) { <p><strong>Durée :</strong> {{ r?.duree_minutes }} min</p> }
                <app-rapport-details [postes]="r ? r.postes : it?.postes" [libellePostes]="libellePostes(r ? r.modele : it?.modele)" />
                @if (it) {
                  <p class="valide-site">
                    ✔ Intervention validée par <strong>{{ it.responsable_site_nom }}</strong>{{ it.responsable_site_fonction ? ' (' + it.responsable_site_fonction + ')' : '' }}
                    — {{ it.appreciation === 'SATISFAIT' ? 'satisfait' : 'avec réserves' }} — le {{ it.valide_le | date: 'dd/MM/yyyy à HH:mm' }} avec son code
                    @if (it.commentaire_site) { <br /><span class="muted">« {{ it.commentaire_site }} »</span> }
                  </p>
                }
                <p class="signature muted">
                  @if (it) { Rapport terrain de {{ it.rapport_par_nom }}{{ r ? ' · ' : '' }} }
                  @if (r) { Résolution saisie par {{ r.technicien_nom }} le {{ r.cree_le | date: 'dd/MM/yyyy à HH:mm' }} }
                </p>
              </article>
            } @empty {
              <p class="muted">Aucun rapport pour le moment.</p>
            }
          </section>
        </div>

        <aside class="side">
          <!-- Celui qui a créé le ticket -->
          <section class="card demandeur">
            <h2>👤 Demandeur</h2>
            <dl>
              <dt>Nom</dt><dd><strong>{{ t.createur_nom }}</strong></dd>
              <dt>Numéro</dt>
              <dd>@if (t.createur_telephone) { <a [href]="'tel:' + t.createur_telephone">{{ t.createur_telephone }}</a> } @else { <span class="muted">Non renseigné</span> }</dd>
              <dt>Email</dt>
              <dd>@if (t.createur_email) { <a class="mail" [href]="'mailto:' + t.createur_email">{{ t.createur_email }}</a> } @else { <span class="muted">—</span> }</dd>
              <dt>Site</dt><dd>{{ t.createur_site || '—' }}</dd>
              <dt>Direction</dt><dd>{{ t.createur_direction || '—' }}</dd>
              @if (t.createur_service) { <dt>Service</dt><dd>{{ t.createur_service }}</dd> }
            </dl>
          </section>

          <section class="card">
            <h2>Informations</h2>
            <dl>
              <dt>Type</dt>
              <dd>
                <span class="badge t-{{ t.type }}">{{ typeIcones[t.type] }} {{ typeLabels[t.type] }}</span>
                @if (!auth.hasRole('UTILISATEUR')) {
                  <div class="requalif">
                    <select name="requalif" [(ngModel)]="nouveauType" aria-label="Requalifier le ticket">
                      <option value="INCIDENT">⚠ Incident</option>
                      <option value="DEMANDE">📝 Demande</option>
                    </select>
                    <button class="btn small" [disabled]="nouveauType === t.type || busy()" (click)="requalifier()">💾 Requalifier</button>
                  </div>
                }
              </dd>
              <dt>Technicien</dt><dd>{{ t.technicien_nom ?? 'Non attribué' }}</dd>
              <dt>Groupe</dt><dd>{{ t.groupe_nom ?? 'Non affecté' }}</dd>
              <dt>Planifié le</dt><dd>{{ t.date_planifiee ? (t.date_planifiee | date: 'dd/MM/yyyy HH:mm') : '—' }}</dd>
              <dt>Créé le</dt><dd>{{ t.cree_le | date: 'dd/MM/yyyy HH:mm' }}</dd>
              <dt>Statut</dt>
              <dd>
                <span class="badge s-{{ t.statut }}">{{ statutLabels[t.statut] }}</span>
                @if (t.statut === 'EN_ATTENTE' && t.motif_attente) { <br /><small>{{ motifLabels[t.motif_attente] }}</small> }
                <br /><small class="muted">depuis le {{ t.statut_depuis | date: 'dd/MM/yyyy HH:mm' }}</small>
              </dd>
              <dt>Délai (8 h)</dt><dd><span class="badge {{ delai().classe }}" [title]="delai().titre">{{ delai().texte }}</span></dd>
              @if (delaiTerrain(); as dt) {
                <dt>Délai terrain (2 j)</dt>
                <dd>
                  <span class="badge {{ dt.classe }}">{{ dt.texte }}</span>
                  <br /><small class="muted">Reçu par le groupe le {{ t.terrain_affecte_le | date: 'dd/MM/yyyy HH:mm' }}</small>
                  <br /><small class="muted">Échéance : {{ t.terrain_echeance | date: 'dd/MM/yyyy HH:mm' }}</small>
                </dd>
              }
              @if (t.resolu_le) { <dt>Résolu le</dt><dd>{{ t.resolu_le | date: 'dd/MM/yyyy HH:mm' }}</dd> }
              @if (+t.action_terrain) {
                <dt>Validation client</dt>
                <dd>{{ t.validation_client === 'EN_ATTENTE' ? 'En attente' : t.validation_client === 'VALIDE' ? 'Validée'
                       : t.validation_client === 'REJETE' ? 'Rejetée — intervention à reprendre' : 'Requise à la résolution' }}</dd>
              }
              @if (t.cloture_le && +t.action_terrain) { <dt>Clôturé le</dt><dd>{{ t.cloture_le | date: 'dd/MM/yyyy HH:mm' }}</dd> }
            </dl>
          </section>

          <section class="card">
            <h2>Commentaires</h2>
            <ol class="timeline">
              @for (h of t.historique; track h.id) {
                <li>
                  <div class="tl-head">
                    <strong>{{ actionLabels[h.action] ?? h.action }}</strong>
                    <small class="muted">{{ h.cree_le | date: 'dd/MM HH:mm' }}</small>
                  </div>
                  <small>{{ h.utilisateur_nom }} ({{ roleLabels[h.utilisateur_role] }})</small>
                  @if (h.nouveau_statut && h.ancien_statut !== h.nouveau_statut) {
                    <small class="muted"> · {{ h.ancien_statut ? libelleStatut(h.ancien_statut) + ' → ' : '' }}{{ libelleStatut(h.nouveau_statut) }}</small>
                  }
                  @if (h.details) { <p class="pre">{{ h.details }}</p> }
                </li>
              }
            </ol>
            <div class="comment-box">
              <textarea rows="2" [(ngModel)]="commentaire" placeholder="Ajouter un commentaire…"></textarea>
              @if (peutSignalerTerrain()) {
                <label class="check-terrain">
                  <input type="checkbox" [(ngModel)]="actionTerrain" />
                  <span>
                    <strong>Nécessite une action terrain</strong><br />
                    <small class="muted">La résolution devra être validée par le client.</small>
                  </span>
                </label>
              }
              <button class="btn" [class.primary]="actionTerrain" [disabled]="!commentaire.trim() || busy()" (click)="commenter()">
                {{ actionTerrain ? 'Signaler l\\'action terrain' : 'Commenter' }}
              </button>
            </div>
          </section>
        </aside>
      </div>
    } @else if (!erreur()) {
      <p class="muted">Chargement…</p>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: 12px; color: var(--muted); text-decoration: none; }
    .requalif { display: flex; gap: 6px; margin-top: 6px; }
    .requalif select { width: auto; padding: 4px 6px; font-size: 13px; }
    .meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 6px; }
    .layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 18px; }
    .main, .side { display: flex; flex-direction: column; gap: 18px; }
    .action-card { border-left: 4px solid var(--orange); }
    .r-terrain { border-left: 4px solid #00897b; }
    .r-resolution { border-left: 4px solid #2e7d32; }
    .r-joint { border-left: 4px solid var(--orange); }
    .b-joint { background: #fff3e0; color: #e65100; font-weight: 700; }
    .signature { font-size: 12.5px; margin: 6px 0 0; }
    .rapport-head .pdf { margin-left: auto; text-decoration: none; }
    .r-ok { background: #eceff1; color: #37474f; }
    .r-ko { background: #fdecea; color: #c62828; }
    .valide-site { background: #e8f5e9; border-radius: 6px; padding: 6px 10px; font-size: 14px; }
    .prerempli { display: block; margin-top: 4px; padding: 6px 10px; border-radius: 6px; background: #e0f2f1; color: #00695c; }
    .onglets { display: flex; gap: 4px; border-bottom: 2px solid var(--border); margin: 10px 0 12px; }
    .onglets button { border: 0; background: none; padding: 8px 12px; cursor: pointer; font: inherit; color: var(--muted); border-bottom: 3px solid transparent; margin-bottom: -2px; }
    .onglets button.actif, .onglet.actif { color: var(--orange-dark); border-bottom: 3px solid var(--orange); margin-bottom: -2px; padding: 8px 12px; font-weight: 600; }
    .partie { font-size: 14px; margin: 14px 0 8px; padding-bottom: 4px; border-bottom: 1px dashed var(--border); color: var(--text, inherit); }
    .rapport { border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .rapport-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
    .comment { background: var(--bg-soft); padding: 8px; border-radius: 6px; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; }
    dt { color: var(--muted); }
    dd { margin: 0; }
    .demandeur .mail { word-break: break-all; }
    .timeline { list-style: none; padding: 0; margin: 0; border-left: 2px solid var(--border); }
    .timeline li { padding: 0 0 14px 14px; position: relative; }
    .timeline li::before { content: ''; position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--orange); }
    .tl-head { display: flex; justify-content: space-between; gap: 8px; }
    .timeline p { margin: 4px 0 0; font-size: 13px; }
    .comment-box { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .check-terrain { display: flex; flex-direction: row; gap: 8px; align-items: flex-start; margin: 0; font-weight: normal; cursor: pointer; }
    .motifs { border: none; padding: 0; margin: 0 0 12px; display: grid; gap: 8px; }
    .motifs legend { font-weight: 500; margin-bottom: 6px; padding: 0; }
    .motif { display: flex; flex-direction: row; gap: 10px; align-items: flex-start; margin: 0; padding: 10px 12px;
             border: 1px solid var(--border); border-radius: 8px; cursor: pointer; font-weight: normal; }
    .motif:hover { border-color: var(--orange); }
    .motif.choisi { border-color: var(--orange); background: #fff7f0; }
    .motif input { width: auto; margin-top: 3px; }
    .statut-actuel { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 0; }
    .check-terrain input { width: auto; margin-top: 3px; }
    .alert.terrain { background: #e0f2f1; color: #00695c; margin: 0 0 12px; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
  `,
})
export class TicketDetailPage {
  uploadsUrl = UPLOADS_URL;
  api = inject(ApiService);
  auth = inject(AuthService);
  private notifs = inject(NotificationsService);

  id = input.required<string>();
  depuis = input<string>(); // ?depuis=mes-signalements

  statutLabels = STATUT_LABELS;
  typeLabels = TYPE_LABELS;
  typeIcones = TYPE_ICONES;
  /** Requalification incident ⇄ demande (IT / Responsable IT) */
  nouveauType: TypeTicket = 'INCIDENT';
  prioriteLabels = PRIORITE_LABELS;
  categorieLabels = CATEGORIE_LABELS;
  actionLabels = ACTION_LABELS;
  roleLabels = ROLE_LABELS;
  libelleStatut = libelleStatut;

  t = signal<TicketDetail | null>(null);
  erreur = signal('');
  succes = signal('');
  busy = signal(false);

  plan = { date_planifiee: '', commentaire: '' };
  nouveauStatut: Statut | null = null;
  statuts = STATUTS;
  rapport = this.rapportVide();
  /** Rapport par modèle : nature (demande / incident), champs propres, postes configurés / impactés */
  onglet = signal<'rapport' | 'postes'>('rapport');
  modeles = computed(() => (this.t() ? modelesDuType(this.t()!.type) : []));
  modeleCode = signal<string | null>(null);
  modele = computed<ModeleRapport | null>(() => modeleParCode(this.modeleCode()));

  private rapportVide() {
    return {
      diagnostic: '', actions_realisees: '', materiel_utilise: '', duree_minutes: null as number | null,
      modele: null as string | null,
      details: {} as Record<string, string>,
      postes: [posteVide()] as PosteRapport[],
    };
  }
  /** Date de validation du rapport terrain qui a prérempli le rapport de résolution */
  prerempli = signal<string | null>(null);

  /** Rapports de résolution + interventions terrain validées, du plus récent au plus ancien */
  rapportsReunis = computed(() => reunirRapports(this.t()));
  nomsIntervenants(it: InterventionTerrain) {
    return it.intervenants.map((i) => i.nom).join(', ');
  }
  dureeMin(min: number) {
    return dureeMinutes(min);
  }

  /**
   * Rapport de résolution : prérempli à partir du dernier rapport d'intervention terrain validé par le site
   * (nature, champs, postes, diagnostic, travaux, matériel, durée) ; sinon nature d'après le titre.
   */
  private initialiserRapport(t: TicketDetail) {
    this.rapport = this.rapportVide();
    this.onglet.set('rapport');
    this.prerempli.set(null);
    const it = t.interventions.find((i) => i.statut === 'VALIDEE');
    const mod = it?.modele ? this.modeles().find((m) => m.libelle === it.modele) : null;
    if (it) {
      const r = this.rapport;
      r.diagnostic = it.diagnostic ?? '';
      r.actions_realisees = it.compte_rendu ?? '';
      r.materiel_utilise = it.materiel ?? '';
      r.duree_minutes = it.duree_min ?? null;
      r.postes = copierPostes(it.postes);
      for (const d of it.details ?? []) r.details[d.cle] = d.valeur;
      this.prerempli.set(it.valide_le ?? it.fin_le);
    }
    this.choisirModele(mod?.code ?? detecterModele(t).code);
  }
  choisirModele(code: string) {
    this.rapport.modele = code;
    this.modeleCode.set(code);
  }
  rapportIncomplet() {
    const r = this.rapport;
    return !r.diagnostic.trim() || !r.actions_realisees.trim() || champsIncomplets(this.modele(), r.details);
  }
  postesIncomplets() {
    return postesIncomplets(this.rapport.postes);
  }
  libellePostes = libellePostes;
  motifAttente = '';
  typeAttente: MotifAttente | null = null;
  motifsAttente = MOTIFS_ATTENTE;
  motifLabels = MOTIF_ATTENTE_LABELS;
  commentaire = '';
  commentaireValidation = '';
  actionTerrain = false;

  delai = computed(() => infoDelai(this.t()!));
  delaiTerrain = computed(() => (this.t() ? infoDelaiTerrain(this.t()!) : null));
  peutAttribuer = computed(() => this.auth.hasRole('RESPONSABLE_IT') && !!this.t() && this.t()!.statut !== 'RESOLU');
  /** Technicien attribué au ticket */
  estMonIntervention = computed(() => this.auth.hasRole('IT') && this.t()?.technicien_id === this.auth.user()?.id);
  estDemandeur = computed(() => this.t()?.createur_id === this.auth.user()?.id);
  /** Case « action terrain » : IT / Responsable IT, ticket non résolu et pas encore signalé */
  peutSignalerTerrain = computed(() => {
    const t = this.t();
    return !this.auth.hasRole('UTILISATEUR') && !!t && t.statut !== 'RESOLU' && !Number(t.action_terrain);
  });
  /** Le bloc « Changer le statut » est visible des IT et du Responsable IT, quel que soit le statut */
  afficherStatut = computed(() => !this.auth.hasRole('UTILISATEUR') && !!this.t());

  /** Libre choix : tous les statuts sauf le statut actuel */
  transitions = computed<Statut[]>(() => {
    const t = this.t();
    return t ? STATUTS.filter((s) => s !== t.statut) : [];
  });

  raisonSansTransition = computed(() => 'Aucun changement de statut possible.');

  statutValide() {
    switch (this.nouveauStatut) {
      case 'EN_COURS_ATTRIBUE':
      case 'EN_COURS_PLANIFIE': return true;
      case 'EN_ATTENTE': return !!this.typeAttente && !!this.motifAttente.trim();
      case 'RESOLU': return !this.rapportIncomplet() && !this.postesIncomplets();
      default: return false;
    }
  }

  constructor() {
    effect(() => this.charger(Number(this.id())));
  }

  charger(id: number) {
    this.api.ticket(id).subscribe({
      next: (t) => {
        this.t.set(t);
        this.nouveauType = t.type;
        this.initialiserRapport(t);
        this.notifs.marquerTicketLu(t.id);
        this.nouveauStatut = null;
      },
      error: (e) => this.erreur.set(messageErreur(e)),
    });
  }

  action(obs: Observable<unknown>, message: string) {
    this.busy.set(true);
    this.erreur.set('');
    this.succes.set('');
    obs.subscribe({
      next: () => {
        this.succes.set(message);
        this.busy.set(false);
        this.motifAttente = '';
        this.typeAttente = null;
        this.commentaireValidation = '';
        this.plan = { date_planifiee: '', commentaire: '' };
        this.charger(this.t()!.id);
      },
      error: (e) => { this.erreur.set(messageErreur(e)); this.busy.set(false); },
    });
  }

  apresAffectation(message: string) {
    this.erreur.set('');
    this.succes.set(message);
    this.charger(this.t()!.id);
  }

  changerStatut() {
    const t = this.t()!;
    const s = this.nouveauStatut!;
    const donnees: Record<string, unknown> = { statut: s, commentaire: this.plan.commentaire.trim() };
    let message = `✔ Modification sauvegardée — statut : ${STATUT_LABELS[s]}`;
    if (s === 'EN_COURS_PLANIFIE' && this.plan.date_planifiee) {
      donnees['date_planifiee'] = this.plan.date_planifiee.replace('T', ' ') + ':00';
    }
    if (s === 'EN_ATTENTE') {
      Object.assign(donnees, { motif_attente: this.typeAttente, motif: this.motifAttente.trim() });
      message += ` (${MOTIF_ATTENTE_LABELS[this.typeAttente!].toLowerCase()})`;
    }
    if (s === 'RESOLU') {
      const r = this.rapport;
      const mod = this.modele();
      Object.assign(donnees, {
        diagnostic: r.diagnostic, actions_realisees: r.actions_realisees,
        materiel_utilise: r.materiel_utilise, duree_minutes: r.duree_minutes,
        modele: mod?.libelle ?? null,
        details: detailsPourApi(mod, r.details),
        postes: postesPourApi(r.postes),
      });
      if (Number(t.action_terrain)) message += ' — en attente de validation du client';
    }
    this.action(this.api.changerStatut(t.id, donnees), message);
  }

  requalifier() {
    const t = this.t()!;
    this.action(this.api.requalifier(t.id, this.nouveauType), `✔ Ticket requalifié en « ${TYPE_LABELS[this.nouveauType]} »`);
  }

  commenter() {
    const terrain = this.actionTerrain;
    this.action(
      this.api.commenter(this.t()!.id, this.commentaire.trim(), terrain),
      terrain ? 'Action terrain signalée : le client devra valider la résolution' : 'Commentaire ajouté'
    );
    this.commentaire = '';
    this.actionTerrain = false;
  }
}
