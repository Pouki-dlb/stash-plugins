# QuickFolders

Plugin UI pour [Stash](https://stashapp.cc). Il ajoute des raccourcis de dossiers cliquables
au-dessus du navigateur de dossiers, dans les fenêtres de sélection des tâches sélectives
(Scan, Auto Tag, Generate, Clean).

Deux rangées :

- **Favourites** — les dossiers que tu as épinglés à la main. Aucun plafond, jamais évincés.
- **Recent folders** — les dossiers récemment utilisés, alimentés tout seuls, plafonnés par un
  réglage.

Chaque rangée n'apparaît que si elle contient quelque chose.

## Pourquoi

Stash ne garde aucune trace des chemins scannés : la description du job est la constante
`"Scanning..."`, les sous-tâches sont effacées à la fin du job, et l'historique des jobs terminés
est un buffer mémoire de 10 entrées vidé au redémarrage. Le plugin doit donc constituer son propre
historique, en observant les tâches au moment où elles sont lancées.

## Fonctionnement

- **Enregistrement** — `window.fetch` est enveloppé pour repérer les mutations GraphQL
  `MetadataScan`, `MetadataAutoTag`, `MetadataGenerate` et `MetadataClean` qui portent une liste de
  chemins. Un scan complet (sans sélection) n'est donc jamais enregistré. L'observation est en
  « fire and forget » : elle ne retarde ni ne fait échouer la tâche.
- **Affichage** — le composant `FolderSelect` de Stash est patché via `PluginApi.patch.instead`.
  C'est le seul composant patchable présent dans la fenêtre de sélection de dossiers
  (`DirectorySelectionDialog` ne l'est pas). Les usages de `FolderSelect` sans bouton « + »
  (filtre *Path* des listes, écran de Setup) sont laissés intacts.
- **Granularité** — un raccourci = **un dossier**. Une tâche lancée sur plusieurs dossiers produit
  donc autant de raccourcis indépendants, que l'on peut rappeler séparément ou recombiner.
- **Application** — l'état interne de la fenêtre n'étant pas exposé, le chemin est injecté en
  pilotant son bouton « + ». Cliquer plusieurs raccourcis d'affilée compose la sélection.
- **Stockage** — dans la config serveur du plugin (`configurePlugin`), sous deux clés `history` et
  `favourites` non déclarées dans le manifeste : le plugin reste entièrement contenu dans sa propre
  section de la config Stash, les listes n'apparaissent pas dans Settings > Plugins, et elles
  suivent l'utilisateur d'un navigateur à l'autre.

## Les deux listes

La punaise à droite de chaque raccourci fait passer un dossier d'une rangée à l'autre. Elle reprend
la convention de Stash (`EditFilterDialog`) : **droite** quand le dossier est épinglé, **penchée**
quand un clic l'épinglerait. C'est le seul signe distinctif entre les deux rangées, avec leur
titre — les pastilles elles-mêmes sont identiques, sans couleur ni opacité particulière.

Le raccourci lui-même n'affiche une infobulle que lorsqu'il est en mode compact — elle donne alors
le chemin complet, que le bouton ne montre pas. Avec *Show full paths* activé, le chemin est déjà à
l'écran : pas d'infobulle.

| | Favourites | Recent folders |
| --- | --- | --- |
| Alimentation | à la main, via ☆ | automatique, à chaque tâche |
| Plafond | aucun | réglage *Number of recent folders* |
| Ordre | alphabétique | du plus récent au plus ancien |
| Éviction | jamais | les plus anciens, quand le plafond est atteint |

Les deux listes sont disjointes, et trois règles en découlent :

- épingler un dossier le **retire** de l'historique ;
- un favori re-scanné ne **réapparaît pas** dans l'historique ;
- désépingler renvoie le dossier **en tête** de l'historique — il vient d'être manipulé, donc il
  est pertinent.

*Clear history* ne vide que la rangée du bas. Les favoris ne se suppriment qu'un par un, via ★.

## Limite connue : modifier un réglage fait reculer les deux listes

**Les favoris peuvent être perdus. C'est un compromis assumé, pas un bug à contourner.**

Le panneau Settings de Stash reconstruit toute la map du plugin à partir de sa copie en cache, puis
l'envoie à `configurePlugin` — qui **remplace** la map. À chaque modification d'un réglage, les
deux listes sont donc ramenées à l'état qu'avait cette copie, et tout ce qui a été enregistré
depuis est perdu.

Le mécanisme, dans l'ordre :

1. `SettingsContext` (`ui/v2.5/src/components/Settings/context.tsx`) prend un instantané de
   `configuration.plugins` **une seule fois** par montage — voir le commentaire
   *"only initialise once"*.
2. `PluginSettings` (`SettingsPluginsPanel.tsx`) renvoie `{...instantané, clé: valeur}`.
3. `configurePlugin` remplace intégralement la map du plugin, `history` et `favourites` compris.

La fenêtre de casse est précise : **épingler, puis modifier un réglage sans avoir quitté Settings
entre-temps**. Elle est étroite mais réelle, car la page Tasks est elle-même sous Settings — le
`SettingsContext` est déjà monté quand tu ouvres la fenêtre de scan, et son instantané date de ton
entrée dans Settings, donc d'avant tes épinglages.

En pratique : **règle tes options d'abord, épingle ensuite.** Une fois les réglages posés, tu n'y
reviens plus, et le problème ne se présente pas. À noter aussi, Stash appelle `client.resetStore()`
à la fin de chaque scan (`ui/v2.5/src/core/createClient.ts`), ce qui rafraîchit le cache — ce qui
précède un scan terminé a de bonnes chances de survivre.

C'est le prix du rangement des données dans la seule section du plugin. Le contourner obligerait à
les stocker ailleurs dans la config Stash, ou à doubler le stockage d'un miroir local.

## Réglages (Settings > Plugins)

| Réglage | Clé | Défaut | Effet |
| --- | --- | --- | --- |
| Run task immediately | `autoRun` | désactivé | Le clic valide la fenêtre et lance la tâche sur ce dossier, au lieu de seulement l'ajouter à la sélection. |
| Number of recent folders | `maxEntries` | 8 | Taille de la rangée *Recent folders* (max. 20). Sans effet sur les favoris. |
| Show full paths | `showFullPath` | désactivé | Affiche le chemin complet au lieu du seul nom de dossier. |

Stash affiche les réglages par ordre alphabétique de clé. `maxEntries` est la capacité réelle de
stockage de l'historique, pas seulement un nombre affiché : l'abaisser écarte les entrées les plus
anciennes lors de la prochaine tâche enregistrée.

## Build

```bash
npm install
npm run build      # -> dist/QuickFolders.{js,css,yml}
npm run watch      # build de dev en continu
```

## Tests

```bash
npm test
```

62 cas, sans dépendance supplémentaire : `tsc` compile `src/helpers` vers `test/.build`, puis Node
exécute les suites. Elles s'appuient sur le vrai code du plugin — rien n'est réimplémenté —, seul
l'environnement navigateur est simulé (`test/harness.js` fournit un `window` minimal et un serveur
Stash en mémoire qui répond aux requêtes GraphQL).

`test/config.test.js` couvre l'assainissement des réglages ; `test/lists.test.js` couvre le modèle
des deux listes : dédoublonnage, ordre, troncature, disjonction des listes, épinglage et tri.

Ce sont les règles arbitrées à la conception, pas des détails d'implémentation. Elles valent la
peine d'être relancées après toute modification de `src/helpers/`. Le processus sort avec un code
non nul en cas d'échec.

## Installation

Copier les trois fichiers de `dist/` dans un sous-dossier `QuickFolders/` du dossier `plugins`
de Stash (voir `plugins_path` dans le `config.yml` du serveur), puis
**Settings > Plugins > Reload Plugins** et un rechargement forcé du navigateur (Ctrl+F5).

L'identifiant du plugin est le nom du fichier `.yml` sans extension. Le renommer changerait la clé
sous laquelle Stash range la config — et ferait donc perdre réglages, historique et favoris.

## Personnalisation CSS

Les variables sont exposées sur `:root` et surchargeables depuis
Settings > Interface > Custom CSS :

```css
:root {
  --qf-gap: 0.35rem;
  --qf-chip-max-width: 18rem;
  --qf-title-color: rgba(255, 255, 255, 0.6);
  --qf-title-size: 0.75rem;
}
```

Les classes suivent la convention déjà en place autour du plugin : **simple tiret** pour les parties
d'un bloc — comme Stash, qui écrit `.scene-card-preview-image` et n'utilise le double underscore
nulle part dans ses propres feuilles — et **double tiret** réservé aux variantes, comme
ValkyrSceneCards et ses `.vsc-gender-color--female`.

```
qf-root
qf-bar  qf-bar--fav  qf-bar-header  qf-bar-title  qf-bar-action  qf-bar-chips
qf-chip  qf-chip--fav  qf-chip-apply  qf-chip-pin
qf-tilted
```

`qf-bar--fav` ne porte plus aucun style : elle reste dans le balisage comme point d'accroche pour
cibler la rangée des favoris depuis Custom CSS.

## Notes d'implémentation

L'icône passe par `PluginApi.libraries.ReactFontAwesome` plutôt que par
`PluginApi.components.Icon` : les bibliothèques sont disponibles dès le chargement du plugin, alors
que le registre de composants peut être incomplet après un rechargement forcé
([stash#5479](https://github.com/stashapp/stash/issues/5479)) — le même piège que ValkyrSceneCards
contourne avec un `setTimeout`.

Une entrée est un chemin, rien de plus. Chaque liste est stockée comme un tableau JSON nu, sans
enveloppe ni numéro de version :

```json
["/media/films","/media/series"]
```

Ni date, ni provenance : l'ordre du tableau *est* la chronologie de l'historique, le dernier ajouté
en tête. Une valeur qui n'est pas un tableau de chaînes est ignorée plutôt que de faire échouer le
plugin.

Les favoris sont triés à l'affichage, pas au stockage : la clé de tri est le texte réellement
montré sur le bouton, donc le nom de dossier en mode compact et le chemin complet quand
*Show full paths* est actif. Trier sur autre chose que ce que l'œil lit donnerait un ordre
d'apparence aléatoire. Le tri est naturel (« Saison 2 » avant « Saison 10 ») et insensible à la
casse comme aux accents.
