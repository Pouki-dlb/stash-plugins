import ShortcutBar from "@components/ShortcutBar";
import { readState, resolveConfig, QFState, UPDATE_EVENT } from "@helpers/config";
import {
  clearHistory,
  parseList,
  pin,
  sortForDisplay,
  unpin,
} from "@helpers/lists";

const { React } = window.PluginApi;

/**
 * Délai laissé à React pour committer la dernière sélection avant de cliquer
 * sur "Confirm" en mode autoRun. Le bouton reste désactivé tant que la liste
 * de chemins de la fenêtre est vide.
 */
const CONFIRM_DELAY_MS = 60;

/**
 * FolderSelect augmenté de deux rangées de raccourcis : les favoris épinglés
 * au-dessus, les dossiers récents en dessous.
 *
 * La difficulté : l'état `paths` de la fenêtre parente (DirectorySelectionDialog)
 * n'est pas exposé. Le seul moyen d'y ajouter un chemin est son bouton "+",
 * reçu ici dans `appendButton`, dont le onClick ajoute le répertoire *courant*
 * sans accepter d'argument.
 *
 * On pilote donc la fenêtre en deux temps, un chemin par cycle de rendu :
 *   1. appeler onChangeDirectory(chemin) — la fenêtre se re-rend et fabrique un
 *      nouveau bouton "+" dont la closure pointe sur ce chemin ;
 *   2. déclencher le onClick de ce nouveau bouton.
 */
const FolderSelectWithShortcuts: React.FC<FolderSelectWithShortcutsProps> = (
  props
) => {
  const { Original, ...folderProps } = props;
  const { currentDirectory, onChangeDirectory } = folderProps;

  const [state, setState] = React.useState<QFState | null>(null);
  /** Compteur servant uniquement à relancer l'effet d'injection. */
  const [tick, setTick] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  /** Chemins restant à injecter dans la sélection de la fenêtre. */
  const pendingRef = React.useRef<string[]>([]);
  /** Nombre de cycles restants avant abandon, pour ne jamais boucler. */
  const guardRef = React.useRef(0);
  const autoRunRef = React.useRef(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  /* ---------------------------- Chargement config --------------------------- */

  React.useEffect(() => {
    let alive = true;

    const load = (force: boolean) => {
      readState(force)
        .then((s) => {
          if (alive) setState(s);
        })
        .catch(() => {
          /* config illisible : les rangées restent simplement vides */
        });
    };

    // Relecture réseau à l'ouverture de la fenêtre, puis lecture du cache
    // mémoire à chaque écriture (tâche lancée, épinglage, historique vidé…).
    load(true);
    const onUpdate = () => load(false);
    window.addEventListener(UPDATE_EVENT, onUpdate);

    return () => {
      alive = false;
      window.removeEventListener(UPDATE_EVENT, onUpdate);
    };
  }, []);

  const config = resolveConfig(state?.settings);

  // Les favoris sont triés alphabétiquement ; l'ordre de stockage est celui
  // des épinglages et ne veut rien dire pour le lecteur.
  const favourites = React.useMemo(
    () => sortForDisplay(parseList(state?.favouritesJSON), config.showFullPath),
    [state, config.showFullPath]
  );

  // L'historique garde son ordre de stockage : le dernier ajouté est en tête.
  // La troncature réelle a lieu à l'écriture ; ce slice ne fait qu'aligner
  // l'affichage tout de suite après un changement du nombre de raccourcis.
  const history = React.useMemo(
    () => parseList(state?.historyJSON).slice(0, config.maxEntries),
    [state, config.maxEntries]
  );

  /* ------------------------------- Injection ------------------------------- */

  /** Clique sur le bouton de validation de la fenêtre, s'il est actif. */
  function confirmDialog() {
    const footer = rootRef.current
      ?.closest(".ModalComponent")
      ?.querySelector(".ModalFooter");
    if (!footer) return;

    // Le bouton d'acceptation est toujours le dernier du pied de fenêtre.
    const buttons = footer.querySelectorAll("button");
    const accept = buttons[buttons.length - 1] as HTMLButtonElement | undefined;
    if (accept && !accept.disabled) accept.click();
  }

  function finish(completed: boolean) {
    pendingRef.current = [];
    guardRef.current = 0;
    setBusy(false);
    // Remet le navigateur sur les racines de la bibliothèque.
    onChangeDirectory("");

    const auto = autoRunRef.current;
    autoRunRef.current = false;
    if (completed && auto) window.setTimeout(confirmDialog, CONFIRM_DELAY_MS);
  }

  React.useEffect(() => {
    const queue = pendingRef.current;
    if (queue.length === 0) return;

    if (guardRef.current <= 0) {
      finish(false);
      return;
    }
    guardRef.current -= 1;

    const next = queue[0];

    // Étape 1 : amener la fenêtre sur ce chemin.
    if (currentDirectory !== next) {
      onChangeDirectory(next);
      return;
    }

    // Étape 2 : le bouton "+" de ce rendu pointe maintenant sur `next`.
    queue.shift();
    folderProps.appendButton?.props?.onClick?.();

    if (queue.length === 0) finish(true);
    else setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDirectory, tick]);

  /* -------------------------------- Actions -------------------------------- */

  function applyEntry(path: string) {
    if (busy || path === "") return;

    // La file reste générale, même si une entrée ne porte qu'un dossier :
    // c'est elle qui absorbe le passage obligé par le bouton "+" de la fenêtre.
    pendingRef.current = [path];
    // Deux cycles par chemin en régime normal ; on double la marge.
    guardRef.current = pendingRef.current.length * 4 + 4;
    autoRunRef.current = config.autoRun;
    setBusy(true);
    setTick((t) => t + 1);
  }

  return (
    <>
      <div className="qf-root" ref={rootRef}>
        <ShortcutBar
          title="Favourites"
          paths={favourites}
          favourite
          showFullPath={config.showFullPath}
          disabled={busy}
          onApply={applyEntry}
          onToggle={(path) => void unpin(path)}
        />
        <ShortcutBar
          title="Recent folders"
          paths={history}
          favourite={false}
          showFullPath={config.showFullPath}
          disabled={busy}
          headerAction={{
            label: "Clear history",
            onClick: () => void clearHistory(),
          }}
          onApply={applyEntry}
          onToggle={(path) => void pin(path)}
        />
      </div>
      <Original {...folderProps} />
    </>
  );
};

type FolderSelectWithShortcutsProps = IFolderSelectProps & {
  /** Le FolderSelect d'origine, fourni par PluginApi.patch.instead. */
  Original: React.FC<IFolderSelectProps>;
};

export default FolderSelectWithShortcuts;
