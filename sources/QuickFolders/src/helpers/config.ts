/**
 * Lecture / écriture de la configuration du plugin côté serveur Stash.
 *
 * Tout vit dans la section du plugin (`configuration.plugins.QuickFolders`) :
 * les réglages déclarés dans le manifeste, plus deux clés `history` et
 * `favourites` qui ne le sont pas — et qui n'apparaissent donc pas dans
 * Settings > Plugins. Le plugin reste ainsi entièrement contenu dans sa propre
 * section de la config Stash.
 *
 * Conséquence assumée : modifier un réglage depuis Settings > Plugins fait
 * reculer les deux listes. Le panneau de réglages prend un instantané unique de
 * `configuration.plugins` à son montage (commentaire "only initialise once"
 * dans ui/v2.5/src/components/Settings/context.tsx) et renvoie cet instantané à
 * `configurePlugin`, qui remplace toute la map. Tout ce qui a été enregistré
 * depuis est perdu — y compris des favoris. Voir le README.
 *
 * On passe par des requêtes GraphQL brutes plutôt que par PluginApi.GQL :
 * l'intercepteur de tâches tourne en dehors de tout composant React, donc les
 * hooks Apollo ne sont pas utilisables. C'est la même approche que PanicButton.
 */

/**
 * Identifiant du plugin. Stash le déduit du nom du fichier .yml installé, donc
 * il doit rester synchronisé avec `pluginID` dans webpack.common.js.
 */
export const PLUGIN_ID = "QuickFolders";

/** Clés des deux listes dans la config du plugin. Non déclarées dans le .yml. */
export const HISTORY_KEY = "history";
export const FAVOURITES_KEY = "favourites";

/** Événement émis sur window après chaque écriture réussie. */
export const UPDATE_EVENT = "quick-folders:updated";

/**
 * Référence au fetch natif, capturée à l'évaluation du module — c'est-à-dire
 * avant que installScanInterceptor() ne remplace window.fetch. Nos propres
 * requêtes ne repassent donc pas par l'intercepteur.
 */
const nativeFetch: typeof window.fetch = window.fetch.bind(window);

/** Reproduit getPlatformURL() de Stash, qui tient compte du <base href>. */
function graphqlURL(): string {
  const baseURL = document.querySelector("base")?.getAttribute("href") ?? "/";
  const url = new URL(window.location.origin + baseURL);
  url.pathname += "graphql";
  return url.toString();
}

async function gql<T>(query: string, variables?: object): Promise<T | null> {
  const res = await nativeFetch(graphqlURL(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return (json?.data as T) ?? null;
}

const READ_QUERY = `query { configuration { plugins } }`;

const WRITE_MUTATION = `mutation ($id: ID!, $input: Map!) {
  configurePlugin(plugin_id: $id, input: $input)
}`;

/** Ce que le plugin a besoin de connaître de la configuration Stash. */
export interface QFState {
  /** Les réglages déclarés dans le manifeste. */
  settings: QFConfigMap;
  /** L'historique sérialisé, ou null s'il n'y en a pas encore. */
  historyJSON: string | null;
  /** Les favoris sérialisés, ou null s'il n'y en a pas encore. */
  favouritesJSON: string | null;
}

/** Ce qu'une écriture peut modifier. Une clé absente n'est pas touchée. */
export interface QFListPatch {
  historyJSON?: string;
  favouritesJSON?: string;
}

/** Dernier état lu, pour éviter un aller-retour réseau à chaque affichage. */
let cache: QFState | null = null;

function asJSON(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Lit les réglages et les deux listes. `force` ignore le cache mémoire. */
export async function readState(force = false): Promise<QFState> {
  if (cache && !force) return cache;

  const data = await gql<{
    configuration: { plugins?: Record<string, QFConfigMap> };
  }>(READ_QUERY);

  const settings = data?.configuration?.plugins?.[PLUGIN_ID] ?? {};

  cache = {
    settings,
    historyJSON: asJSON(settings.history),
    favouritesJSON: asJSON(settings.favourites),
  };
  return cache;
}

/**
 * Chaîne de promesses garantissant qu'une seule écriture est en vol à la fois.
 * `configurePlugin` remplace toute la map du plugin : deux écritures
 * concurrentes se marcheraient dessus.
 */
let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Enregistre une ou les deux listes.
 *
 * La config est systématiquement relue juste avant l'écriture, pour conserver
 * les réglages et la liste non modifiée tels qu'ils sont réellement
 * enregistrés côté serveur.
 */
export function writeLists(patch: QFListPatch): Promise<void> {
  const run = async () => {
    const current = await readState(true);

    const historyJSON = patch.historyJSON ?? current.historyJSON;
    const favouritesJSON = patch.favouritesJSON ?? current.favouritesJSON;

    const input: QFConfigMap = {
      ...current.settings,
      [HISTORY_KEY]: historyJSON ?? "",
      [FAVOURITES_KEY]: favouritesJSON ?? "",
    };

    const data = await gql<{ configurePlugin: QFConfigMap }>(WRITE_MUTATION, {
      id: PLUGIN_ID,
      input,
    });
    if (data === null) return;

    cache = { settings: input, historyJSON, favouritesJSON };
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  };

  writeQueue = writeQueue.then(run, run);
  return writeQueue as Promise<void>;
}

const DEFAULTS: QFConfig = {
  maxEntries: 8,
  autoRun: false,
  showFullPath: false,
};

/** Borne haute volontairement basse : au-delà, la barre devient illisible. */
const MAX_ENTRIES_LIMIT = 20;

/**
 * Applique les valeurs par défaut et assainit les réglages.
 *
 * Tout ce qui n'est pas un entier >= 1 retombe sur la valeur par défaut :
 * chaîne non numérique, NaN (ce que produit l'UI de Stash quand on tape des
 * lettres, via Number.parseInt), zéro, négatif, ou fraction < 1 saisie
 * directement dans le config.yml. Sans ce garde-fou, un maxEntries à 0
 * tronquerait l'historique à chaque écriture.
 *
 * Ne concerne que l'historique : les favoris n'ont pas de plafond.
 */
export function resolveConfig(settings?: QFConfigMap | null): QFConfig {
  const parsed = Math.floor(Number(settings?.maxEntries));

  return {
    maxEntries:
      Number.isFinite(parsed) && parsed >= 1
        ? Math.min(parsed, MAX_ENTRIES_LIMIT)
        : DEFAULTS.maxEntries,
    // Une valeur bricolée à la main dans le config.yml (la chaîne "false", par
    // exemple) ne doit pas être prise pour un booléen.
    autoRun:
      typeof settings?.autoRun === "boolean"
        ? settings.autoRun
        : DEFAULTS.autoRun,
    showFullPath:
      typeof settings?.showFullPath === "boolean"
        ? settings.showFullPath
        : DEFAULTS.showFullPath,
  };
}
