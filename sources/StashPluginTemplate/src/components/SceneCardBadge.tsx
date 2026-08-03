/**
 * Un composant d'exemple : le badge ajouté en bas des cartes de scène.
 *
 * Il montre la structure type d'un composant du plugin :
 *   1. React récupéré depuis PluginApi (surtout pas importé depuis "react")
 *   2. le composant lui-même
 *   3. l'interface décrivant ses props, juste en dessous
 *
 * Supprime ce fichier une fois que tu construis ta propre fonctionnalité.
 */

const { React } = window.PluginApi;

const SceneCardBadge: React.FC<SceneCardBadgeProps> = ({ scene, text }) => {
  // Un composant peut décider de ne rien afficher en renvoyant null.
  if (!text) return null;

  return (
    <div className="spt-badge">
      <span className="spt-badge__text">{text}</span>
      {/* `scene` est entièrement typé : essaie d'écrire "scene." dans ton
          éditeur, il te proposera tous les champs disponibles. */}
      <span className="spt-badge__id">#{scene.id}</span>
    </div>
  );
};

export default SceneCardBadge;

interface SceneCardBadgeProps {
  /** Les données de la scène, telles que Stash les fournit à la carte. */
  scene: Scene;
  /** Le texte affiché dans le badge. */
  text: string;
}
