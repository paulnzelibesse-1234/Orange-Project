import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, GroupePublic, SitePublic } from '../core/auth.service';
import { DIRECTIONS, SERVICES } from '../core/labels';
import { AuthLayout } from '../layout/auth-layout';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { Role, Zone } from '../core/models';

interface Niveau { role: Role; titre: string; icone: string; description: string; validation: boolean; }

/** Les niveaux d'utilisation proposés à l'inscription */
const NIVEAUX: Niveau[] = [
  { role: 'UTILISATEUR', icone: '👤', titre: 'Utilisateur', validation: false,
    description: 'Signale des incidents et des demandes, suit ses tickets et valide les résolutions.' },
  { role: 'IT', icone: '🛠', titre: 'Technicien IT', validation: true,
    description: 'Prend en charge les tickets, réalise les interventions terrain et rédige les rapports.' },
  { role: 'RESPONSABLE_IT', icone: '🧭', titre: 'Responsable IT', validation: true,
    description: 'Supervise, affecte les interventions aux groupes, gère les comptes et les sites.' },
];

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, AuthLayout],
  styles: `
    .niveaux { display: grid; gap: 8px; margin: 4px 0 14px; border: 0; padding: 0; }
    .niveaux legend { font-weight: 600; margin-bottom: 6px; padding: 0; }
    .niveau { display: flex; flex-direction: row; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 2px solid var(--border); border-radius: 10px;
              cursor: pointer; font-weight: normal; margin: 0; transition: border-color .15s, background .15s; }
    .niveau:hover { border-color: #f5b98a; }
    .niveau.choisi { border-color: var(--orange); background: #fff7f0; }
    .niveau input { width: auto; margin: 4px 0 0; accent-color: var(--orange); }
    .niveau .icone { font-size: 22px; line-height: 1; }
    .niveau strong { display: block; }
    .niveau small { display: block; color: var(--muted); }
    .niveau .valid { display: inline-block; margin-top: 3px; font-size: 11.5px; font-weight: 600; color: #8a4b00; background: #fff3e0; padding: 1px 7px; border-radius: 8px; }
    .force { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; margin-top: 6px; }
    .force span { display: block; height: 100%; transition: width .2s, background .2s; }
    .regles { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; margin-top: 4px; color: var(--muted); }
    .regles .ok { color: #2e7d32; }
    .champ-mdp { position: relative; display: block; }
    .champ-mdp input { width: 100%; padding-right: 78px; box-sizing: border-box; }
    .force { display: block; }
    .voir { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: 0; cursor: pointer; font-size: 13px; color: var(--muted); }
    .rubrique { font-size: 14px; margin: 6px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border); color: var(--muted); text-transform: uppercase; letter-spacing: .4px; }
    .aide-zone { display: block; margin: -6px 0 12px; }
    .manquants { background: var(--bg-soft); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; margin: 4px 0 10px; font-size: 13px; color: var(--muted); }
    .manquants ul { margin: 4px 0 0; padding-left: 18px; columns: 2; column-gap: 16px; }
    .manquants.alerte { background: #fdecea; border-color: #f5c2c0; color: var(--danger); }
    .btn.incomplet { opacity: .75; }
    @media (max-width: 480px) { .manquants ul { columns: 1; } }
    .fin { text-align: center; }
    .fin .grand { font-size: 46px; }
    .info { background: #e3f2fd; color: #0d47a1; border-radius: 6px; padding: 8px 12px; font-size: 13px; margin: 0 0 14px; }
  `,
  template: `
    <app-auth-layout>
      @if (enAttente()) {
        <div class="auth-form fin">
          <div class="grand" aria-hidden="true">⏳</div>
          <div class="auth-head"><h1>Compte créé</h1></div>
          <div class="alert success">{{ enAttente() }}</div>
          <a class="btn primary full" routerLink="/login">Retour à la connexion</a>
        </div>
      } @else {
      <form class="auth-form" (ngSubmit)="submit()" #frm="ngForm">
        <div class="auth-head">
          <h1>Créer un compte</h1>
          <p class="muted">{{ otp() ? 'Un code de vérification vous sera envoyé par email.' : 'Renseignez vos informations pour créer votre compte.' }}</p>
        </div>

        @if (erreur()) { <div class="alert error" role="alert">{{ erreur() }}</div> }

        <fieldset class="niveaux" role="radiogroup">
          <legend>Niveau d'utilisation *</legend>
          @for (n of niveaux; track n.role) {
            <label class="niveau" [class.choisi]="form.role === n.role">
              <input type="radio" name="role" [value]="n.role" [(ngModel)]="form.role" required />
              <span class="icone" aria-hidden="true">{{ n.icone }}</span>
              <span>
                <strong>{{ n.titre }}</strong>
                <small>{{ n.description }}</small>
                @if (n.validation) { <span class="valid">Validé par un Responsable IT</span> }
              </span>
            </label>
          }
        </fieldset>

        <div class="grid-2">
          <label>Nom * <input name="nom" [(ngModel)]="form.nom" required autocomplete="family-name" /></label>
          <label>Prénom * <input name="prenom" [(ngModel)]="form.prenom" required autocomplete="given-name" /></label>
        </div>
        <label>Email * <input type="email" name="email" [(ngModel)]="form.email" required email autocomplete="email" placeholder="prenom.nom@orange.ci" /></label>
        <label>Téléphone <input name="tel" [(ngModel)]="form.telephone" autocomplete="tel" placeholder="+225 07 00 00 00 00" /></label>

        <h2 class="rubrique">Affectation</h2>
        <div class="grid-2">
          <label>Direction *
            <input name="direction" [(ngModel)]="form.direction" required list="liste-directions" maxlength="120"
                   placeholder="Choisir ou saisir…" autocomplete="organization" />
          </label>
          <label>Service *
            <input name="service" [(ngModel)]="form.service" required list="liste-services" maxlength="120" placeholder="Choisir ou saisir…" />
          </label>
        </div>
        <datalist id="liste-directions">@for (d of directions; track d) { <option [value]="d"></option> }</datalist>
        <datalist id="liste-services">@for (s of services; track s) { <option [value]="s"></option> }</datalist>
        <div class="grid-2">
          <label>Zone *
            <select name="zone" [ngModel]="form.zone_id" (ngModelChange)="form.zone_id = $event; form.site_id = null" required>
              <option [ngValue]="null" disabled>Choisir…</option>
              @for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.nom }}</option> }
            </select>
          </label>
          <label>Site de travail *
            <select name="site" [(ngModel)]="form.site_id" required [disabled]="!form.zone_id">
              <option [ngValue]="null" disabled>{{ form.zone_id ? 'Choisir votre site…' : "Choisir d'abord la zone" }}</option>
              @for (c of sitesParCommune(); track c.commune) {
                <optgroup [label]="c.commune">
                  @for (s of c.sites; track s.id) { <option [ngValue]="s.id">{{ s.nom }}</option> }
                </optgroup>
              }
            </select>
          </label>
        </div>
        @if (zoneChoisie(); as z) { <small class="muted aide-zone">{{ z.nom }} : {{ z.description }}</small> }
        @if (form.role === 'IT') {
          <label>Groupe de techniciens *
            <select name="groupe" [(ngModel)]="form.groupe_id" required>
              <option [ngValue]="null" disabled>Choisir votre groupe…</option>
              @for (g of groupes(); track g.id) { <option [ngValue]="g.id">{{ g.nom }} — zone {{ g.zone_nom }}</option> }
            </select>
          </label>
        }
        @if (niveauChoisi()?.validation) {
          <p class="info">ℹ {{ otp() ? 'Après la vérification de votre email, votre' : 'Votre' }} compte « {{ niveauChoisi()?.titre }} » sera activé par un Responsable IT.</p>
        }

        <label>Mot de passe *
          <span class="champ-mdp">
            <input [type]="voir() ? 'text' : 'password'" name="mdp" [(ngModel)]="form.mot_de_passe" required minlength="8" autocomplete="new-password" />
            <button type="button" class="voir" (click)="voir.set(!voir())" [attr.aria-label]="voir() ? 'Masquer' : 'Afficher'">{{ voir() ? 'Masquer' : 'Afficher' }}</button>
          </span>
          <span class="force" aria-hidden="true"><span [style.width.%]="force().pct" [style.background]="force().couleur"></span></span>
          <span class="regles">
            <span [class.ok]="form.mot_de_passe.length >= 8">{{ form.mot_de_passe.length >= 8 ? '✔' : '•' }} 8 caractères</span>
            <span [class.ok]="aLettre()">{{ aLettre() ? '✔' : '•' }} une lettre</span>
            <span [class.ok]="aChiffre()">{{ aChiffre() ? '✔' : '•' }} un chiffre</span>
          </span>
        </label>
        <label>Confirmer le mot de passe *
          <input [type]="voir() ? 'text' : 'password'" name="mdp2" [(ngModel)]="confirmation" required autocomplete="new-password" />
          @if (confirmation && confirmation !== form.mot_de_passe) { <small style="color: var(--danger)">Les mots de passe ne correspondent pas</small> }
        </label>

        <!-- Ce qu'il reste à remplir (le bouton reste cliquable et l'indique aussi) -->
        @if (manquants().length) {
          <div class="manquants" [class.alerte]="essai()" role="status">
            <strong>Il reste à compléter :</strong>
            <ul>@for (m of manquants(); track m) { <li>{{ m }}</li> }</ul>
          </div>
        }
        <button class="btn primary full" [class.incomplet]="manquants().length" [disabled]="loading()">
          {{ loading() ? 'Envoi du code…' : 'Créer mon compte' }}
        </button>
        <p class="muted center">Déjà inscrit ? <a routerLink="/login">Se connecter</a></p>
      </form>
      }
    </app-auth-layout>
  `,
})
export class RegisterPage {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private router = inject(Router);

  niveaux = NIVEAUX;
  zones = signal<Zone[]>([]);
  groupes = signal<GroupePublic[]>([]);
  loading = signal(false);
  erreur = signal('');
  voir = signal(false);
  confirmation = '';
  form = {
    role: 'UTILISATEUR' as Role, nom: '', prenom: '', email: '', telephone: '',
    zone_id: null as number | null, groupe_id: null as number | null, mot_de_passe: '',
    direction: '', service: '', site_id: null as number | null,
  };
  directions = DIRECTIONS;
  services = SERVICES;
  sites = signal<SitePublic[]>([]);
  /** Sites de la zone choisie, regroupés par commune (ex. Abobo : agence, franchise, site technique) */
  sitesParCommune() {
    const parCommune = new Map<string, SitePublic[]>();
    for (const s of this.sites().filter((x) => x.zone_id === this.form.zone_id)) {
      const c = s.commune ?? 'Autres';
      parCommune.set(c, [...(parCommune.get(c) ?? []), s]);
    }
    return [...parCommune.entries()].map(([commune, sites]) => ({ commune, sites }));
  }

  niveauChoisi() { return NIVEAUX.find((n) => n.role === this.form.role) ?? null; }
  zoneChoisie() { return this.zones().find((z) => z.id === this.form.zone_id) ?? null; }
  aLettre() { return /[A-Za-z]/.test(this.form.mot_de_passe); }
  aChiffre() { return /\d/.test(this.form.mot_de_passe); }
  /** Indicateur de robustesse du mot de passe */
  force() {
    const m = this.form.mot_de_passe;
    let n = 0;
    if (m.length >= 8) n++;
    if (m.length >= 12) n++;
    if (/[a-z]/.test(m) && /[A-Z]/.test(m)) n++;
    if (/\d/.test(m)) n++;
    if (/[^A-Za-z0-9]/.test(m)) n++;
    const couleurs = ['#e53935', '#e53935', '#fb8c00', '#fdd835', '#7cb342', '#2e7d32'];
    return { pct: m ? Math.max(10, n * 20) : 0, couleur: couleurs[n] };
  }
  /** Clic sur « Créer mon compte » alors qu'il manque des informations : la liste passe en alerte */
  essai = signal(false);
  /** Vérification de l'email par code activée côté API */
  otp = signal(false);
  /** Compte IT / Responsable IT créé : en attente de validation */
  enAttente = signal('');
  /** Informations manquantes ou invalides, dans l'ordre du formulaire */
  manquants() {
    const f = this.form;
    const m: string[] = [];
    if (!f.nom.trim()) m.push('Nom');
    if (!f.prenom.trim()) m.push('Prénom');
    if (!f.email.trim()) m.push('Email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) m.push('Email valide (ex. prenom.nom@orange.ci)');
    if (!f.direction.trim()) m.push('Direction');
    if (!f.service.trim()) m.push('Service');
    if (!f.zone_id) m.push('Zone');
    if (!f.site_id) m.push(this.sites().length ? 'Site de travail' : 'Site de travail (liste non chargée : vérifiez que l’API est démarrée)');
    if (f.role === 'IT' && !f.groupe_id) m.push('Groupe de techniciens');
    if (f.mot_de_passe.length < 8) m.push('Mot de passe : au moins 8 caractères');
    if (f.mot_de_passe && !this.aLettre()) m.push('Mot de passe : au moins une lettre');
    if (f.mot_de_passe && !this.aChiffre()) m.push('Mot de passe : au moins un chiffre');
    if (!this.confirmation) m.push('Confirmation du mot de passe');
    else if (this.confirmation !== f.mot_de_passe) m.push('Confirmation : les deux mots de passe doivent être identiques');
    return m;
  }
  valide() {
    return this.manquants().length === 0;
  }

  constructor() {
    this.api.zones().subscribe({ next: (z) => this.zones.set(z), error: (e) => this.erreur.set(messageErreur(e)) });
    this.auth.groupesPublics().subscribe({ next: (g) => this.groupes.set(g) });
    this.auth.sitesPublics().subscribe({ next: (s) => this.sites.set(s) });
    this.auth.configInscription().subscribe({ next: (c) => this.otp.set(c.otp_inscription) });
  }

  submit() {
    if (!this.valide()) {
      this.essai.set(true);
      return;
    }
    this.loading.set(true);
    this.erreur.set('');
    const f = this.form;
    this.auth.register({
      ...f, email: f.email.trim(), direction: f.direction.trim(), service: f.service.trim(),
      groupe_id: f.role === 'IT' ? f.groupe_id : null,
    }).subscribe({
      next: (r) => {
        this.loading.set(false);
        if (r.token) this.router.navigate(['/tableau-de-bord']);          // Utilisateur : connecté directement
        else if (r.en_attente) this.enAttente.set(r.message);              // IT / Responsable IT : à valider
        else this.router.navigate(['/verification'], {                     // vérification par code activée
          queryParams: { email: r.email, attendre: r.attendre, dev: r.mode_dev ? 1 : null, validation: r.approbation_requise ? 1 : null },
        });
      },
      error: (e) => {
        this.erreur.set(messageErreur(e));
        this.loading.set(false);
      },
    });
  }
}
