# Stash Plugin Template

Un squelette de plugin d'interface pour Stash, en TypeScript + React + SCSS.
Il compile en l'état et ajoute un petit badge en bas de chaque carte de scène,
pilotable depuis les réglages — de quoi vérifier que toute la chaîne fonctionne
avant d'écrire ton propre code.

## Démarrage

```bash
npm install
```

```bash
npm run build
```

Le dossier `dist/` contient alors les trois fichiers que Stash attend :

```
dist/
├─ StashPluginTemplate.js     le code compilé
├─ StashPluginTemplate.css    les styles compilés
└─ StashPluginTemplate.yml    le manifeste
```

Copie ce contenu dans un sous-dossier du répertoire `plugins` de ton Stash,
puis va dans Settings > Plugins et clique sur **Reload plugins**.

Pendant que tu développes, `npm run watch` recompile à chaque sauvegarde. Il
reste à recharger la page de Stash pour voir le résultat (`Ctrl+F5` si le
navigateur garde l'ancienne version en cache).

## Renommer le plugin

Trois endroits, à changer ensemble :

| Fichier | Quoi |
| --- | --- |
| `webpack.common.js` | la constante `pluginID` — elle nomme les fichiers de `dist/` |
| `src/main.tsx` | la clé `configuration.plugins.StashPluginTemplate` |
| `types/StashPluginTemplate.d.ts` | la clé dans `interface PluginsConfig` |

Pense aussi à `name:` dans `src/source.yml` (le titre affiché dans Stash) et au
préfixe `spt-` des classes CSS.

Un avertissement au passage : cet identifiant est la clé sous laquelle Stash
enregistre les réglages de l'utilisateur. Le changer après coup remet toutes
les options à zéro. Choisis-le maintenant.

## Structure

```
├─ src/
│  ├─ main.tsx                 point d'entrée : c'est ici que tout démarre
│  ├─ source.yml               manifeste + déclaration des options
│  ├─ styles.scss              styles, avec des variables CSS surchargeables
│  └─ components/
│     └─ SceneCardBadge.tsx    composant d'exemple, à supprimer
├─ types/
│  ├─ StashPluginTemplate.d.ts types de TON plugin (config)
│  ├─ stashPlugin.d.ts         l'API window.PluginApi
│  └─ stashGQL.d.ts            le schéma GraphQL de Stash
├─ webpack.common.js           config de build partagée
├─ webpack.dev.js              build lisible + source maps
└─ webpack.prod.js             build minifié, celui qu'on installe
```

Les fichiers de `types/` sont des **déclarations globales** : leurs types sont
disponibles partout sans `import`. C'est pour ça que `main.tsx` utilise `Scene`
ou `TemplateConfigMap` sans jamais les importer.

## Ajouter une option

Quatre étapes, à faire dans cet ordre :

1. Déclarer l'option dans `src/source.yml`, sous `settings:` (types acceptés :
   `BOOLEAN`, `NUMBER`, `STRING`). **Le texte est visible dans Stash : écris-le
   en anglais.**
2. L'ajouter aux deux interfaces de `types/StashPluginTemplate.d.ts` :
   optionnelle dans `TemplateConfigMap`, obligatoire dans
   `TemplateFinalConfigMap`.
3. Lui donner une valeur par défaut dans `src/main.tsx`.
4. L'utiliser dans un composant.

Si tu en oublies une, le build échoue avec un message explicite — c'est
exactement le service que rend TypeScript ici.

À retenir : **Stash ne stocke une option qu'une fois modifiée.** Une option
jamais touchée par l'utilisateur vaut `undefined`, pas `false`. D'où les `??`
dans `main.tsx`.

## Modifier l'interface de Stash

```ts
PluginApi.patch.before("SceneCard.Details", fn);   // insère avant
PluginApi.patch.after("SceneCard.Details", fn);    // insère après
PluginApi.patch.instead("SceneCard.Details", fn);  // remplace
```

La fonction reçoit les props du composant et renvoie **un tableau** d'éléments
React. `instead` reçoit en troisième argument le composant d'origine, à toi de
décider si tu le réutilises.

Commence par `after` : l'affichage natif reste intact, tu ne fais qu'ajouter.
`instead` est plus puissant mais t'oblige à réimplémenter tout ce que tu
remplaces — et à suivre les évolutions de Stash.

La liste des composants patchables se trouve dans `types/stashPlugin.d.ts`,
sous `PatchableComponentsInstead`. Elle est incomplète par rapport à ce que
Stash propose réellement : si tu en vises un qui n'y figure pas, ajoute sa
signature au fichier.

## Provenance

`types/stashGQL.d.ts` et `types/stashPlugin.d.ts` proviennent du projet
[ValkyrSceneCards](https://github.com/Valkyr-JS/ValkyrSceneCards) de Valkyr-JS,
sous licence Apache-2.0. `stashPlugin.d.ts` a été complété ici pour autoriser
`patch.after` sur `SceneCard.Details`. Si tu publies ce plugin, pense à
conserver l'attribution.
