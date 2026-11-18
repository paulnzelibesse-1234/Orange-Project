import { Component, DestroyRef, inject, signal } from '@angular/core';

interface Slide {
  image: string;
  titre: string;
  texte: string;
}

/**
 * Mise en page des écrans de connexion / inscription :
 * formulaire à gauche, diaporama d'images à droite.
 * Usage : <app-auth-layout> ...formulaire... </app-auth-layout>
 */
@Component({
  selector: 'app-auth-layout',
  template: `
    <div class="auth-split">
      <!-- Côté formulaire -->
      <section class="form-side">
        <header class="form-brand">
          <img src="images/logo-orange.jpg" alt="Orange" class="brand-logo" />
          <div>
            <strong>Orange Côte d'Ivoire</strong>
            <small>Gestion des interventions de dépannage</small>
          </div>
        </header>

        <div class="form-wrap">
          <ng-content />
        </div>

        <footer class="form-foot">
          <img src="images/logo-orange.jpg" alt="" class="foot-logo" />
          <span>© {{ annee }} Orange Côte d'Ivoire — Direction des Systèmes d'Information</span>
        </footer>
      </section>

      <!-- Côté diaporama -->
      <section class="slider-side" aria-label="Présentation">
        @for (s of slides; track s.image; let i = $index) {
          <div class="slide" [class.active]="i === courant()" [attr.aria-hidden]="i !== courant()">
            <img [src]="s.image" alt="" />
          </div>
        }
        <div class="overlay"></div>

        <img src="images/logo-orange.jpg" alt="Orange" class="slider-logo" />

        <div class="caption">
          @for (s of slides; track s.image; let i = $index) {
            @if (i === courant()) {
              <div class="caption-text">
                <span class="step">Étape {{ i + 1 }} / {{ slides.length }}</span>
                <h2>{{ s.titre }}</h2>
                <p>{{ s.texte }}</p>
              </div>
            }
          }
          <div class="dots">
            @for (s of slides; track s.image; let i = $index) {
              <button type="button" [class.active]="i === courant()" (click)="aller(i)"
                      [attr.aria-label]="'Diapositive ' + (i + 1)"></button>
            }
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    :host { display: block; }
    .auth-split { display: grid; grid-template-columns: minmax(380px, 1fr) 1.3fr; min-height: 100vh; }

    /* ---- Formulaire ---- */
    .form-side { display: flex; flex-direction: column; background: #fff; padding: 28px 48px; border-top: 6px solid var(--orange); }
    .form-brand { display: flex; align-items: center; gap: 12px; }
    .form-brand small { display: block; color: var(--muted); font-size: 12px; }
    .brand-logo { width: 52px; height: 52px; object-fit: cover; }
    .form-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 32px 0; }
    .form-wrap > * { width: 100%; max-width: 420px; }
    .form-foot { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
    .foot-logo { width: 22px; height: 22px; object-fit: cover; }

    /* ---- Diaporama ---- */
    .slider-side { position: relative; overflow: hidden; background: #111; }
    .slide { position: absolute; inset: 0; opacity: 0; transition: opacity 1.2s ease; }
    .slide.active { opacity: 1; }
    .slide img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.08); }
    .slide.active img { animation: zoom 7s ease-out forwards; }
    @keyframes zoom { from { transform: scale(1.08); } to { transform: scale(1); } }
    .overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.15) 45%, rgba(0,0,0,.8) 100%); }
    .slider-logo { position: absolute; top: 28px; right: 28px; width: 76px; height: 76px; object-fit: cover; box-shadow: 0 6px 20px rgba(0,0,0,.35); }

    .caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 48px; color: #fff; }
    .caption-text { animation: monte .8s ease both; border-left: 5px solid var(--orange); padding-left: 18px; }
    @keyframes monte { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
    .step { color: var(--orange); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .caption h2 { font-size: 30px; margin: 6px 0 8px; }
    .caption p { margin: 0; max-width: 520px; font-size: 15px; line-height: 1.5; color: #eee; }
    .dots { display: flex; gap: 8px; margin-top: 24px; }
    .dots button { width: 28px; height: 5px; border: 0; border-radius: 3px; background: rgba(255,255,255,.4); cursor: pointer; padding: 0; transition: all .3s; }
    .dots button.active { background: var(--orange); width: 48px; }

    @media (prefers-reduced-motion: reduce) {
      .slide, .dots button { transition: none; }
      .slide.active img, .caption-text { animation: none; transform: none; }
    }

    /* ---- Responsive : diaporama réduit en bandeau au-dessus ---- */
    @media (max-width: 900px) {
      .auth-split { grid-template-columns: 1fr; }
      .slider-side { order: -1; height: 240px; }
      .caption { padding: 20px 16px; }
      .caption h2 { font-size: 20px; }
      .caption p { display: none; }
      .slider-logo { width: 48px; height: 48px; top: 16px; right: 16px; }
      .form-side { padding: 20px 16px; }
    }
  `,
})
export class AuthLayout {
  readonly annee = new Date().getFullYear();
  readonly slides: Slide[] = [
    {
      image: 'images/slide-support.jpg',
      titre: 'Signalez vos problèmes',
      texte: 'Un souci matériel, réseau ou logiciel ? Créez un ticket en quelques secondes depuis la section GLPI.',
    },
    {
      image: 'images/slide-ticket.jpg',
      titre: 'Attribution et planification',
      texte: 'Le Responsable IT attribue chaque ticket au bon groupe d\'intervenants selon la zone : Nord, Sud ou Intérieur.',
    },
    {
      image: 'images/slide-reseau.jpg',
      titre: 'Intervention sur le terrain',
      texte: 'Les techniciens IT interviennent, diagnostiquent et rédigent leur rapport d\'intervention.',
    },
    {
      image: 'images/slide-suivi.jpg',
      titre: 'Suivi et traçabilité',
      texte: 'Chaque action est historisée, le délai de traitement de 8 h est suivi et le Responsable IT pilote les performances.',
    },
  ];

  courant = signal(0);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.demarrer();
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  aller(i: number) {
    this.courant.set(i);
    this.demarrer(); // relance le minuteur après un clic
  }

  private demarrer() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this.courant.update((c) => (c + 1) % this.slides.length), 6000);
  }
}
