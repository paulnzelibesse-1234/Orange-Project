import { InterventionTerrain, Rapport, TicketDetail } from './models';

/** Un rapport d'intervention : résolution du ticket et/ou intervention terrain validée par le site */
export interface RapportReuni {
  cle: string;
  date: string;
  resolution: Rapport | null;
  terrain: InterventionTerrain | null;
}

/**
 * Réunit les rapports d'un ticket : chaque résolution est jointe à la dernière intervention terrain validée
 * avant elle (un seul rapport d'intervention) ; les interventions non jointes restent seules.
 * Du plus récent au plus ancien.
 */
export function reunirRapports(t: TicketDetail | null): RapportReuni[] {
  if (!t) return [];
  const terrain = t.interventions.filter((i) => i.statut === 'VALIDEE')
    .map((i) => ({ i, date: String(i.valide_le ?? i.fin_le ?? i.debut_le) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const joints = new Set<number>();
  const items: RapportReuni[] = [];
  for (const r of [...t.rapports].sort((a, b) => a.cree_le.localeCompare(b.cree_le))) {
    const it = [...terrain].reverse().find((x) => x.date <= r.cree_le && !joints.has(x.i.id))?.i ?? null;
    if (it) joints.add(it.id);
    items.push({ cle: 'r' + r.id, date: r.cree_le, resolution: r, terrain: it });
  }
  for (const { i, date } of terrain) {
    if (!joints.has(i.id)) items.push({ cle: 'i' + i.id, date, resolution: null, terrain: i });
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}
