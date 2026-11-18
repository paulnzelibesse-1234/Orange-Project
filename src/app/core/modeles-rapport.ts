import { Ticket, TypeTicket } from './models';

/**
 * Modèles de rapport d'intervention : un par nature de demande / d'incident.
 * Chaque modèle définit ses champs propres et l'onglet « Postes » (postes configurés ou impactés :
 * N° de poste, N° de série, utilisateur). Le modèle est présélectionné d'après le titre du ticket.
 */
export interface ChampRapport {
  cle: string;
  libelle: string;
  placeholder?: string;
  options?: string[];      // liste déroulante
  obligatoire?: boolean;
}

export interface ModeleRapport {
  code: string;
  type: TypeTicket;
  libelle: string;
  /** Reconnaissance dans le titre / la description (texte sans accents, en minuscules) */
  motsCles?: RegExp;
  /** Libellé de l'onglet Postes */
  postes: string;          // ex. « Postes configurés », « Postes impactés »
  champs: ChampRapport[];
}

/** Poste configuré / impacté. `numero` : ancien champ « N° de poste » (rapports antérieurs, affiché comme tatouage) */
export interface PosteRapport { tatouage: string; serie: string; marque: string; modele: string; utilisateur: string; numero?: string; }

export const MODELES_RAPPORT: ModeleRapport[] = [
  // ---------------------------------------------------------------- Demandes
  {
    code: 'CONFIG_IMPRIMANTE', type: 'DEMANDE', libelle: 'Configuration d’imprimante', postes: 'Postes configurés',
    motsCles: /imprim|printer/,
    champs: [
      { cle: 'imprimante_modele', libelle: 'Modèle de l’imprimante', placeholder: 'Ex : HP LaserJet M404', obligatoire: true },
      { cle: 'imprimante_serie', libelle: 'N° de série de l’imprimante', placeholder: 'Ex : VNB3K12345' },
      { cle: 'imprimante_ip', libelle: 'Adresse IP / file d’impression', placeholder: 'Ex : 10.12.4.25 ou \\\\srv-print\\RDC' },
      { cle: 'connexion', libelle: 'Type de connexion', options: ['Réseau', 'USB', 'Wi-Fi'] },
    ],
  },
  {
    code: 'INSTALLATION_LOGICIEL', type: 'DEMANDE', libelle: 'Installation d’application / logiciel', postes: 'Postes installés',
    motsCles: /install/,
    champs: [
      { cle: 'logiciel', libelle: 'Application / logiciel', placeholder: 'Ex : Power BI Desktop', obligatoire: true },
      { cle: 'version', libelle: 'Version installée', placeholder: 'Ex : 2.128' },
      { cle: 'licence', libelle: 'Licence', options: ['Gratuite', 'Licence Orange (volume)', 'Licence nominative', 'Non applicable'] },
    ],
  },
  {
    code: 'CONFIG_MESSAGERIE_VPN', type: 'DEMANDE', libelle: 'Configuration messagerie / VPN', postes: 'Postes configurés',
    motsCles: /vpn|messagerie|outlook|mail/,
    champs: [
      { cle: 'service', libelle: 'Service configuré', options: ['Messagerie', 'VPN', 'Messagerie et VPN'], obligatoire: true },
      { cle: 'compte', libelle: 'Compte / adresse configuré', placeholder: 'Ex : prenom.nom@orange.ci' },
      { cle: 'client', libelle: 'Client utilisé', placeholder: 'Ex : Outlook 365, FortiClient' },
    ],
  },
  {
    code: 'PARAMETRAGE_OUTIL', type: 'DEMANDE', libelle: 'Paramétrage d’un outil (scanner, logiciel…)', postes: 'Postes paramétrés',
    motsCles: /parametr|scanner/,
    champs: [
      { cle: 'outil', libelle: 'Outil paramétré', placeholder: 'Ex : scanner Canon DR-C225', obligatoire: true },
      { cle: 'parametres', libelle: 'Paramètres appliqués', placeholder: 'Ex : numérisation vers dossier partagé' },
    ],
  },
  {
    code: 'MISE_A_JOUR', type: 'DEMANDE', libelle: 'Mise à jour logicielle', postes: 'Postes mis à jour',
    motsCles: /(mise|mettre|mis) a (jour|niveau)|\bmaj\b|update/,
    champs: [
      { cle: 'logiciel', libelle: 'Logiciel mis à jour', placeholder: 'Ex : Windows 11', obligatoire: true },
      { cle: 'version_avant', libelle: 'Version avant' },
      { cle: 'version_apres', libelle: 'Version après' },
    ],
  },
  {
    code: 'COMPTE_DROITS', type: 'DEMANDE', libelle: 'Création de compte / droits d’accès', postes: 'Postes / utilisateurs concernés',
    motsCles: /compte|droit|habilitation|autorisation/,
    champs: [
      { cle: 'systeme', libelle: 'Application / système', placeholder: 'Ex : Active Directory, SAP', obligatoire: true },
      { cle: 'identifiant', libelle: 'Identifiant créé / modifié' },
      { cle: 'droits', libelle: 'Droits accordés', placeholder: 'Ex : lecture/écriture sur \\\\srv\\RH' },
    ],
  },
  {
    code: 'DEPLACEMENT_POSTE', type: 'DEMANDE', libelle: 'Déplacement de poste de travail', postes: 'Postes déplacés',
    motsCles: /deplac|demenag/,
    champs: [
      { cle: 'origine', libelle: 'Emplacement d’origine', placeholder: 'Ex : Bâtiment A, bureau 12', obligatoire: true },
      { cle: 'destination', libelle: 'Nouvel emplacement', placeholder: 'Ex : Bâtiment B, bureau 3', obligatoire: true },
    ],
  },
  {
    code: 'FOURNITURE_MATERIEL', type: 'DEMANDE', libelle: 'Fourniture de matériel', postes: 'Postes équipés',
    motsCles: /souris|clavier|ecran|fourni|materiel|bandeau|casque/,
    champs: [
      { cle: 'materiel', libelle: 'Matériel fourni', placeholder: 'Ex : 2 souris, 1 écran 24"', obligatoire: true },
      { cle: 'reference', libelle: 'Référence / n° de série du matériel' },
    ],
  },
  {
    code: 'MIGRATION', type: 'DEMANDE', libelle: 'Migration / mise en service', postes: 'Postes migrés / mis en service',
    motsCles: /migr|(mise|mettre) e?n? service/,
    champs: [
      { cle: 'systeme', libelle: 'Système / service concerné', placeholder: 'Ex : Office 365', obligatoire: true },
      { cle: 'ancien', libelle: 'Ancienne version / ancien système' },
    ],
  },
  { code: 'AUTRE_DEMANDE', type: 'DEMANDE', libelle: 'Autre demande', postes: 'Postes concernés', champs: [] },

  // ---------------------------------------------------------------- Incidents
  {
    code: 'ACCES_RESEAU', type: 'INCIDENT', libelle: 'Souci d’accès réseau / internet', postes: 'Postes impactés',
    motsCles: /reseau|internet|connexion|wifi|wi-fi|lan/,   // « lan » seul (pas « plante », « surveillance »)
    champs: [
      { cle: 'equipement', libelle: 'Équipement en cause', options: ['Câble / prise réseau', 'Switch', 'Borne Wi-Fi', 'Routeur / box', 'Configuration du poste', 'Fournisseur d’accès', 'Indéterminé'], obligatoire: true },
      { cle: 'cause', libelle: 'Cause identifiée', placeholder: 'Ex : port du switch désactivé' },
      { cle: 'debut', libelle: 'Début de la coupure', placeholder: 'Ex : 14/11 à 08 h 30' },
    ],
  },
  {
    code: 'ACCES_COMPTE', type: 'INCIDENT', libelle: 'Souci d’accès à un compte', postes: 'Postes / utilisateurs impactés',
    motsCles: /compte|mot de passe|connecter|login|session|^(?!.*\b(badge|porte)\b).*acces .{0,30}(refuse|bloque|desactive)/,
    champs: [
      { cle: 'application', libelle: 'Application / système', placeholder: 'Ex : session Windows, SAP', obligatoire: true },
      { cle: 'cause', libelle: 'Cause', options: ['Mot de passe expiré', 'Compte verrouillé', 'Droits retirés', 'Compte désactivé', 'Autre'] },
    ],
  },
  {
    code: 'PLANTAGE_APPLICATION', type: 'INCIDENT', libelle: 'Plantage / erreur d’application', postes: 'Postes impactés',
    motsCles: /plant|erreur|bug|crash|application|logiciel/,
    champs: [
      { cle: 'application', libelle: 'Application', placeholder: 'Ex : Excel, GLPI, logiciel de caisse', obligatoire: true },
      { cle: 'message', libelle: 'Message d’erreur', placeholder: 'Ex : « Excel a cessé de fonctionner »' },
      { cle: 'version', libelle: 'Version' },
    ],
  },
  {
    code: 'PANNE_IMPRIMANTE', type: 'INCIDENT', libelle: 'Imprimante en panne', postes: 'Postes impactés',
    motsCles: /imprim|printer/,
    champs: [
      { cle: 'imprimante_modele', libelle: 'Modèle de l’imprimante', obligatoire: true },
      { cle: 'imprimante_serie', libelle: 'N° de série de l’imprimante' },
      { cle: 'panne', libelle: 'Panne constatée', placeholder: 'Ex : bourrage, toner vide, hors ligne' },
    ],
  },
  {
    code: 'PANNE_MATERIEL', type: 'INCIDENT', libelle: 'Panne matériel (PC, serveur, écran…)', postes: 'Postes impactés',
    motsCles: /pc|ordinateur|serveur|ecran|demarre|allume|arret/,
    champs: [
      { cle: 'equipement', libelle: 'Équipement en panne', placeholder: 'Ex : PC portable Dell Latitude', obligatoire: true },
      { cle: 'piece', libelle: 'Pièce remplacée', placeholder: 'Ex : disque dur, alimentation' },
    ],
  },
  { code: 'AUTRE_INCIDENT', type: 'INCIDENT', libelle: 'Autre dysfonctionnement', postes: 'Postes impactés', champs: [] },
];

const normaliser = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const modelesDuType = (type: TypeTicket) => MODELES_RAPPORT.filter((m) => m.type === type);
export const modeleParCode = (code: string | null | undefined) => MODELES_RAPPORT.find((m) => m.code === code) ?? null;

/** Modèle présélectionné : titre d'abord, puis description, sinon « Autre » */
export function detecterModele(t: Pick<Ticket, 'type' | 'titre' | 'description'>): ModeleRapport {
  const modeles = modelesDuType(t.type);
  for (const texte of [t.titre, t.description]) {
    const n = normaliser(texte);
    const m = modeles.find((x) => x.motsCles?.test(n));
    if (m) return m;
  }
  return modeles[modeles.length - 1];
}

// ---------------------------------------------------------------- Aides communes aux formulaires
export const posteVide = (): PosteRapport => ({ tatouage: '', serie: '', marque: '', modele: '', utilisateur: '' });

/** Un champ obligatoire du modèle n'est pas rempli */
export const champsIncomplets = (m: ModeleRapport | null, details: Record<string, string>) =>
  (m?.champs ?? []).some((c) => c.obligatoire && !(details[c.cle] ?? '').trim());

/** Chaque poste doit avoir un tatouage ou un N° de série, et un utilisateur */
export const postesIncomplets = (postes: PosteRapport[]) =>
  !postes.length || postes.some((p) => (!p.tatouage.trim() && !p.serie.trim()) || !p.utilisateur.trim());

/** Champs du modèle à envoyer à l'API (libellés inclus, valeurs vides retirées) */
export const detailsPourApi = (m: ModeleRapport | null, details: Record<string, string>) =>
  (m?.champs ?? []).map((c) => ({ cle: c.cle, libelle: c.libelle, valeur: (details[c.cle] ?? '').trim() })).filter((d) => d.valeur);

export const postesPourApi = (postes: PosteRapport[]) =>
  postes.map((p) => ({
    tatouage: p.tatouage.trim(), serie: p.serie.trim(), marque: p.marque.trim(), modele: p.modele.trim(), utilisateur: p.utilisateur.trim(),
  }));

/** Copie modifiable des postes d'un rapport enregistré (pour préremplir un autre rapport) */
export const copierPostes = (postes: Partial<PosteRapport>[] | undefined): PosteRapport[] =>
  postes?.length
    ? postes.map((p) => ({ tatouage: p.tatouage || p.numero || '', serie: p.serie || '', marque: p.marque || '', modele: p.modele || '', utilisateur: p.utilisateur || '' }))
    : [posteVide()];

/** Libellé « Postes configurés / impactés… » d'un rapport enregistré (d'après le libellé de sa nature) */
export const libellePostes = (modele: string | null | undefined) =>
  MODELES_RAPPORT.find((m) => m.libelle === modele)?.postes ?? 'Postes concernés';
