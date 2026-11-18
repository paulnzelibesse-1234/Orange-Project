import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './labels';
import { Groupe, InterventionTerrain, MotifAttente, Site, Ticket, TicketDetail, User, Zone } from './models';

function params(filtres: Record<string, unknown>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(filtres)) {
    if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  }
  return p;
}

export interface Performances {
  global: {
    total: number; non_attribues: number | null; resolus: number | null; hors_delai: number | null;
    delai_moyen_h: number | null;
  };
  techniciens: {
    id: number; technicien: string; groupe: string | null; zone: string | null;
    attribues: number; en_cours: number | null; resolus: number | null; dans_delai: number | null;
    hors_delai: number | null; delai_moyen_h: number | null;
  }[];
}

/** Charge des groupes et des techniciens IT (aide à l'affectation) */
export interface Disponibilite {
  groupes: {
    id: number; nom: string; zone_id: number; zone_nom: string;
    nb_it: number; tickets_ouverts: number; terrain_ouverts: number; terrain_hors_delai: number;
  }[];
  techniciens: {
    id: number; prenom: string; nom: string; groupe_id: number | null;
    tickets_ouverts: number; en_cours: number; en_attente: number;
  }[];
}

export interface Dashboard {
  parStatut: { statut: string; total: number }[];
  parZone: { zone: string; total: number; ouverts: number | null }[];
  horsDelai: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Zones & groupes
  zones() { return this.http.get<Zone[]>(`${API_URL}/zones`); }
  groupes() { return this.http.get<Groupe[]>(`${API_URL}/zones/groupes`); }
  sites() { return this.http.get<Site[]>(`${API_URL}/sites`); }
  creerGroupe(data: { nom: string; zone_id: number }) { return this.http.post(`${API_URL}/zones/groupes`, data); }

  // Utilisateurs
  utilisateurs(filtres: Record<string, unknown> = {}) {
    return this.http.get<User[]>(`${API_URL}/users`, { params: params(filtres) });
  }
  creerUtilisateur(data: Record<string, unknown>) { return this.http.post(`${API_URL}/users`, data); }
  modifierUtilisateur(id: number, data: Record<string, unknown>) { return this.http.put(`${API_URL}/users/${id}`, data); }

  // Tickets (GLPI)
  tickets(filtres: Record<string, unknown> = {}) {
    return this.http.get<Ticket[]>(`${API_URL}/tickets`, { params: params(filtres) });
  }
  ticket(id: number) { return this.http.get<TicketDetail>(`${API_URL}/tickets/${id}`); }
  creerTicket(data: FormData) {
    return this.http.post<{ id: number; reference: string }>(`${API_URL}/tickets`, data);
  }
  /** Affectation à un groupe de techniciens (technicien facultatif) — Responsable IT */
  attribuer(id: number, data: { groupe_id: number | null; technicien_id: number | null; date_planifiee: string | null }) {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/attribuer`, data);
  }
  planifier(id: number, date_planifiee: string | null) {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/planifier`, { date_planifiee });
  }
  mettreEnAttente(id: number, motif_attente: MotifAttente, motif: string) {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/attente`, { motif_attente, motif });
  }
  /** Changement de statut libre (IT / Responsable IT) */
  requalifier(id: number, type: string, commentaire = '') {
    return this.http.put<{ message: string }>(`${API_URL}/tickets/${id}/type`, { type, commentaire });
  }
  decisionCompte(id: number, decision: 'APPROUVE' | 'REFUSE', motif = '', groupe_id: number | null = null) {
    return this.http.put<{ message: string }>(`${API_URL}/users/${id}/approbation`, { decision, motif, groupe_id });
  }
  changerStatut(id: number, data: Record<string, unknown>) {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/statut`, data);
  }
  reprendre(id: number, commentaire = '') {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/reprendre`, { commentaire });
  }
  soumettreRapport(id: number, data: Record<string, unknown>) {
    return this.http.post<Ticket>(`${API_URL}/tickets/${id}/rapport`, data);
  }
  commenter(id: number, texte: string, action_terrain = false) {
    return this.http.post(`${API_URL}/tickets/${id}/commentaire`, { texte, action_terrain });
  }
  valider(id: number, decision: 'VALIDE' | 'REJETE', commentaire: string) {
    return this.http.put<Ticket>(`${API_URL}/tickets/${id}/valider`, { decision, commentaire });
  }

  // Statistiques
  // Interventions terrain
  demarrerTerrain(id: number, data: Record<string, unknown>) {
    return this.http.post(`${API_URL}/tickets/${id}/terrain/debut`, data);
  }
  terminerTerrain(id: number, data: Record<string, unknown>) {
    return this.http.put(`${API_URL}/tickets/${id}/terrain/fin`, data);
  }
  validerRapportTerrain(id: number, interventionId: number, data: Record<string, unknown>) {
    return this.http.post(`${API_URL}/tickets/${id}/terrain/${interventionId}/rapport`, data);
  }
  modifierSite(id: number, data: Record<string, unknown>) { return this.http.put(`${API_URL}/sites/${id}`, data); }
  journalTerrain(filtres: Record<string, unknown> = {}) {
    return this.http.get<InterventionTerrain[]>(`${API_URL}/terrain/journal`, { params: params(filtres) });
  }
  disponibilite() { return this.http.get<Disponibilite>(`${API_URL}/stats/disponibilite`); }
  dashboard() { return this.http.get<Dashboard>(`${API_URL}/stats/dashboard`); }
  performances(du?: string, au?: string) {
    return this.http.get<Performances>(`${API_URL}/stats/performances`, { params: params({ du, au }) });
  }
}
