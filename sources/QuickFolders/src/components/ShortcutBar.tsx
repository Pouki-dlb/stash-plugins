import { formatLabel, formatTooltip } from "@helpers/lists";

const { React } = window.PluginApi;
const { Button } = window.PluginApi.libraries.Bootstrap;
const { FontAwesomeIcon } = window.PluginApi.libraries.ReactFontAwesome;
const { faThumbtack } = window.PluginApi.libraries.FontAwesomeSolid;

/**
 * Une rangée de raccourcis. Le composant sert aux deux listes : les favoris
 * au-dessus, l'historique en dessous.
 *
 * Ne rend rien quand la liste est vide, pour ne pas encombrer la fenêtre.
 */
const ShortcutBar: React.FC<ShortcutBarProps> = ({
  title,
  paths,
  favourite,
  showFullPath,
  disabled,
  headerAction,
  onApply,
  onToggle,
}) => {
  if (paths.length === 0) return null;

  return (
    <div className={favourite ? "qf-bar qf-bar--fav" : "qf-bar"}>
      <div className="qf-bar-header">
        <span className="qf-bar-title">{title}</span>
        {headerAction && (
          <button
            type="button"
            className="qf-bar-action"
            onClick={headerAction.onClick}
            disabled={disabled}
          >
            {headerAction.label}
          </button>
        )}
      </div>

      <div className="qf-bar-chips">
        {paths.map((path) => (
          // Le modificateur est porté par la pastille elle-même, pas déduit de
          // la rangée qui la contient : son apparence ne dépend pas du contexte.
          <div
            className={favourite ? "qf-chip qf-chip--fav" : "qf-chip"}
            key={path}
          >
            <Button
              className="qf-chip-apply"
              variant="secondary"
              size="sm"
              title={formatTooltip(path, showFullPath)}
              disabled={disabled}
              onClick={() => onApply(path)}
            >
              {formatLabel(path, showFullPath)}
            </Button>
            <Button
              className="qf-chip-pin"
              variant="secondary"
              size="sm"
              title={favourite ? "Unpin this folder" : "Pin this folder"}
              disabled={disabled}
              onClick={() => onToggle(path)}
            >
              {/* Convention reprise de Stash : punaise droite = épinglé,
                  penchée = à épingler (cf. EditFilterDialog). */}
              <FontAwesomeIcon
                icon={faThumbtack}
                className={favourite ? "fa-icon" : "fa-icon qf-tilted"}
              />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ShortcutBarProps {
  title: string;
  paths: string[];
  /** Vrai pour la rangée des favoris : change le style et l'action de l'épingle. */
  favourite: boolean;
  /** Afficher les chemins complets plutôt que le seul nom de dossier. */
  showFullPath: boolean;
  /** Vrai pendant qu'un dossier est en cours d'injection. */
  disabled: boolean;
  /** Lien optionnel à droite du titre. */
  headerAction?: { label: string; onClick: () => void };
  onApply: (path: string) => void;
  /** Épingle ou désépingle, selon la rangée. */
  onToggle: (path: string) => void;
}

export default ShortcutBar;
