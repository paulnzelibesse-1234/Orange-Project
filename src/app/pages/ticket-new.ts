import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { messageErreur } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { Site, TypeTicket, Zone } from '../core/models';
import { TYPE_LABELS, TYPES_TICKET, suggererType } from '../core/labels';

const FORMATS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TAILLE_MAX = 5 * 1024 * 1024; // 5 Mo

@Component({
  selector: 'app-ticket-new',
  imports: [FormsModule, RouterLink],
  styles: `
    .depot {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      border: 2px dashed var(--border); border-radius: 8px; padding: 22px 16px; margin: 6px 0 14px;
      background: var(--bg-soft); text-align: center; cursor: pointer; transition: border-color .15s, background .15s;
    }
    .depot:hover, .depot.survol { border-color: var(--orange); background: #fff7f0; }
    .depot input { display: none; }
    .depot strong { color: var(--orange-dark); }
    .apercu { position: relative; margin: 6px 0 14px; border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: var(--bg-soft); }
    .apercu img { display: block; max-width: 100%; max-height: 320px; margin: 0 auto; border-radius: 4px; }
    .types { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 6px 0 16px; }
    .type {
      display: block; position: relative; border: 2px solid var(--border); border-radius: 10px; padding: 14px 14px 10px;
      background: var(--bg-soft); cursor: pointer; transition: border-color .15s, background .15s; font-weight: normal;
    }
    .type:hover { border-color: #f5b98a; }
    .type.choisi { border-color: var(--orange); background: #fff7f0; box-shadow: 0 0 0 3px rgba(255, 121, 0, .12); }
    .type input { position: absolute; top: 14px; right: 14px; width: auto; margin: 0; accent-color: var(--orange); }
    .type .nom { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .type p { margin: 0 0 6px; font-size: 13px; }
    .type ul { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--muted); }
    .type li { margin: 1px 0; }
    @media (max-width: 720px) { .types { grid-template-columns: 1fr; } }
    .regle { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; }
    .regle span { font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: #fff; border: 1px solid var(--border); }
    .suggestion {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
      margin: -4px 0 14px; padding: 8px 12px; border-radius: 8px; background: #fff8e1; border: 1px solid #ffe082; font-size: 13.5px;
    }
    .apercu .infos { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 8px; font-size: 13px; }
  `,
  template: `
    <header class="page-head">
      <div>
        <h1>Signaler un problème</h1>
        <p class="muted">Le ticket sera transmis à l'ensemble des techniciens IT et Responsables IT pour prise en charge.</p>
      </div>
    </header>

    <form class="card form-card" (ngSubmit)="submit()" #frm="ngForm">
      @if (erreur()) { <div class="alert error">{{ erreur() }}</div> }

      <div id="type-label">Type de problème *</div>
      <div class="types" role="radiogroup" aria-labelledby="type-label">
        @for (ty of types; track ty.code) {
          <label class="type" [class.choisi]="form.type === ty.code">
            <input type="radio" name="type" [value]="ty.code" [(ngModel)]="form.type" required />
            <div class="nom">{{ ty.code === 'INCIDENT' ? '⚠' : '📝' }} {{ ty.titre }}</div>
            <p>{{ ty.definition }}</p>
            <div class="regle">@for (r of ty.regle; track r) { <span>{{ r }}</span> }</div>
            <ul>@for (e of ty.exemples; track e) { <li>{{ e }}</li> }</ul>
          </label>
        }
      </div>

      <label>Titre *
        <input name="titre" [(ngModel)]="form.titre" required maxlength="200" placeholder="Ex : Pas de connexion internet au bureau 204" />
      </label>
      <label>Description détaillée *
        <textarea name="desc" rows="5" [(ngModel)]="form.description" required
          placeholder="Décrivez le problème, depuis quand, les messages d'erreur…"></textarea>
      </label>

      <!-- Suggestion : installation, configuration, paramétrage, mise à jour = demande -->
      @if (suggestion(); as s) {
        @if (s.type !== form.type) {
          <div class="suggestion" role="status">
            <span>💡 Votre texte évoque « {{ s.indice }} » : il s'agit plutôt
              <strong>{{ s.type === 'DEMANDE' ? 'd’une demande' : 'd’un incident' }}</strong>.</span>
            <button type="button" class="btn small" (click)="form.type = s.type">Choisir « {{ typeLabels[s.type] }} »</button>
          </div>
        }
      }

      <div class="grid-2">
        <label>Zone *
          <select name="zone" [ngModel]="zoneId()" (ngModelChange)="choisirZone($event)" required>
            <option [ngValue]="null" disabled>Choisir la zone…</option>
            @for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.nom }}</option> }
          </select>
          @if (zoneChoisie(); as z) { <small class="muted">{{ z.description }}</small> }
        </label>
        <label>Site *
          <select name="site" [ngModel]="form.site_id" (ngModelChange)="choisirSite($event)" required [disabled]="!zoneId()">
            <option [ngValue]="null" disabled>{{ zoneId() ? 'Choisir le site…' : "Choisir d'abord la zone" }}</option>
            <!-- Sites de la zone, regroupés par commune (ex. Abobo : agence, franchise, site technique) -->
            @for (c of sitesParCommune(); track c.commune) {
              <optgroup [label]="c.commune">
                @for (s of c.sites; track s.id) { <option [ngValue]="s.id">{{ s.nom }}</option> }
              </optgroup>
            }
          </select>
        </label>
      </div>
      <div class="grid-2">
        <label>Bâtiment *
          <select name="batiment" [ngModel]="form.batiment_id" (ngModelChange)="choisirBatiment($event)"
                  required [disabled]="!form.site_id">
            <option [ngValue]="null" disabled>{{ form.site_id ? 'Choisir un bâtiment…' : "Choisir d'abord le site" }}</option>
            @for (b of batiments(); track b.id) { <option [ngValue]="b.id">{{ b.nom }}</option> }
          </select>
        </label>
        <label>Bureau *
          <select name="bureau" [(ngModel)]="form.bureau_id" required [disabled]="!form.batiment_id">
            <option [ngValue]="null" disabled>{{ form.batiment_id ? 'Choisir un bureau…' : "Choisir d'abord le bâtiment" }}</option>
            @for (x of bureaux(); track x.id) { <option [ngValue]="x.id">{{ x.nom }}</option> }
          </select>
        </label>
      </div>

      <div>Capture d'écran / image (facultatif)</div>
      @if (apercu()) {
        <div class="apercu">
          <img [src]="apercu()" alt="Aperçu de l'image jointe" />
          <div class="infos">
            <span class="muted">{{ fichier()?.name }} · {{ taille() }}</span>
            <button type="button" class="btn danger" (click)="retirer()">Retirer</button>
          </div>
        </div>
      } @else {
        <label class="depot" [class.survol]="survol()"
               (dragover)="$event.preventDefault(); survol.set(true)"
               (dragleave)="survol.set(false)"
               (drop)="deposer($event)">
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" (change)="choisir($event)" />
          <span><strong>Cliquez pour choisir une image</strong> ou glissez-la ici</span>
          <span class="muted">Vous pouvez aussi coller une capture d'écran avec Ctrl+V · PNG, JPG, GIF, WEBP · 5 Mo max</span>
        </label>
      }

      <div class="actions">
        <a class="btn" [routerLink]="retour">Annuler</a>
        <button class="btn primary" [disabled]="frm.invalid || loading()">
          {{ loading() ? 'Envoi…' : 'Signaler le problème' }}
        </button>
      </div>
    </form>
  `,
})
export class TicketNewPage implements OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private auth = inject(AuthService);
  /** Les IT n'ont pas « Mes signalements » : retour à la liste GLPI */
  retour = this.auth.hasRole('IT') ? '/glpi' : '/mes-signalements';

  loading = signal(false);
  erreur = signal('');
  survol = signal(false);
  fichier = signal<File | null>(null);
  apercu = signal<string | null>(null);

  types = TYPES_TICKET;
  typeLabels = TYPE_LABELS;
  /** Type suggéré d'après le titre et la description (recalculé à la saisie) */
  suggestion() { return suggererType(`${this.form.titre} ${this.form.description}`); }
  form = {
    type: null as TypeTicket | null,
    titre: '',
    description: '',
    site_id: null as number | null,
    batiment_id: null as number | null,
    bureau_id: null as number | null,
  };

  // Listes en cascade : site → bâtiments du site → bureaux du bâtiment
  sites = signal<Site[]>([]);
  siteId = signal<number | null>(null);
  batimentId = signal<number | null>(null);
  // Zone → site (regroupés par commune) → bâtiment → bureau
  zones = signal<Zone[]>([]);
  zoneId = signal<number | null>(null);
  zoneChoisie = computed(() => this.zones().find((z) => z.id === this.zoneId()) ?? null);
  sitesParCommune = computed(() => {
    const parCommune = new Map<string, Site[]>();
    for (const s of this.sites().filter((x) => x.zone_id === this.zoneId())) {
      const c = s.commune ?? 'Autres';
      parCommune.set(c, [...(parCommune.get(c) ?? []), s]);
    }
    return [...parCommune.entries()].map(([commune, sites]) => ({ commune, sites }));
  });

  choisirZone(id: number | null) {
    this.zoneId.set(id);
    this.choisirSite(null);
  }
  batiments = computed(() => this.sites().find((s) => s.id === this.siteId())?.batiments ?? []);
  bureaux = computed(() => this.batiments().find((b) => b.id === this.batimentId())?.bureaux ?? []);

  constructor() {
    this.api.zones().subscribe((z) => this.zones.set(z));
    this.api.sites().subscribe({
      next: (s) => {
        this.sites.set(s);
        // Le site de travail de l'utilisateur est présélectionné (modifiable)
        const monSite = s.find((x) => x.id === this.auth.user()?.site_id);
        if (monSite && !this.form.site_id) {
          this.zoneId.set(monSite.zone_id);
          this.choisirSite(monSite.id);
        }
      },
      error: (e) => this.erreur.set(messageErreur(e)),
    });
  }

  choisirSite(id: number | null) {
    this.form.site_id = id;
    this.siteId.set(id);
    this.choisirBatiment(null);
    // Un seul bâtiment sur le site : on le présélectionne
    if (this.batiments().length === 1) this.choisirBatiment(this.batiments()[0].id);
  }

  choisirBatiment(id: number | null) {
    this.form.batiment_id = id;
    this.batimentId.set(id);
    this.form.bureau_id = null;
  }

  taille() {
    const f = this.fichier();
    if (!f) return '';
    return f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} Ko` : `${(f.size / 1024 / 1024).toFixed(1)} Mo`;
  }

  choisir(e: Event) {
    const input = e.target as HTMLInputElement;
    this.definir(input.files?.[0]);
    input.value = '';
  }

  deposer(e: DragEvent) {
    e.preventDefault();
    this.survol.set(false);
    this.definir(e.dataTransfer?.files?.[0]);
  }

  // Ctrl+V d'une capture d'écran n'importe où sur la page
  @HostListener('document:paste', ['$event'])
  coller(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
    const f = item?.getAsFile();
    if (!f) return;
    e.preventDefault();
    const ext = f.type.split('/')[1] === 'jpeg' ? 'jpg' : f.type.split('/')[1];
    this.definir(new File([f], `capture-${Date.now()}.${ext}`, { type: f.type }));
  }

  private definir(f: File | undefined | null) {
    if (!f) return;
    if (!FORMATS.includes(f.type)) return this.erreur.set('Formats acceptés : PNG, JPG, GIF, WEBP');
    if (f.size > TAILLE_MAX) return this.erreur.set("L'image ne doit pas dépasser 5 Mo");
    this.erreur.set('');
    this.retirer();
    this.fichier.set(f);
    this.apercu.set(URL.createObjectURL(f));
  }

  retirer() {
    const url = this.apercu();
    if (url) URL.revokeObjectURL(url);
    this.apercu.set(null);
    this.fichier.set(null);
  }

  ngOnDestroy() {
    this.retirer();
  }

  submit() {
    this.loading.set(true);
    this.erreur.set('');
    const data = new FormData();
    data.append('type', this.form.type ?? '');
    data.append('titre', this.form.titre);
    data.append('description', this.form.description);
    data.append('site_id', String(this.form.site_id));
    data.append('batiment_id', String(this.form.batiment_id));
    data.append('bureau_id', String(this.form.bureau_id));
    const f = this.fichier();
    if (f) data.append('capture', f, f.name);

    this.api.creerTicket(data).subscribe({
      next: (r) => this.router.navigate(['/glpi', r.id], this.auth.hasRole('IT') ? {} : { queryParams: { depuis: 'mes-signalements' } }),
      error: (e) => { this.erreur.set(messageErreur(e)); this.loading.set(false); },
    });
  }
}
