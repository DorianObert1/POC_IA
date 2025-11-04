import type { Dataset, ReportOptions } from '../types'

function downsampleHalf<T>(arr: T[]) { return arr.filter((_, i) => i % 2 === 0) }

export function buildReportPrompt(data: Dataset, opts: ReportOptions & { title?: string } = {}) {
  const { locale = 'fr', tone = 'neutre', title = 'Rapport de synthèse' } = opts
  const head = `Génère un rapport ${tone} en ${locale} intitulé "${title}".
- Structure en sections: Contexte, Faits marquants, Analyse croisée, Recommandations.
- Garde un style concis (600-900 mots) avec puces là où utile.
- Harmonise le vocabulaire d’un rapport métier.
- Ne répète pas les données brutes inutilement.`

  const slim = downsampleHalf(data).slice(0, 50)
  const series = slim
    .map(d => `${d.date} | ${d.category} | A:${d.metricA} B:${d.metricB} C:${d.metricC}`)
    .join('\n')

  const body = `Données agrégées (échantillon réduit):\n${series}\n\nDirectives:\n- Mets en évidence les tendances, écarts par catégorie et périodes.\n- Fais une analyse conjointe des indicateurs A, B, C.\n- Termine par des recommandations actionnables.\n- Adapte le texte au contexte implicite (catégories = régions).\n- Si des graphiques sont fournis, exploite-les pour appuyer l’analyse.`

  return `${head}\n\n${body}`
}
