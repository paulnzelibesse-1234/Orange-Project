import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { messageErreur } from '../core/auth.interceptor';
import { DIRECTIONS, ROLE_LABELS, SERVICES } from '../core/labels';
import { Groupe, Role, Site, User, Zone } from '../core/models';

const VIDE = { nom: '', prenom: '', email: '', telephone: '', mot_de_passe: '', role: 'IT' as Role, groupe_id: null as number | null, zone_id: null as number | null,
  direction: '', service: '', site_id: null as number | null };

@Component({
  selector: 'app-users',
  imports: [FormsModule, DatePipe],
  template: `
    <header class="page-head">
      <div>
        <h1>Utilisateurs & groupes</h1>
        <p class="muted">Gestion des comptes et des groupes d'intervenants par zone</p>
      </div>
      <button class="btn primary" (click)="ouvrir()">+ Nouveau compte</button>
    </header>

    @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }
    @if (succes()) { <div class="alert success">{{ succes() }}</div> }

    <!-- Comptes créés depuis l'inscription (profil IT / Responsable IT), email vérifié : à valider -->
    @if (enAttente().length) {
      <section class="card attente">
        <h2>⏳ Comptes en attente de validation ({{ enAttente().length }})</h2>
        <p class="muted">Ces personnes ont créé leur compte et vérifié leur adresse email. Vérifiez leur identité avant d'approuver.</p>
        @for (u of enAttente(); track u.id) {
          <article class="demande">
            <div class="qui">
              <strong>{{ u.prenom }} {{ u.nom }}</strong> — <span class="badge">{{ roleLabels[u.role] }}</span>
              <br /><small class="muted">{{ u.email }}{{ u.telephone ? ' · ' + u.telephone : '' }} · inscrit le {{ u.cree_le | date: 'dd/MM/yyyy à HH:mm' }}</small>
              <br /><small>🏢 {{ u.direction ?? '—' }} · {{ u.service ?? '—' }} · 📍 {{ u.site_nom ?? '—' }}</small>
              @if (!u.email_verifie) { <br /><small class="non-verifie">✉ Email pas encore vérifié</small> }
            </div>
            @if (u.role === 'IT') {
              <label class="groupe">Groupe
                <select [(ngModel)]="groupeDemande[u.id]">
                  @for (g of groupes(); track g.id) { <option [ngValue]="g.id">{{ g.nom }} ({{ g.zone_nom }})</option> }
                </select>
              </label>
            }
            @if (refusEnCours() === u.id) {
              <div class="refus">
                <input [(ngModel)]="motifRefus" placeholder="Motif du refus (envoyé par email)" />
                <button class="btn danger" [disabled]="!motifRefus.trim()" (click)="decider(u, 'REFUSE')">Confirmer le refus</button>
                <button class="btn" (click)="refusEnCours.set(null)">Annuler</button>
              </div>
            } @else {
              <div class="boutons">
                <button class="btn primary" [disabled]="!u.email_verifie" (click)="decider(u, 'APPROUVE')">✔ Approuver</button>
                <button class="btn" [disabled]="!u.email_verifie" (click)="refusEnCours.set(u.id); motifRefus = ''">✕ Refuser</button>
              </div>
            }
          </article>
        }
      </section>
    }

    @if (edition()) {
      <section class="card form-card">
        <h2>{{ editId ? 'Modifier le compte' : 'Nouveau compte' }}</h2>
        <div class="grid-2">
          <label>Nom <input [(ngModel)]="form.nom" /></label>
          <label>Prénom <input [(ngModel)]="form.prenom" /></label>
          <label>Email <input type="email" [(ngModel)]="form.email" [disabled]="!!editId" /></label>
          <label>Téléphone <input [(ngModel)]="form.telephone" /></label>
          <label>Profil
            <select [(ngModel)]="form.role">
              @for (r of roles; track r) { <option [value]="r">{{ roleLabels[r] }}</option> }
            </select>
          </label>
          @if (form.role === 'IT') {
            <label>Groupe d'intervenants
              <select [(ngModel)]="form.groupe_id">
                <option [ngValue]="null" disabled>Choisir…</option>
                @for (g of groupes(); track g.id) { <option [ngValue]="g.id">{{ g.nom }} ({{ g.zone_nom }})</option> }
              </select>
            </label>
          }
          <label>Zone
            <select [(ngModel)]="form.zone_id">
              <option [ngValue]="null">—</option>
              @for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.nom }}</option> }
            </select>
          </label>
          <label>Direction <input [(ngModel)]="form.direction" list="adm-directions" /></label>
          <label>Service <input [(ngModel)]="form.service" list="adm-services" /></label>
          <label>Site de travail
            <select [(ngModel)]="form.site_id">
              <option [ngValue]="null">—</option>
              @for (s of sites(); track s.id) { <option [ngValue]="s.id">{{ s.nom }} ({{ s.zone_nom }})</option> }
            </select>
          </label>
          <datalist id="adm-directions">@for (d of directions; track d) { <option [value]="d"></option> }</datalist>
          <datalist id="adm-services">@for (s of services; track s) { <option [value]="s"></option> }</datalist>
          @if (!editId) {
            <label>Mot de passe initial <input type="password" [(ngModel)]="form.mot_de_passe" /></label>
          }
        </div>
        <div class="actions">
          <button class="btn" (click)="edition.set(false)">Annuler</button>
          <button class="btn primary" (click)="enregistrer()">Enregistrer</button>
        </div>
      </section>
    }

    <div class="grid-users">
      <section class="card no-pad">
        <div class="table-head">
          <h2>Comptes</h2>
          <select [(ngModel)]="filtreRole" (change)="charger()">
            <option value="">Tous les profils</option>
            @for (r of roles; track r) { <option [value]="r">{{ roleLabels[r] }}</option> }
          </select>
        </div>
        <table class="table">
          <thead><tr><th>Nom</th><th>Email</th><th>Profil</th><th>Direction / service</th><th>Site</th><th>Groupe</th><th>Zone</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr [class.inactive]="!u.actif">
                <td>{{ u.prenom }} {{ u.nom }}</td>
                <td>{{ u.email }}</td>
                <td>{{ roleLabels[u.role] }}</td>
                <td class="petit">{{ u.direction ?? '—' }}<br /><span class="muted">{{ u.service ?? '' }}</span></td>
                <td class="petit">{{ u.site_nom ?? '—' }}</td>
                <td>{{ u.groupe_nom ?? '—' }}</td>
                <td>{{ u.zone_nom ?? '—' }}</td>
                <td>
                  @if (u.approbation === 'EN_ATTENTE') { <span class="badge b-attente">En attente</span> }
                  @else if (u.approbation === 'REFUSE') { <span class="badge b-refuse" [title]="u.motif_refus ?? ''">Refusé</span> }
                  @else if (!u.email_verifie) { <span class="badge b-attente">Email non vérifié</span> }
                  @else { {{ u.actif ? 'Actif' : 'Désactivé' }} }
                </td>
                <td class="row-actions">
                  <button class="btn-link" (click)="ouvrir(u)">Modifier</button>
                  @if (u.id !== auth.user()?.id) {
                    <button class="btn-link" (click)="basculer(u)">{{ u.actif ? 'Désactiver' : 'Réactiver' }}</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2>Groupes par zone</h2>
        <table class="table">
          <thead><tr><th>Groupe</th><th>Zone</th><th>IT</th></tr></thead>
          <tbody>
            @for (g of groupes(); track g.id) {
              <tr><td>{{ g.nom }}</td><td>{{ g.zone_nom }}</td><td>{{ g.nb_it }}</td></tr>
            }
          </tbody>
        </table>
        <h3>Nouveau groupe</h3>
        <div class="inline-form">
          <input placeholder="Nom du groupe" [(ngModel)]="nouveauGroupe.nom" />
          <select [(ngModel)]="nouveauGroupe.zone_id">
            <option [ngValue]="null" disabled>Zone…</option>
            @for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.nom }}</option> }
          </select>
          <button class="btn" [disabled]="!nouveauGroupe.nom || !nouveauGroupe.zone_id" (click)="creerGroupe()">Ajouter</button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .grid-users { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 18px; align-items: start; }
    .table-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 16px 0; }
    .row-actions { white-space: nowrap; display: flex; gap: 10px; }
    tr.inactive td { color: var(--muted); }
    .inline-form { display: flex; flex-direction: column; gap: 8px; }
    .form-card { margin-bottom: 18px; }
    .attente { margin-bottom: 18px; border-left: 4px solid #ffb300; }
    .demande { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--border); }
    .demande .qui { flex: 1; min-width: 240px; }
    .demande .groupe { margin: 0; min-width: 200px; }
    .demande .boutons, .demande .refus { display: flex; gap: 8px; flex-wrap: wrap; }
    .demande .refus input { min-width: 240px; }
    .non-verifie { color: #8a4b00; }
    td.petit { font-size: 13px; }
    .b-attente { background: #fff3e0; color: #e65100; }
    .b-refuse { background: #fdecea; color: #c62828; }
    @media (max-width: 1100px) { .grid-users { grid-template-columns: 1fr; } }
  `,
})
export class UsersPage {
  private api = inject(ApiService);
  auth = inject(AuthService);

  roles: Role[] = ['UTILISATEUR', 'IT', 'RESPONSABLE_IT'];
  roleLabels = ROLE_LABELS;

  users = signal<User[]>([]);
  groupes = signal<Groupe[]>([]);
  zones = signal<Zone[]>([]);
  erreur = signal('');
  edition = signal(false);
  succes = signal('');
  /** Comptes IT / Responsable IT inscrits, à valider */
  enAttente = signal<User[]>([]);
  sites = signal<Site[]>([]);
  directions = DIRECTIONS;
  services = SERVICES;
  groupeDemande: Record<number, number | null> = {};
  refusEnCours = signal<number | null>(null);
  motifRefus = '';

  filtreRole = '';
  editId: number | null = null;
  form = { ...VIDE };
  nouveauGroupe = { nom: '', zone_id: null as number | null };

  constructor() {
    this.api.zones().subscribe((z) => this.zones.set(z));
    this.api.sites().subscribe((s) => this.sites.set(s));
    this.chargerGroupes();
    this.charger();
  }

  private err = (e: unknown) => this.erreur.set(messageErreur(e));

  charger() {
    this.api.utilisateurs({ role: this.filtreRole }).subscribe({ next: (u) => this.users.set(u), error: this.err });
    this.api.utilisateurs({ approbation: 'EN_ATTENTE' }).subscribe({
      next: (u) => {
        this.enAttente.set(u);
        for (const x of u) if (!(x.id in this.groupeDemande)) this.groupeDemande[x.id] = x.groupe_id ?? null;
      },
      error: this.err,
    });
  }

  decider(u: User, decision: 'APPROUVE' | 'REFUSE') {
    this.erreur.set('');
    this.succes.set('');
    this.api.decisionCompte(u.id, decision, this.motifRefus.trim(), u.role === 'IT' ? this.groupeDemande[u.id] : null).subscribe({
      next: (r) => { this.succes.set('✔ ' + r.message); this.refusEnCours.set(null); this.charger(); this.chargerGroupes(); },
      error: this.err,
    });
  }

  chargerGroupes() {
    this.api.groupes().subscribe({ next: (g) => this.groupes.set(g), error: this.err });
  }

  ouvrir(u?: User) {
    this.erreur.set('');
    this.editId = u?.id ?? null;
    this.form = u
      ? { nom: u.nom, prenom: u.prenom, email: u.email, telephone: u.telephone ?? '', mot_de_passe: '',
          role: u.role, groupe_id: u.groupe_id ?? null, zone_id: u.zone_id ?? null,
          direction: u.direction ?? '', service: u.service ?? '', site_id: u.site_id ?? null }
      : { ...VIDE };
    this.edition.set(true);
  }

  enregistrer() {
    const req = this.editId
      ? this.api.modifierUtilisateur(this.editId, this.form)
      : this.api.creerUtilisateur(this.form);
    req.subscribe({
      next: () => { this.edition.set(false); this.charger(); this.chargerGroupes(); },
      error: this.err,
    });
  }

  basculer(u: User) {
    this.api.modifierUtilisateur(u.id, { actif: !u.actif }).subscribe({
      next: () => { this.charger(); this.chargerGroupes(); },
      error: this.err,
    });
  }

  creerGroupe() {
    this.api.creerGroupe(this.nouveauGroupe as { nom: string; zone_id: number }).subscribe({
      next: () => { this.nouveauGroupe = { nom: '', zone_id: null }; this.chargerGroupes(); },
      error: this.err,
    });
  }
}
