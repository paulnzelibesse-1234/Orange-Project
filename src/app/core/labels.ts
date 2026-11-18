import { Categorie, MotifAttente, Priorite, Role, Statut, Ticket, TypeTicket } from './models';

export const API_URL = 'http://localhost:3000/api';
export const UPLOADS_URL = 'http://localhost:3000/uploads';

export const ROLE_LABELS: Record<Role, string> = {
  RESPONSABLE_IT: 'Responsable IT',
  IT: 'Technicien IT',
  UTILISATEUR: 'Utilisateur',
};

export const STATUT_LABELS: Record<Statut, string> = {
  EN_COURS_ATTRIBUE: 'En cours (attribué)',
  EN_COURS_PLANIFIE: 'En cours (planifié)',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
};

/** Suggestions pour la direction et le service (saisie libre possible) */
export const DIRECTIONS = [
  'Direction Générale', "Direction des Systèmes d'Information", 'Direction Technique et Réseaux', 'Direction Commerciale',
  'Direction Marketing', 'Direction Clients Entreprises', 'Direction des Ressources Humaines', 'Direction Administrative et Financière',
  'Direction Juridique et Réglementation', 'Direction de la Communication', 'Direction des Achats et de la Logistique',
];
export const SERVICES = [
  'Support informatique', 'Support et exploitation', 'Réseaux et télécoms', 'Sécurité informatique', 'Agence / Boutique',
  'Service client', 'Ventes', 'Comptabilité', 'Contrôle de gestion', 'Paie', 'Recrutement et formation', 'Logistique', 'Moyens généraux',
];

/** Les deux types de ticket */
export const TYPE_LABELS: Record<TypeTicket, string> = { INCIDENT: 'Incident', DEMANDE: 'Demande' };
export const TYPE_ICONES: Record<TypeTicket, string> = { INCIDENT: '⚠', DEMANDE: '📝' };
export const TYPES_TICKET: { code: TypeTicket; titre: string; definition: string; regle: string[]; exemples: string[] }[] = [
  {
    code: 'INCIDENT',
    titre: 'Incident',
    definition: 'Un problème qui perturbe le fonctionnement normal d’un service, d’un équipement, du réseau ou d’une application. Quelque chose qui marchait avant ne marche plus, ou marche mal.',
    regle: ['Panne', 'Dysfonctionnement', 'Plantage', 'Souci d’accès', 'Erreur', 'Coupure'],
    exemples: [
      'Une application qui plante ou affiche des erreurs',
      'Une machine ou un serveur à l’arrêt',
      'Une coupure de réseau ou d’internet',
      'Je n’arrive plus à me connecter à mon compte',
      'Une imprimante qui ne fonctionne plus',
    ],
  },
  {
    code: 'DEMANDE',
    titre: 'Demande',
    definition: 'Un besoin ou un service que vous sollicitez auprès du technicien, alors que rien n’est cassé : vous voulez quelque chose de nouveau, de modifié ou d’autorisé.',
    regle: ['Installation', 'Configuration', 'Paramétrage', 'Mise à jour'],
    exemples: [
      'Installer une application sur un poste',
      'Configurer une messagerie, une imprimante ou un accès VPN',
      'Créer un compte utilisateur ou donner des droits d’accès',
      'Installer ou paramétrer un outil (logiciel, scanner…)',
      'Mettre à jour un logiciel ou déplacer un poste de travail',
      'Fournir du matériel (souris, clavier, écran)',
    ],
  },
];

/**
 * Suggestion du type d'après le titre et la description.
 * Règle : installation, configuration, paramétrage et mise à jour sont des DEMANDES.
 * Dysfonctionnement, souci d'accès, plantage (et « ne marche plus », « erreur », « coupure »…) sont des INCIDENTS ;
 * il l'emporte (ex. « l'imprimante ne marche plus depuis la mise à jour » est un incident).
 */
const MOTS_DEMANDE: [RegExp, string][] = [
  [/\binstall/, 'installation'],
  [/\bconfigur/, 'configuration'],
  [/\bparametr/, 'paramétrage'],
  [/\b(mise|mettre|mis) a (jour|niveau)\b|\bmaj\b|\bupdate/, 'mise à jour'],
  [/\b(creer|creation|ouvrir|ouverture)\b.{0,25}\bcompte/, 'création de compte'],
  [/\b(droits?|habilitation|autorisation)\b/, 'droits d’accès'],
  [/\bdeplac|\bdemenag/, 'déplacement de poste'],
  [/\bmigr/, 'migration'],
  [/\b(mise|mettre) e?n? service\b/, 'mise en service'],
  [/\b(fournir|fourniture|besoin d.un|besoin d.une|nouvel(le)?|nouveau)\b/, 'nouveau besoin'],
  [/\b(ajout|ajouter|prepar|sauvegard|etiquet|inventaire|formation|former)/, 'service demandé'],
];
const MOTS_INCIDENT: [RegExp, string][] = [
  [/\b(dysfonction|disfonction|mal fonctionn|fonctionne mal|marche mal)/, 'dysfonctionnement'],
  [/\b(souci|soucis|probleme|problemes|perte|refus)\s+d.acces|\bacces\s+(refuse|impossible|bloque|perdu|interdit)|\b(pas|plus)\s+(d.)?acces\b/, 'souci d’accès'],
  [/\bplant/, 'plantage'],
  [/\b(ne|n.)\s*(marche|fonctionne|demarre|s.allume|repond|imprime|s.ouvre)\s*(plus|pas)\b/, 'ne fonctionne plus'],
  [/\b(n.arrive|arrive) (plus|pas) a\b|\bimpossible\b/, 'impossible'],
  [/\b(panne|en panne|hs|plante|crash|bug|bloque|gele|freeze)\b/, 'panne'],
  [/\berreur/, 'erreur'],
  [/\b(coupure|coupe|pas de (connexion|reseau|internet)|plus de (connexion|reseau|internet))\b/, 'coupure'],
  [/\b(a l.arret|arrete|lent|lenteur)\b/, 'dysfonctionnement'],
  [/\b(refuse|refusee|verrouille|desactive|desactivee|expire)\b/, 'souci d’accès'],
  [/\b(ne|n.)\s*[a-z']+\s+plus\b|\bs.eteint|\bbourrage|\bsurchauff|\balarme|\b(pages?|impressions?) blanches?|\bdans le vide\b/, 'ne fonctionne plus'],
];
export function suggererType(texte: string): { type: TypeTicket; indice: string } | null {
  const t = (texte || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’`]/g, "'");
  const inc = MOTS_INCIDENT.find(([r]) => r.test(t));
  if (inc) return { type: 'INCIDENT', indice: inc[1] };
  const dem = MOTS_DEMANDE.find(([r]) => r.test(t));
  return dem ? { type: 'DEMANDE', indice: dem[1] } : null;
}

/** Les deux conditions de mise en attente */
export const MOTIF_ATTENTE_LABELS: Record<MotifAttente, string> = {
  RESSOURCE_INDISPONIBLE: 'Ressource / équipement non disponible',
  INTERVENTION_TERRAIN: 'Intervention terrain nécessaire',
};
export const MOTIFS_ATTENTE = Object.keys(MOTIF_ATTENTE_LABELS) as MotifAttente[];

/** Le ticket est résolu et attend la validation du client (action terrain) */
export const aValider = (t: Ticket) => t.statut === 'RESOLU' && t.validation_client === 'EN_ATTENTE';

/** Libellé d'un statut, y compris ceux d'anciens historiques */
export function libelleStatut(s: string | null | undefined): string {
  return (s && (STATUT_LABELS as Record<string, string>)[s]) || s || '';
}

function duree(sec: number): string {
  const min = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Durée en minutes → « 1 h 25 » / « 40 min » */
export function dureeMinutes(min: number): string {
  const m = Math.max(0, Math.round(Number(min) || 0));
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

function dureeLongue(sec: number): string {
  const h = Math.max(0, Math.round(sec / 3600));
  const j = Math.floor(h / 24);
  return j ? `${j} j ${String(h % 24).padStart(2, '0')} h` : duree(sec);
}

/** Délai terrain (2 jours à partir de la réception par le groupe) — null si le ticket n'en a pas */
export function infoDelaiTerrain(t: Ticket): { texte: string; classe: string; titre: string } | null {
  if (!t.terrain_affecte_le || t.delai_terrain_ecoule_s == null) return null;
  const max = t.delai_terrain_max_s ?? 48 * 3600;
  const reste = max - t.delai_terrain_ecoule_s;
  const hors = !!Number(t.terrain_hors_delai);
  const titre = `Délai terrain : 2 jours à partir de la réception par le groupe` +
    (t.terrain_echeance ? ` — échéance le ${new Date(t.terrain_echeance.replace(' ', 'T')).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` : '');
  if (t.statut === 'RESOLU') {
    return hors
      ? { texte: `Terrain résolu hors délai (+${dureeLongue(-reste)})`, classe: 'd-hors', titre }
      : { texte: 'Terrain résolu dans les délais', classe: 'd-ok', titre };
  }
  if (hors) return { texte: `🛠 Terrain hors délai (+${dureeLongue(-reste)})`, classe: 'd-hors', titre };
  return { texte: `🛠 Terrain : reste ${dureeLongue(reste)}`, classe: reste < 6 * 3600 ? 'd-proche' : 'd-ok', titre };
}

/** Délai de traitement (8 h sur les statuts En cours) : texte + classe CSS du badge */
export function infoDelai(t: Ticket): { texte: string; classe: string; titre: string } {
  const reste = t.delai_max_s - t.delai_ecoule_s;
  const hors = !!Number(t.hors_delai);
  const titre = `Délai de traitement : ${duree(t.delai_max_s)} en « En cours » — ${duree(t.delai_ecoule_s)} écoulé`;
  if (t.statut === 'RESOLU') {
    return hors
      ? { texte: `Résolu hors délai (+${duree(-reste)})`, classe: 'd-hors', titre }
      : { texte: 'Résolu dans les délais', classe: 'd-ok', titre };
  }
  if (hors) return { texte: `Hors délai (+${duree(-reste)})`, classe: 'd-hors', titre };
  if (t.statut === 'EN_ATTENTE') {
    return {
      texte: `⏸ Délai suspendu — reste ${duree(reste)}`,
      classe: 'd-pause',
      titre: `${titre}. Délai suspendu : la résolution dépend de la disponibilité des ressources ou des intervenants.`,
    };
  }
  return { texte: `Reste ${duree(reste)}`, classe: reste < 3600 ? 'd-proche' : 'd-ok', titre };
}

export const PRIORITE_LABELS: Record<Priorite, string> = {
  BASSE: 'Basse',
  MOYENNE: 'Moyenne',
  HAUTE: 'Haute',
  CRITIQUE: 'Critique',
};

export const CATEGORIE_LABELS: Record<Categorie, string> = {
  MATERIEL: 'Matériel',
  LOGICIEL: 'Logiciel',
  RESEAU: 'Réseau',
  TELEPHONIE: 'Téléphonie',
  AUTRE: 'Autre',
};

export const ACTION_LABELS: Partial<Record<string, string>> = {
  CREATION: 'Ticket créé',
  REQUALIFICATION: 'Ticket requalifié',
  ATTRIBUTION: 'Attribution',
  CHANGEMENT_STATUT: 'Changement de statut',
  PLANIFICATION: 'Intervention planifiée',
  MISE_EN_ATTENTE: 'Mise en attente',
  REPRISE: 'Reprise',
  RAPPORT: 'Ticket résolu',
  ACTION_TERRAIN: 'Action terrain requise',
  TERRAIN_DEBUT: '▶ Début d’intervention terrain',
  TERRAIN_FIN: '⏹ Fin d’intervention terrain',
  TERRAIN_RAPPORT_VALIDE: '✔ Rapport d’intervention validé par le site',
  TERRAIN_INTERROMPUE: '🚐 Intervention terrain interrompue',
  VALIDATION: 'Résolution validée par le client',
  REJET: 'Résolution rejetée par le client',
  // anciennes actions (historique)
  DEMARRAGE: 'Intervention démarrée',
  COMMENTAIRE: 'Commentaire',
};

export const STATUTS = Object.keys(STATUT_LABELS) as Statut[];
export const PRIORITES = Object.keys(PRIORITE_LABELS) as Priorite[];
export const CATEGORIES = Object.keys(CATEGORIE_LABELS) as Categorie[];
