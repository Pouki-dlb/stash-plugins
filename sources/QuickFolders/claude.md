# QuickFolders — consignes projet

Plugin UI pour [Stash](https://stashapp.cc), en TypeScript + webpack. Il ajoute deux rangées de
raccourcis de dossiers au-dessus du navigateur de dossiers, dans les fenêtres de sélection des
tâches sélectives : **Favourites** (épinglés à la main) et **Recent folders** (auto-alimentés).

Ce fichier s'adresse à une IA qui reprend le projet. Il ne documente pas l'usage du plugin : il
consigne les règles de travail, les décisions arbitrées, et les découvertes coûteuses sur Stash
qu'il serait long de refaire.

## Commandes

```bash
npm run build     # -> dist/QuickFolders.{js,css,yml}
npm test          # 62 cas, code de sortie non nul en cas d'échec
npm run watch     # build de dev en continu
```

## Règles de travail

- **La version reste figée à `1.0.0`.** Ne jamais l'incrémenter de sa propre initiative, y compris
  après un correctif ou un changement structurel. Vaut pour `package.json` et `src/source.yml`.
- **Textes visibles dans Stash : en anglais.** Commentaires du code et documentation : en français.
- **Lancer `npm test` après toute modification de `src/helpers/`.** Les tests encodent des règles
  arbitrées à la conception, pas des détails d'implémentation.
- `pluginID` dans `webpack.common.js` et `PLUGIN_ID` dans `src/helpers/config.ts` doivent rester
  identiques : Stash déduit l'id du plugin du nom du `.yml` produit, et c'est la clé sous laquelle
  il range la config.
- **Classes CSS** : simple tiret pour les parties d'un bloc (`qf-bar-header`), double tiret réservé
  aux variantes (`qf-chip--fav`). Convention alignée sur Stash, qui n'utilise nulle part le double
  underscore, et sur ValkyrSceneCards. Pas de BEM strict.
- Un bloc ne doit pas dépendre de son contexte : le modificateur est porté par l'élément lui-même
  (`qf-chip--fav`), jamais déduit du parent.

## Décisions délibérées — ne pas « améliorer » sans demander

Ces choix ont été discutés et tranchés. Ils ont l'air perfectibles ; ils ne le sont pas.

- **Une entrée est un chemin, rien de plus.** Chaque liste est un tableau JSON nu :
  `["/media/A","/media/B"]`. Pas de date, pas de provenance, pas de numéro de version d'enveloppe —
  tous ont existé puis ont été retirés faute d'usage. L'ordre du tableau *est* la chronologie de
  l'historique, le dernier ajouté en tête.
- **Tout est stocké dans la seule section du plugin** (`configuration.plugins.QuickFolders`), sous
  les clés `history` et `favourites`, non déclarées dans le manifeste. Stocker ailleurs dans la
  config Stash a été explicitement refusé : un plugin ne doit pas déborder de sa section.
- **Conséquence assumée** : modifier un réglage depuis Settings > Plugins fait reculer les deux
  listes, favoris compris. C'est un compromis accepté et documenté, **pas un bug à contourner**.
  Les parades envisagées (miroir localStorage auto-réparateur, export/import) ont été écartées.
- **Les favoris n'ont aucun plafond**, et il n'existe pas de réglage pour ça. `maxEntries` ne
  concerne que l'historique.
- **Les deux listes sont disjointes.** Épingler retire de l'historique ; un favori re-scanné n'y
  réapparaît pas ; désépingler renvoie en tête de l'historique.
- **Les favoris sont triés à l'affichage, pas au stockage**, sur le texte réellement montré sur le
  bouton — nom de dossier en mode compact, chemin complet sinon. Trier sur autre chose que ce que
  l'œil lit donne un ordre d'apparence aléatoire.
- **Infobulle uniquement en mode compact**, où elle donne le chemin complet. Avec *Show full paths*,
  aucune infobulle : il n'y aurait rien à ajouter.
- **Aucune couleur ni opacité ne distingue les deux rangées.** Un accent doré a existé, puis une
  opacité réduite sur la punaise : les deux ont été retirés à la demande. Seuls l'orientation de la
  punaise et le titre de section différencient les rangées.
- **La punaise garde sa place au repos.** La faire apparaître au survol changerait la largeur de la
  pastille et décalerait toutes les suivantes dans une rangée qui passe à la ligne.
- **La barre apparaît aussi dans la fenêtre du Clean sélectif.** Connu et accepté : elle partage le
  même composant et le même DOM que celle du Scan, sans moyen fiable de les distinguer.

## Ce que Stash ne permet pas — découvertes coûteuses

- **Stash ne conserve aucune trace des chemins scannés.** La description du job est la constante
  `"Scanning..."`, les sous-tâches sont effacées à la fin du job, `jobQueue` ne renvoie que les jobs
  en cours, et le cimetière des jobs terminés est un buffer mémoire de 10 entrées vidé au
  redémarrage. D'où l'interception réseau : il n'existe pas d'autre source.
- **`DirectorySelectionDialog` n'est pas patchable.** Seul `FolderSelect`, rendu à l'intérieur,
  l'est (`PatchComponent`). C'est le seul point d'injection possible.
- **L'état `paths` de la fenêtre n'est pas exposé.** Son bouton « + » (`props.appendButton`) a un
  `onClick` qui ajoute le répertoire *courant* sans accepter d'argument. D'où l'injection en deux
  temps de `FolderSelectWithShortcuts` : appeler `onChangeDirectory(chemin)`, laisser React
  re-rendre pour que le bouton capture le nouveau chemin, puis déclencher son `onClick`. Un
  compteur `tick` force la progression, un garde-fou empêche toute boucle.
- **L'interception de `window.fetch` fonctionne** parce que le client Apollo de Stash est construit
  avec `createUploadLink({ uri })` sans `fetch` personnalisé, et qu'apollo-upload-client résout le
  `fetch` global à chaque requête (`const runtimeFetch = customFetch || fetch;` dans le handler).
  L'enregistrement est en « fire and forget » : il ne doit jamais retarder ni faire échouer la tâche.
- **`SettingsContext` prend un instantané unique** de `configuration.plugins` par montage
  (commentaire *"only initialise once"*), et le renvoie tel quel à `configurePlugin`, qui remplace
  toute la map. C'est la cause de la limite ci-dessus. La page Tasks étant elle-même sous Settings,
  l'instantané date de l'entrée dans Settings.
- **Le `config.yml` du serveur est réécrit intégralement depuis la mémoire** à chaque écriture.
  L'éditer à la main pendant que Stash tourne ne tient jamais : il faut arrêter le serveur.
- **`PluginApi.components` peut être incomplet après un rechargement forcé**
  ([stash#5479](https://github.com/stashapp/stash/issues/5479)). D'où l'usage de
  `PluginApi.libraries.ReactFontAwesome` plutôt que `PluginApi.components.Icon` — les bibliothèques,
  elles, sont disponibles dès le chargement.

## Dépôt

Le projet vit dans `sources/QuickFolders/` du dépôt `Pouki-dlb/stash-plugins`, publié sur GitHub
Pages pour le plugin manager de Stash.

- `sources/` — les projets complets. `plugins/` — uniquement les fichiers construits, versionnés.
- **Ne jamais placer un projet sous `plugins/`** : `build_site.sh` y cherche
  `find ./plugins -mindepth 1 -name "*.yml"`, et ramasserait `src/source.yml` comme un paquet
  fantôme.
- `build_site.sh` déduit l'`id` du **nom du fichier `.yml`**, la `version` de
  `<version du yml>-<hash git>`, et la `date` du dernier commit touchant `plugins/<nom>/`.
  **`plugins/<nom>/` doit donc rester versionné** : sans historique git pour ce chemin, la version
  se fige et Stash cesse de proposer les mises à jour.
- Après un build, copier `dist/*` vers `plugins/QuickFolders/` avant de commiter.

## Pour relire le code de Stash

Le code source de Stash est présent en local dans `sources/stash-develop/`. **Il est exclu de git**
par `sources/.gitignore`, au même titre que `ValkyrSceneCards-main` et `.claude` : un clone frais
du dépôt ne le contiendra pas. Le récupérer alors par :

```bash
git clone --depth 1 -b develop https://github.com/stashapp/stash.git sources/stash-develop
```

Les fichiers utiles, relatifs à cette racine : `ui/v2.5/src/patch.tsx`, `ui/v2.5/src/pluginApi.tsx`,
`ui/v2.5/src/components/Shared/FolderSelect/FolderSelect.tsx`,
`ui/v2.5/src/components/Settings/Tasks/DirectorySelectionDialog.tsx`,
`ui/v2.5/src/components/Settings/context.tsx`, `ui/v2.5/src/core/createClient.ts`,
`internal/manager/config/config.go`, `pkg/plugin/config.go`.
