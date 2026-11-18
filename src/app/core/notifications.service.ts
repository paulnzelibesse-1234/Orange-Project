import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_URL } from './labels';

export interface Notification {
  id: number;
  ticket_id: number | null;
  reference: string | null;
  type: 'TERRAIN' | string;
  message: string;
  lu: number;
  cree_le: string;
}

const INTERVALLE_MS = 20_000; // rafraîchissement des notifications

/** Notifications in-app de l'utilisateur connecté (rafraîchies périodiquement) */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private timer: ReturnType<typeof setInterval> | undefined;

  liste = signal<Notification[]>([]);
  nonLues = signal(0);
  /** Vrai dès que les notifications ont été chargées une première fois */
  pret = signal(false);
  /** Tickets ayant une notification « action terrain » non lue */
  ticketsTerrainNonLus = computed(
    () => new Set(this.liste().filter((n) => !n.lu && n.type === 'TERRAIN' && n.ticket_id).map((n) => n.ticket_id!))
  );

  demarrer() {
    this.arreter();
    this.charger();
    this.timer = setInterval(() => this.charger(), INTERVALLE_MS);
  }

  arreter() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  charger() {
    this.http.get<{ nonLues: number; notifications: Notification[] }>(`${API_URL}/notifications`).subscribe({
      next: (r) => { this.liste.set(r.notifications); this.nonLues.set(r.nonLues); this.pret.set(true); },
      error: () => {}, // silencieux : nouvelle tentative au prochain rafraîchissement
    });
  }

  toutMarquerLu() {
    this.http.put(`${API_URL}/notifications/lu`, {}).subscribe(() => this.charger());
  }

  /** À l'ouverture d'un ticket : ses notifications deviennent lues */
  marquerTicketLu(ticketId: number) {
    if (!this.liste().some((n) => n.ticket_id === ticketId && !n.lu)) return;
    this.http.put(`${API_URL}/notifications/ticket/${ticketId}/lu`, {}).subscribe(() => this.charger());
  }
}
