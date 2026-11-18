import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_URL } from './labels';
import { Role, User } from './models';

const TOKEN_KEY = 'oci_token';
const USER_KEY = 'oci_user';

function lire<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

/** Réponse de l'inscription : un code OTP a été envoyé par email */
export interface ReponseInscription {
  message: string;
  token?: string;            // inscription sans code : connecté directement (Utilisateur)
  user?: User;
  en_attente?: boolean;      // inscription sans code : compte IT / Responsable IT à valider
  email: string;
  attendre: number;          // secondes avant de pouvoir redemander un code
  mode_dev: boolean;         // SMTP non configuré : l'email est affiché dans la console de l'API
  approbation_requise: boolean;
}
/** Réponse de la vérification du code : connecté (token) ou compte en attente de validation */
export interface ReponseVerification {
  message: string;
  token?: string;
  user?: User;
  en_attente?: boolean;
}
export interface GroupePublic { id: number; nom: string; zone_id: number; zone_nom: string; }
export interface SitePublic { id: number; nom: string; commune: string | null; zone_id: number; zone_nom: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<User | null>(lire<User>(USER_KEY));
  readonly token = signal<string | null>(lire<string>(TOKEN_KEY));
  readonly isLoggedIn = computed(() => !!this.token());
  readonly role = computed(() => this.user()?.role ?? null);

  private ouvrirSession(token: string, user: User) {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.token.set(token);
    this.user.set(user);
  }

  login(email: string, mot_de_passe: string): Observable<{ token: string; user: User }> {
    return this.http.post<{ token: string; user: User }>(`${API_URL}/auth/login`, { email, mot_de_passe }).pipe(
      tap(({ token, user }) => this.ouvrirSession(token, user))
    );
  }

  register(data: Record<string, unknown>) {
    return this.http.post<ReponseInscription>(`${API_URL}/auth/register`, data).pipe(
      tap((r) => { if (r.token && r.user) this.ouvrirSession(r.token, r.user); })
    );
  }

  /** Options de l'inscription (vérification de l'email par code activée ou non) */
  configInscription() {
    return this.http.get<{ otp_inscription: boolean }>(`${API_URL}/auth/config`);
  }

  /** Vérifie le code OTP ; ouvre la session si le compte est actif */
  verifierOtp(email: string, code: string) {
    return this.http.post<ReponseVerification>(`${API_URL}/auth/otp/verifier`, { email, code }).pipe(
      tap((r) => { if (r.token && r.user) this.ouvrirSession(r.token, r.user); })
    );
  }

  renvoyerOtp(email: string) {
    return this.http.post<{ message: string; attendre: number }>(`${API_URL}/auth/otp/renvoyer`, { email });
  }

  /** Groupes de techniciens (inscription d'un IT, sans être connecté) */
  groupesPublics() {
    return this.http.get<GroupePublic[]>(`${API_URL}/auth/groupes`);
  }

  /** Sites (choix du site de travail à l'inscription, sans être connecté) */
  sitesPublics() {
    return this.http.get<SitePublic[]>(`${API_URL}/auth/sites`);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  hasRole(...roles: Role[]) {
    const r = this.role();
    return !!r && roles.includes(r);
  }
}
