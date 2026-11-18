export type Role = 'RESPONSABLE_IT' | 'IT' | 'UTILISATEUR';
export type MotifAttente = 'RESSOURCE_INDISPONIBLE' | 'INTERVENTION_TERRAIN';
export type Statut = 'EN_COURS_ATTRIBUE' | 'EN_COURS_PLANIFIE' | 'EN_ATTENTE' | 'RESOLU';
export type Priorite = 'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
export type Categorie = 'MATERIEL' | 'LOGICIEL' | 'RESEAU' | 'TELEPHONIE' | 'AUTRE';

export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
  role: Role;
  groupe_id?: number | null;
  groupe_nom?: string | null;
  zone_id?: number | null;
  zone_nom?: string | null;
  actif?: number;
  email_verifie?: number;
  direction?: string | null;
  service?: string | null;
  site_id?: number | null;
  site_nom?: string | null;
  approbation?: 'APPROUVE' | 'EN_ATTENTE' | 'REFUSE';
  motif_refus?: string | null;
  cree_le?: string;
}

export interface Zone { id: number; nom: string; description?: string; }
export interface Groupe { id: number; nom: string; zone_id: number; zone_nom: string; nb_it: number; }

export type TypeTicket = 'INCIDENT' | 'DEMANDE';

export interface Ticket {
  id: number;
  reference: string;
  titre: string;
  description: string;
  type: TypeTicket;
  createur_direction?: string | null;
  createur_service?: string | null;
  createur_site?: string | null;
  categorie: Categorie;
  priorite: Priorite;
  statut: Statut;
  statut_depuis: string;
  /** Secondes décomptées sur le délai de traitement (statuts En cours uniquement) */
  delai_ecoule_s: number;
  /** Délai de traitement autorisé, en secondes (8 h) */
  delai_max_s: number;
  hors_delai: number | boolean;
  /** Réception du ticket terrain par le groupe : début du délai terrain */
  terrain_affecte_le?: string | null;
  terrain_echeance?: string | null;
  /** Secondes écoulées depuis la réception par le groupe (null si pas de délai terrain) */
  delai_terrain_ecoule_s?: number | null;
  delai_terrain_max_s?: number;
  terrain_hors_delai?: number | boolean;
  /** Début de l'intervention terrain en cours (null si aucune) */
  terrain_en_cours_depuis?: string | null;
  nb_interventions?: number;
  nb_interventions_a_valider?: number;
  site_responsable_nom?: string | null;
  site_responsable_telephone?: string | null;
  /** Motif du statut « En attente » */
  motif_attente?: MotifAttente | null;
  /** Signalé par l'IT : la résolution devra être validée par le client */
  action_terrain: number | boolean;
  validation_client?: 'EN_ATTENTE' | 'VALIDE' | 'REJETE' | null;
  localisation?: string | null;
  capture?: string | null;
  zone_id: number;
  zone_nom: string;
  groupe_id?: number | null;
  groupe_nom?: string | null;
  createur_id: number;
  createur_nom: string;
  createur_email?: string;
  createur_telephone?: string | null;
  technicien_id?: number | null;
  technicien_nom?: string | null;
  date_planifiee?: string | null;
  cree_le: string;
  attribue_le?: string | null;
  debut_le?: string | null;
  resolu_le?: string | null;
  cloture_le?: string | null;
}

export interface Rapport {
  id: number;
  technicien_nom: string;
  diagnostic: string;
  actions_realisees: string;
  materiel_utilise?: string | null;
  duree_minutes?: number | null;
  modele?: string | null;
  details?: { cle: string; libelle: string; valeur: string }[];
  nb_postes?: number | null;
  postes?: { tatouage?: string; numero?: string; serie: string; marque?: string; modele?: string; utilisateur: string }[];
  cree_le: string;
}

export interface Historique {
  id: number;
  action: string;
  ancien_statut?: string | null;
  nouveau_statut?: string | null;
  details?: string | null;
  utilisateur_nom: string;
  utilisateur_role: Role;
  cree_le: string;
}

/** Intervention terrain d'un groupe de techniciens */
export interface InterventionTerrain {
  modele?: string | null;
  details?: { cle: string; libelle: string; valeur: string }[];
  nb_postes?: number | null;
  postes?: { tatouage?: string; numero?: string; serie: string; marque?: string; modele?: string; utilisateur: string }[];
  id: number;
  ticket_id: number;
  groupe_id: number | null;
  groupe_nom: string | null;
  debut_le: string;
  fin_le: string | null;
  /** EN_COURS : chronomètre en marche ; A_VALIDER : arrêté, rapport à valider ; VALIDEE : rapport validé par le site */
  statut: 'EN_COURS' | 'A_VALIDER' | 'VALIDEE';
  note_depart: string | null;
  demarree_par_nom: string;
  terminee_par_nom: string | null;
  // Rapport d'intervention
  resultat: 'TERMINEE' | 'INTERROMPUE' | null;
  diagnostic: string | null;
  compte_rendu: string | null;
  materiel: string | null;
  observations: string | null;
  motif_interruption: string | null;
  rapport_par_nom: string | null;
  responsable_site_nom: string | null;
  responsable_site_fonction: string | null;
  appreciation: 'SATISFAIT' | 'RESERVES' | null;
  commentaire_site: string | null;
  valide_le: string | null;
  duree_min: number;
  intervenants: { id: number; nom: string }[];
  reference: string;
  titre: string;
  localisation: string | null;
  zone_nom: string;
}

export interface TicketDetail extends Ticket {
  rapports: Rapport[];
  historique: Historique[];
  interventions: InterventionTerrain[];
}

export interface Bureau { id: number; nom: string; }
export interface Batiment { id: number; nom: string; bureaux: Bureau[]; }
export interface Site {
  id: number;
  nom: string;
  /** Commune d'Abidjan ou ville de l'intérieur */
  commune?: string | null;
  responsable_nom?: string | null;
  responsable_telephone?: string | null;
  code_defini?: number | boolean;
  zone_id: number;
  zone_nom: string;
  batiments: Batiment[];
}
