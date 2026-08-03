/**
 * Panic Button - masque instantanément ce qui est à l'écran.
 *
 * Trois actions déclenchées par une seule touche :
 *   1. mise en pause de toute vidéo en cours de lecture
 *   2. affichage d'un écran opaque (couleur unie ou image personnalisée)
 *   3. remplacement du titre et de l'icône de l'onglet
 *
 * Le plugin ne passe pas par React : il installe un écouteur clavier sur le
 * document et manipule le DOM directement. C'est volontaire — il doit rester
 * actif partout dans Stash, y compris sur les pages qu'il ne connaît pas.
 */

import "./styles.scss";

/* -------------------------------------------------------------------------- */
/*                                    Config                                  */
/* -------------------------------------------------------------------------- */

/** Doit rester identique au pluginID de webpack.common.js, sans point
 * d'exclamation : c'est la clé sous laquelle Stash range les réglages. Le nom
 * affiché à l'utilisateur est défini par "name:" dans src/source.yml. */
const PLUGIN_ID = "PanicButton";

/** GIF transparent de 1x1 pixel, utilisé comme favicon "vide" par défaut. */
const BLANK_FAVICON =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const DEFAULTS: PanicConfig = {
  disguiseFaviconUrl: "",
  disguiseTitle: "New Tab",
  overlayColor: "#000000",
  overlayImageUrl: "",
};

/**
 * Les touches proposées en case à cocher dans les réglages.
 *
 * À garder aligné sur les options "key..." de src/source.yml et sur le type
 * PanicTriggerSetting. Ajouter une touche = une entrée ici, une option là-bas,
 * une valeur dans le type. Si tu en oublies une, le build le signale.
 */
const TRIGGER_KEYS: TriggerKeyOption[] = [
  { setting: "05keyBackquote", key: "Backquote" },
  { setting: "06keyInsert", key: "Insert" },
  { setting: "07keyEscape", key: "Escape" },
  { setting: "08keyPause", key: "Pause" },
  { setting: "09keyScrollLock", key: "ScrollLock" },
  { setting: "10keyF01", key: "F1" },
  { setting: "11keyF02", key: "F2" },
  { setting: "12keyF03", key: "F3" },
  { setting: "13keyF04", key: "F4" },
  { setting: "14keyF05", key: "F5" },
  { setting: "15keyF06", key: "F6" },
  { setting: "16keyF07", key: "F7" },
  { setting: "17keyF08", key: "F8" },
  { setting: "18keyF09", key: "F9" },
  { setting: "19keyF10", key: "F10" },
  // Pas de F11 ni F12 : le navigateur se les réserve (plein écran, outils de
  // développement) et preventDefault n'y peut rien. Elles restent saisissables
  // dans le champ libre pour qui veut essayer.
];

/**
 * Les réglages écrits dans Stash au tout premier lancement.
 *
 * Le manifeste ne permet pas de déclarer une valeur par défaut : la structure
 * SettingConfig de Stash n'accepte que type, displayName et description. Une
 * case reste donc décochée tant que personne n'y a touché.
 *
 * Plutôt que de traiter la touche par défaut comme un cas particulier dans le
 * code — ce qui donnait une case décochée pour une touche active —, le plugin
 * écrit lui-même ce réglage la première fois. La case est cochée pour de bon,
 * et tout le reste du code peut se fier à ce qu'affiche l'interface.
 *
 * Backquote plutôt qu'une touche de fonction : elle est immédiate sur un
 * clavier Mac, là où F1-F12 exigent la touche Fn par défaut.
 */
const SEED_CONFIG: PanicConfigMap = { "05keyBackquote": true };

let config: PanicConfig = { ...DEFAULTS };

/** Tous les raccourcis actifs. Peut être vide : c'est un état valide, qui
 * revient à désactiver le plugin sans le désinstaller. */
let hotkeys: Hotkey[] = resolveHotkeys(SEED_CONFIG);

/* ----------------------------- Validation ---------------------------------- */

/** Le navigateur accepte-t-il cette valeur comme couleur CSS ? */
function isValidColor(value: string): boolean {
  // CSS.supports existe partout depuis longtemps ; en cas d'absence on laisse
  // passer, la couche noire de secours protège de toute façon.
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function")
    return true;
  return CSS.supports("color", value);
}

/**
 * Valide la couleur saisie, et répare l'oubli du dièse au passage.
 *
 * Indispensable : affecter une couleur invalide à element.style ne lève
 * aucune erreur, la déclaration est simplement ignorée. Sans ce contrôle,
 * "000000" produisait un écran transparent — qui bloquait les clics tout en
 * laissant la page visible.
 */
function normaliseColor(raw: string): string {
  const input = raw.trim();
  if (!input) return DEFAULTS.overlayColor;

  if (isValidColor(input)) return input;

  // Cas le plus fréquent : le dièse manque. "000000" -> "#000000".
  if (/^[0-9a-f]{3,8}$/i.test(input) && isValidColor("#" + input)) {
    console.info(
      `[PanicButton] Overlay colour "${input}" is missing its "#". Using "#${input}".`
    );
    return "#" + input;
  }

  console.warn(
    `[PanicButton] "${input}" is not a valid CSS colour. ` +
      `Falling back to ${DEFAULTS.overlayColor}.`
  );
  return DEFAULTS.overlayColor;
}

/**
 * Charge l'image en amont, ce qui remplit deux rôles.
 *
 * Elle est mise en cache par le navigateur avant le premier déclenchement :
 * l'écran s'affiche donc instantanément, même si le réseau est lent ou tombe
 * entre-temps. Et si l'URL est injoignable, l'utilisateur est prévenu tout de
 * suite plutôt que de le découvrir au mauvais moment.
 */
function preloadOverlayImage(url: string): void {
  const img = new Image();
  img.onerror = () =>
    console.warn(
      `[PanicButton] The overlay image could not be loaded from "${url}". ` +
        `The overlay will fall back to the overlay colour.`
    );
  img.src = url;
}

/** Construit la liste des raccourcis à partir des réglages. */
function resolveHotkeys(stored: PanicConfigMap): Hotkey[] {
  const result: Hotkey[] = [];

  // Les cases à cocher. Aucun cas particulier : une case cochée active la
  // touche, une case décochée ne l'active pas. Les valeurs par défaut sont
  // écrites dans Stash au premier lancement, cf. SEED_CONFIG.
  for (const { setting, key } of TRIGGER_KEYS) {
    if (stored[setting]) result.push(parseHotkey(key));
  }

  // Le champ libre, qui accepte plusieurs entrées séparées par des virgules.
  for (const raw of (stored["22customTriggerKeys"] ?? "").split(",")) {
    const trimmed = raw.trim();
    if (trimmed.length > 0) result.push(parseHotkey(trimmed));
  }

  return result;
}

/**
 * Envoie une requête à l'API GraphQL de Stash.
 *
 * On l'interroge directement plutôt que par les hooks de PluginApi : ceux-ci
 * n'existent qu'à l'intérieur d'un composant React, alors que ce plugin doit
 * fonctionner en dehors de l'arbre React.
 */
async function graphql(
  query: string,
  variables?: Record<string, unknown>
): Promise<any> {
  const res = await fetch(window.location.origin + "/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

/**
 * Inscrit les réglages par défaut dans Stash, une seule fois.
 *
 * Appelé uniquement quand le plugin n'a encore aucune configuration
 * enregistrée. C'est indispensable : la mutation configurePlugin remplace la
 * totalité de la configuration du plugin, elle ne la complète pas. L'appeler
 * sur une config existante effacerait les choix de l'utilisateur.
 */
async function seedDefaultConfig(): Promise<void> {
  try {
    await graphql(
      `mutation ($id: ID!, $input: Map!) {
        configurePlugin(plugin_id: $id, input: $input)
      }`,
      { id: PLUGIN_ID, input: SEED_CONFIG }
    );
    console.info(
      "[PanicButton] First run: the backquote key has been ticked in the plugin settings."
    );
  } catch (err) {
    // Sans importance immédiate : les valeurs par défaut sont déjà appliquées
    // en mémoire pour cette session, seule la case restera décochée.
    console.warn("[PanicButton] Could not write the default settings.", err);
  }
}

/** Récupère la config du plugin, et l'initialise au premier lancement. */
async function loadConfig(): Promise<void> {
  try {
    const json = await graphql("query { configuration { plugins } }");

    const stored: PanicConfigMap =
      json?.data?.configuration?.plugins?.[PLUGIN_ID] ?? {};

    // Aucune clé enregistrée : le plugin vient d'être installé.
    if (Object.keys(stored).length === 0) {
      Object.assign(stored, SEED_CONFIG);
      void seedDefaultConfig();
    }

    config = {
      // `||` pour les chaînes, afin qu'un champ vidé retombe sur le défaut.
      disguiseFaviconUrl:
        stored["04disguiseFaviconUrl"] || DEFAULTS.disguiseFaviconUrl,
      disguiseTitle: stored["03disguiseTitle"] || DEFAULTS.disguiseTitle,
      overlayColor: normaliseColor(
        stored["01overlayColor"] || DEFAULTS.overlayColor
      ),
      overlayImageUrl:
        stored["02overlayImageUrl"] || DEFAULTS.overlayImageUrl,
    };

    if (config.overlayImageUrl) preloadOverlayImage(config.overlayImageUrl);

    hotkeys = resolveHotkeys(stored);

    if (hotkeys.length === 0) {
      console.info(
        "[PanicButton] No trigger key is enabled, so the plugin will do nothing. " +
          "Tick at least one key under Settings > Plugins > PanicButton!"
      );
    }
  } catch (err) {
    // En cas d'échec on garde les valeurs par défaut : mieux vaut un raccourci
    // inattendu qu'un bouton panique inopérant.
    console.warn("[PanicButton] Could not load settings, using defaults.", err);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Raccourci                                 */
/* -------------------------------------------------------------------------- */

/**
 * Décompose une chaîne du type "ctrl+shift+h" en raccourci exploitable.
 * La dernière partie est la touche, les précédentes sont les modificateurs.
 */
function parseHotkey(raw: string): Hotkey {
  const parts = raw
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);

  const key = parts.pop() ?? "f9";

  return {
    key,
    alt: parts.includes("alt"),
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    meta: parts.includes("meta") || parts.includes("cmd"),
    shift: parts.includes("shift"),
  };
}

/** L'utilisateur est-il en train de saisir du texte ? */
function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/** Un raccourci se réduit-il à un caractère isolé, sans modificateur ? */
function isBareCharacter(hk: Hotkey): boolean {
  return hk.key.length === 1 && !hk.alt && !hk.ctrl && !hk.meta;
}

function matchesHotkey(e: KeyboardEvent, hk: Hotkey): boolean {
  if (e.altKey !== hk.alt) return false;
  if (e.ctrlKey !== hk.ctrl) return false;
  if (e.metaKey !== hk.meta) return false;

  // Shift demandé explicitement : il est exigé.
  if (hk.shift && !e.shiftKey) return false;
  // Shift non demandé : on le refuse sur les touches nommées (F9, Escape),
  // mais on le tolère sur un caractère isolé, car beaucoup de dispositions
  // exigent déjà Shift pour le produire.
  if (!hk.shift && hk.key.length > 1 && e.shiftKey) return false;

  // On accepte KeyboardEvent.key ("p", "F9", "Escape") comme
  // KeyboardEvent.code ("KeyP", "F9", "Backquote"), ce qui rend le réglage
  // tolérant à la façon dont l'utilisateur nomme sa touche.
  return e.key.toLowerCase() === hk.key || e.code.toLowerCase() === hk.key;
}

/* -------------------------------------------------------------------------- */
/*                                   Masquage                                 */
/* -------------------------------------------------------------------------- */

let hidden = false;
let overlay: HTMLDivElement | null = null;
let savedTitle = "";
/** Les <link rel="icon"> d'origine, avec leur href, pour pouvoir les rétablir. */
let savedFavicons: { el: HTMLLinkElement; href: string }[] = [];

/**
 * Met en pause tout ce qui joue. Comportement systématique, sans réglage :
 * masquer l'écran en laissant le son continuer n'aurait aucun sens.
 *
 * On vise les éléments <video> et <audio> bruts. Le lecteur de Stash repose
 * sur video.js, mais celui-ci pilote un <video> classique en dessous : le
 * mettre en pause suffit, et couvre aussi les aperçus des cartes de scène.
 */
function pauseAllMedia(): void {
  document
    .querySelectorAll<HTMLMediaElement>("video, audio")
    .forEach((media) => {
      if (!media.paused) media.pause();
    });
}

function buildOverlay(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "panic-overlay";

  // La couleur et l'image vont sur une couche interne, jamais sur l'élément
  // racine : celui-ci garde son fond noir opaque quoi qu'il arrive. Voir le
  // commentaire en tête de styles.scss.
  const surface = document.createElement("div");
  surface.className = "panic-overlay__surface";
  surface.style.backgroundColor = config.overlayColor;

  if (config.overlayImageUrl) {
    // JSON.stringify échappe les guillemets, ce qui évite qu'une URL mal
    // formée ne casse la déclaration CSS.
    surface.style.backgroundImage = `url(${JSON.stringify(
      config.overlayImageUrl
    )})`;
  }

  el.appendChild(surface);
  return el;
}

function disguiseTab(): void {
  savedTitle = document.title;
  document.title = config.disguiseTitle;

  const links = document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']");
  savedFavicons = Array.from(links).map((el) => ({
    el,
    href: el.getAttribute("href") ?? "",
  }));

  const disguised = config.disguiseFaviconUrl || BLANK_FAVICON;

  if (savedFavicons.length) {
    savedFavicons.forEach(({ el }) => el.setAttribute("href", disguised));
  } else {
    // Aucune icône déclarée : on en ajoute une, retirée au moment du retour.
    const el = document.createElement("link");
    el.rel = "icon";
    el.href = disguised;
    el.dataset.panicButton = "true";
    document.head.appendChild(el);
  }
}

function restoreTab(): void {
  document.title = savedTitle;
  savedFavicons.forEach(({ el, href }) => el.setAttribute("href", href));
  savedFavicons = [];

  document
    .querySelectorAll("link[data-panic-button]")
    .forEach((el) => el.remove());
}

/**
 * Les trois actions du masquage sont isolées les unes des autres.
 *
 * Elles sont exécutées de la plus importante à la moins importante, et chacune
 * dans son propre try/catch : si la mise en pause échoue sur une vidéo exotique
 * ou si le déguisement de l'onglet se heurte à un DOM inattendu, l'écran est
 * quand même affiché. Une seule chose ne doit jamais échouer, et c'est elle.
 */
function hide(): void {
  if (hidden) return;
  hidden = true;

  try {
    pauseAllMedia();
  } catch (err) {
    console.warn("[PanicButton] Could not pause every video.", err);
  }

  // L'écran d'abord, sans filet : s'il échoue, il n'y a rien à sauver.
  overlay = buildOverlay();
  // Ajouté à <body> et non dans l'arbre React : Stash peut re-rendre ses
  // composants sans faire disparaître l'écran.
  (document.body ?? document.documentElement).appendChild(overlay);

  try {
    disguiseTab();
  } catch (err) {
    console.warn("[PanicButton] Could not disguise the tab.", err);
  }
}

function reveal(): void {
  if (!hidden) return;
  hidden = false;

  // Le retrait de l'écran passe en premier et hors try/catch de la restauration
  // de l'onglet : une erreur sur celle-ci ne doit pas laisser l'utilisateur
  // coincé derrière un écran qu'il ne peut plus enlever.
  overlay?.remove();
  overlay = null;

  try {
    restoreTab();
  } catch (err) {
    console.warn("[PanicButton] Could not restore the tab.", err);
  }
}

function toggle(): void {
  if (hidden) reveal();
  else hide();
}

/* -------------------------------------------------------------------------- */
/*                                  Démarrage                                 */
/* -------------------------------------------------------------------------- */

function onKeyDown(e: KeyboardEvent): void {
  // Une touche unique sans modificateur ne doit pas se déclencher pendant la
  // saisie d'une recherche ou d'un titre. La garde ne s'applique pas quand
  // l'écran est déjà masqué : on ne doit jamais pouvoir rester bloqué dessus.
  const typing = !hidden && isTyping();

  const matched = hotkeys.some(
    (hk) => !(typing && isBareCharacter(hk)) && matchesHotkey(e, hk)
  );

  if (!matched) return;

  // Empêche Stash d'agir sur la même touche via ses propres raccourcis.
  e.preventDefault();
  e.stopPropagation();

  toggle();
}

// Écouteur posé en phase de capture (le `true` final) : on passe donc avant
// les raccourcis de Stash, et non après.
document.addEventListener("keydown", onKeyDown, true);

// L'écouteur est actif immédiatement avec les valeurs par défaut ; la config
// de l'utilisateur vient l'ajuster dès qu'elle arrive. Un bouton panique ne
// doit jamais avoir de fenêtre d'indisponibilité au chargement.
void loadConfig();
