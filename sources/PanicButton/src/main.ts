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
  // Pas d'Escape : voir LEGACY_ESCAPE_SETTING. Le numéro 07 reste libre.
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

/**
 * L'ancienne case à cocher d'Escape, retirée du manifeste en 2.1.0.
 *
 * En plein écran, le navigateur se réserve Escape pour en sortir et ne
 * transmet pas l'événement à la page — délibérément, pour qu'un site ne puisse
 * pas y retenir son visiteur. L'écouteur n'est donc jamais appelé, et aucun
 * preventDefault n'y change quoi que ce soit : le premier appui ne fait que
 * quitter le plein écran, il en faut un second pour masquer.
 *
 * Le défaut tombe exactement sur la situation où le plugin sert le plus, donc
 * la touche n'est plus proposée. Elle reste saisissable dans le champ libre,
 * pour qui la veut en connaissance de cause.
 */
const LEGACY_ESCAPE_SETTING = "07keyEscape";

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
 * Écrit la configuration du plugin.
 *
 * `input` doit toujours être la configuration *entière* : côté serveur,
 * SetPluginConfiguration remplace la map du plugin au lieu de la compléter
 * ("It will overwrite any existing configuration"). Une écriture partielle
 * efface tout le reste.
 */
async function writeConfig(input: PanicConfigMap): Promise<void> {
  await graphql(
    `mutation ($id: ID!, $input: Map!) {
      configurePlugin(plugin_id: $id, input: $input)
    }`,
    { id: PLUGIN_ID, input }
  );
}

/**
 * Inscrit les réglages par défaut dans Stash, une seule fois.
 *
 * Appelé uniquement quand le plugin n'a encore aucune configuration
 * enregistrée — sur une config existante, l'écrasement décrit au-dessus
 * effacerait les choix de l'utilisateur.
 */
async function seedDefaultConfig(): Promise<void> {
  try {
    await writeConfig(SEED_CONFIG);
    console.info(
      "[PanicButton] First run: the backquote key has been ticked in the plugin settings."
    );
  } catch (err) {
    // Sans importance immédiate : les valeurs par défaut sont déjà appliquées
    // en mémoire pour cette session, seule la case restera décochée.
    console.warn("[PanicButton] Could not write the default settings.", err);
  }
}

/**
 * Déplace une case Escape cochée vers le champ libre, puis la supprime.
 *
 * Sans ça, la case ayant disparu du manifeste, la valeur enregistrée resterait
 * dans le config.yml sans que plus personne ne la lise : la touche panique de
 * ceux qui l'avaient choisie cesserait de fonctionner, sans que rien ne le
 * leur dise. Le pire mode de défaillance pour ce plugin.
 *
 * Le déplacement rend aussi le choix visible et modifiable : la touche
 * apparaît en toutes lettres dans les réglages, là où une case disparue ne
 * laisse rien à décocher.
 *
 * Modifie `stored` sur place et rend vrai s'il y a lieu de l'enregistrer.
 */
function unpackLegacyEscape(stored: PanicConfigMap): boolean {
  if (!stored[LEGACY_ESCAPE_SETTING]) return false;

  const custom = (stored["22customTriggerKeys"] ?? "").trim();
  const alreadyListed = custom
    .split(",")
    .some((raw) => raw.trim().toLowerCase() === "escape");

  delete stored[LEGACY_ESCAPE_SETTING];
  if (!alreadyListed) {
    stored["22customTriggerKeys"] = custom ? `${custom}, Escape` : "Escape";
  }

  return true;
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
    } else if (unpackLegacyEscape(stored)) {
      // `stored` est déjà à jour, donc les raccourcis résolus plus bas tiennent
      // compte d'Escape sans attendre la réponse du serveur.
      writeConfig(stored)
        .then(() =>
          console.info(
            '[PanicButton] The Escape tick box is gone. "Escape" has been moved ' +
              "to the additional trigger keys, where you can remove it."
          )
        )
        .catch((err) =>
          console.warn("[PanicButton] Could not move the Escape setting.", err)
        );
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

/**
 * Sort du plein écran, s'il y en a un.
 *
 * Le navigateur ne peint que l'élément passé en plein écran et ses
 * descendants. Notre écran, accroché au <body>, est bien créé mais reste
 * invisible tant qu'on y est : il n'apparaît qu'à la sortie.
 *
 * La sortie est asynchrone — l'image reste donc affichée le temps de la
 * transition — mais elle rend aussi la barre d'onglets au navigateur, sans
 * laquelle le déguisement du titre et du favicon ne sert à rien.
 *
 * Le préfixe webkit couvre les Safari antérieurs à 16.4.
 */
function exitFullscreen(): void {
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => void;
  };

  if (doc.fullscreenElement) {
    // La promesse est rejetée si plus rien n'est en plein écran au moment où
    // elle s'exécute. Sans conséquence, mais il faut l'absorber.
    void doc.exitFullscreen().catch(() => {});
    return;
  }

  if (doc.webkitFullscreenElement) doc.webkitExitFullscreen?.();
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
 * Les actions du masquage sont isolées les unes des autres.
 *
 * Elles sont exécutées de la plus importante à la moins importante, et chacune
 * dans son propre try/catch : si la mise en pause échoue sur une vidéo exotique
 * ou si le déguisement de l'onglet se heurte à un DOM inattendu, l'écran est
 * quand même affiché. Une seule chose ne doit jamais échouer, et c'est elle.
 *
 * La sortie de plein écran vient avant la création de l'écran, pour laisser au
 * navigateur le plus d'avance possible sur sa transition — c'est elle qui
 * décide du moment où l'écran devient réellement visible.
 */
function hide(): void {
  if (hidden) return;
  hidden = true;

  try {
    pauseAllMedia();
  } catch (err) {
    console.warn("[PanicButton] Could not pause every video.", err);
  }

  try {
    exitFullscreen();
  } catch (err) {
    console.warn("[PanicButton] Could not leave fullscreen.", err);
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
