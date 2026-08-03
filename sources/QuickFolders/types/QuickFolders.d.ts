/**
 * Types propres au plugin QuickFolders.
 *
 * Ce fichier ne contient ni import ni export : il est donc traité comme un
 * script global, et ses types sont visibles partout dans src/ sans import.
 */

/**
 * Les réglages tels que Stash les renvoie : tout est optionnel, car une clé
 * n'existe que si l'utilisateur y a touché au moins une fois.
 */
interface QFConfigMap {
  maxEntries?: number;
  autoRun?: boolean;
  showFullPath?: boolean;
  /**
   * Les deux listes, chacune sérialisée en un simple tableau JSON de chemins.
   * Clés non déclarées dans le .yml, donc invisibles dans Settings > Plugins.
   *
   * Aucune date, aucune provenance, aucun numéro de version : l'historique
   * tire sa chronologie de l'ordre du tableau — le dernier ajouté en tête — et
   * les favoris sont triés alphabétiquement à l'affichage.
   */
  history?: string;
  favourites?: string;
}

/** La config après application des valeurs par défaut. */
interface QFConfig {
  maxEntries: number;
  autoRun: boolean;
  showFullPath: boolean;
}
