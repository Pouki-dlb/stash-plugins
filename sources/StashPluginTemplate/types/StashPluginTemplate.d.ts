/**
 * Les types propres à TON plugin.
 *
 * Le fichier porte le nom du plugin par convention. Si tu renommes le plugin,
 * renomme-le aussi (et ajuste l'import dans src/main.tsx).
 */

/**
 * La config telle que Stash la renvoie.
 *
 * Toutes les propriétés sont optionnelles, et ce n'est pas un détail : Stash
 * ne crée une entrée que lorsque l'utilisateur modifie l'option. Une option
 * jamais touchée vaut `undefined`, pas `false`.
 *
 * Une entrée par option déclarée dans src/source.yml, avec le même nom.
 */
interface TemplateConfigMap {
  /** Le texte affiché dans le badge ajouté aux cartes de scène. */
  badgeText?: string;
  /** Quand activé, un badge est ajouté en bas de chaque carte de scène. */
  showBadge?: boolean;
}

/**
 * La même config, mais après application des valeurs par défaut dans main.tsx.
 *
 * L'intérêt de ce second type : à partir du moment où la config est passée aux
 * composants, plus rien n'est `undefined`. Tu n'as donc plus à écrire de tests
 * du genre `config.showBadge === undefined` partout dans le code.
 */
interface TemplateFinalConfigMap {
  badgeText: string;
  showBadge: boolean;
}

/**
 * Déclare ton plugin dans la config globale de Stash, pour que
 * `configuration.plugins.StashPluginTemplate` soit correctement typé.
 *
 * La clé doit être identique au pluginID de webpack.common.js.
 */
interface PluginsConfig {
  StashPluginTemplate?: TemplateConfigMap;
}
