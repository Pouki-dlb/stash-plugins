/**
 * Point d'entrée du plugin.
 *
 * Stash charge ce fichier une fois l'interface prête, et expose son API sur
 * `window.PluginApi`. Tout part de là.
 *
 * Note sur les types : `TemplateFinalConfigMap`, `ISceneCardProps`, `Scene`...
 * ne sont importés nulle part. Les fichiers du dossier types/ sont des
 * déclarations globales : leurs types sont disponibles partout, sans import.
 */

import SceneCardBadge from "@components/SceneCardBadge";
import "./styles.scss";

const { PluginApi } = window;
const { GQL, React } = PluginApi;

/** Valeurs par défaut, appliquées quand l'utilisateur n'a pas touché l'option. */
const DEFAULT_BADGE_TEXT = "TEMPLATE";

/**
 * Ajoute un badge en bas de chaque carte de scène.
 *
 * Trois façons de modifier un composant de Stash :
 *   - patch.before  : insère du contenu avant le composant d'origine
 *   - patch.after   : insère du contenu après  (utilisé ici)
 *   - patch.instead : remplace complètement le composant d'origine
 *
 * `after` est le plus sûr pour commencer : l'affichage natif de Stash reste
 * intact, on ne fait qu'ajouter. `instead` est ce qu'utilise un plugin comme
 * ValkyrSceneCards, qui redessine la carte entière.
 *
 * La fonction doit renvoyer un TABLEAU d'éléments React, jamais un élément
 * seul. Renvoyer [] revient à n'ajouter rien.
 */
PluginApi.patch.after("SceneCard.Details", function (props) {
  // Lecture de la config du plugin. C'est un hook React : il doit être appelé
  // à chaque rendu, avant tout `return`.
  const qConfig = GQL.useConfigurationQuery();

  // Au premier rendu la config n'est pas encore arrivée. On n'affiche rien en
  // attendant plutôt que de risquer d'afficher une valeur erronée.
  if (qConfig.loading) return [];

  const userConfig: TemplateConfigMap | undefined =
    qConfig.data.configuration.plugins.StashPluginTemplate;

  // On transforme la config "pleine de trous" de Stash en config complète.
  // `??` prend la valeur de droite uniquement si celle de gauche est null ou
  // undefined - contrairement à `||`, qui écraserait aussi false, 0 ou "".
  const config: TemplateFinalConfigMap = {
    // Ici on veut justement écraser la chaîne vide, donc `||` est correct.
    badgeText: userConfig?.badgeText || DEFAULT_BADGE_TEXT,
    showBadge: userConfig?.showBadge ?? true,
  };

  if (!config.showBadge) return [];

  return [<SceneCardBadge scene={props.scene} text={config.badgeText} />];
});

/* -------------------------------------------------------------------------- */
/*                             Pour aller plus loin                            */
/* -------------------------------------------------------------------------- */

/**
 * Ajouter une page à part entière, accessible via une URL :
 *
 *   PluginApi.register.route("/plugin/ma-page", MonComposant);
 *
 * Réagir à un événement de Stash :
 *
 *   PluginApi.Event.addEventListener("stash:location", (e) => { ... });
 *
 * Interroger la base via GraphQL (une entrée par requête dans
 * types/stashPlugin.d.ts) :
 *
 *   const { data, loading } = GQL.useFindScenesQuery({
 *     variables: { filter: { per_page: 10 } },
 *   });
 *
 * Réutiliser un composant de Stash plutôt que de le réécrire :
 *
 *   const { HoverPopover, Icon } = PluginApi.components;
 */
