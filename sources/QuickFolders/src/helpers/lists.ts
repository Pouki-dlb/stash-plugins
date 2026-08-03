/**
 * Modèle des deux listes de dossiers : sérialisation, dédoublonnage, libellés.
 *
 * Une entrée est un chemin, rien de plus.
 *
 * - **Historique** : auto-alimenté par les tâches lancées, du plus récent au
 *   plus ancien, plafonné par le réglage `maxEntries` — les plus anciennes
 *   entrées étant écartées. L'ordre de la liste *est* la chronologie.
 * - **Favoris** : posés à la main via la punaise, sans plafond, jamais évincés,
 *   triés alphabétiquement à l'affichage (voir sortForDisplay).
 */

import { readState, resolveConfig, writeLists } from "@helpers/config";

/**
 * Désérialise une liste, en tolérant une valeur absente ou corrompue.
 *
 * Le format est un simple tableau JSON de chemins : ["/media/A","/media/B"].
 */
export function parseList(json?: string | null): string[] {
  if (typeof json !== "string" || json === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  // Un doublon ne devrait pas exister, mais un config.yml édité à la main peut
  // en produire — et deux entrées identiques casseraient les clés React.
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of parsed) {
    if (typeof raw !== "string" || raw === "" || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }

  return out;
}

function serialize(entries: string[]): string {
  return JSON.stringify(entries);
}

/* -------------------------------------------------------------------------- */
/*                                 Historique                                 */
/* -------------------------------------------------------------------------- */

/**
 * Enregistre les dossiers d'une tâche.
 *
 * Un dossier déjà connu n'est pas dupliqué : il est remonté en tête. Un
 * dossier déjà en favori est ignoré — il a déjà sa place dans la rangée du
 * dessus.
 */
export async function recordSelection(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const state = await readState(true);
  const { maxEntries } = resolveConfig(state.settings);

  const pinned = new Set(parseList(state.favouritesJSON));

  const seen = new Set<string>();
  const fresh: string[] = [];

  for (const path of paths) {
    if (path === "" || seen.has(path) || pinned.has(path)) continue;
    seen.add(path);
    fresh.push(path);
  }

  if (fresh.length === 0) return;

  const kept = parseList(state.historyJSON).filter((p) => !seen.has(p));

  await writeLists({
    historyJSON: serialize([...fresh, ...kept].slice(0, maxEntries)),
  });
}

/** Vide l'historique. Les favoris ne sont pas touchés. */
export async function clearHistory(): Promise<void> {
  await writeLists({ historyJSON: serialize([]) });
}

/* -------------------------------------------------------------------------- */
/*                                   Favoris                                  */
/* -------------------------------------------------------------------------- */

/**
 * Épingle un dossier : il quitte l'historique et rejoint les favoris.
 *
 * L'ordre de stockage n'a pas d'importance — les favoris sont triés à
 * l'affichage — donc on ajoute simplement en fin de liste.
 */
export async function pin(path: string): Promise<void> {
  if (path === "") return;

  const state = await readState(true);
  const favourites = parseList(state.favouritesJSON);
  if (favourites.includes(path)) return;

  await writeLists({
    favouritesJSON: serialize([...favourites, path]),
    historyJSON: serialize(
      parseList(state.historyJSON).filter((p) => p !== path)
    ),
  });
}

/**
 * Désépingle un dossier : il quitte les favoris et revient en tête de
 * l'historique — il vient d'être manipulé, donc il est pertinent.
 */
export async function unpin(path: string): Promise<void> {
  if (path === "") return;

  const state = await readState(true);
  const favourites = parseList(state.favouritesJSON);
  if (!favourites.includes(path)) return;

  const { maxEntries } = resolveConfig(state.settings);
  const history = parseList(state.historyJSON).filter((p) => p !== path);

  await writeLists({
    favouritesJSON: serialize(favourites.filter((p) => p !== path)),
    historyJSON: serialize([path, ...history].slice(0, maxEntries)),
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Libellés                                  */
/* -------------------------------------------------------------------------- */

/** Dernier segment d'un chemin, séparateurs Windows et POSIX confondus. */
export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || trimmed || path;
}

/** Texte affiché sur le bouton d'un raccourci. */
export function formatLabel(path: string, showFullPath: boolean): string {
  return showFullPath ? path : basename(path);
}

/**
 * Infobulle d'un raccourci : le chemin complet, mais uniquement quand le
 * bouton n'affiche que le nom du dossier. Si le chemin complet est déjà à
 * l'écran, l'infobulle n'aurait rien à ajouter — on n'en met pas.
 */
export function formatTooltip(
  path: string,
  showFullPath: boolean
): string | undefined {
  return showFullPath ? undefined : path;
}

/**
 * Trie une liste sur le texte réellement affiché — nom de dossier en mode
 * compact, chemin complet sinon. Trier sur autre chose que ce que l'œil lit
 * donnerait un ordre qui a l'air aléatoire.
 *
 * `numeric` pour que "Saison 2" précède "Saison 10", `sensitivity: "base"`
 * pour ignorer casse et accents.
 */
export function sortForDisplay(
  paths: string[],
  showFullPath: boolean
): string[] {
  return [...paths].sort((a, b) =>
    formatLabel(a, showFullPath).localeCompare(
      formatLabel(b, showFullPath),
      undefined,
      { numeric: true, sensitivity: "base" }
    )
  );
}
