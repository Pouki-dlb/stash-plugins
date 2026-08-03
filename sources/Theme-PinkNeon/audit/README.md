# Audit de cascade CSS — PinkNeon

Deux scripts PowerShell pour détecter les **règles concurrentes qui s'écrasent** dans
`PinkNeon.css`. Ils ne modifient rien : ils lisent et rapportent.

## Pourquoi

Le cas typique : deux sélecteurs de **poids identique** ciblent le même élément et posent la
même propriété. À égalité, c'est le **dernier écrit** qui gagne. Tant que les deux posent la
même valeur, aucun symptôme — le conflit dort. Il n'apparaît que le jour où on veut
différencier les deux valeurs, et il ressemble alors à « ma modification n'a pas marché ».

C'est exactement ce qui est arrivé au champ de recherche de l'en-tête Edit Filter :
`input.search-input.btn-secondary` (0,2,1) était écrasé par `input.btn-secondary.form-control`
(0,2,1), écrit plus bas. Corrigé en ajoutant `.form-control` au sélecteur spécifique.

## Utilisation

```powershell
.\audit-cascade.ps1 -Path ..\PinkNeon.css
.\audit-ties.ps1    -Path ..\PinkNeon.css
```

- **audit-cascade.ps1** — compare les sélecteurs « compound » simples (sans combinateur) deux
  à deux. Signale toute propriété commune avec des valeurs différentes, en indiquant qui gagne
  et si c'est une égalité de poids.
- **audit-ties.ps1** — élargit aux sélecteurs à combinateur (`.foo .bar`), mais ne rapporte
  QUE les égalités strictes de poids, sinon le bruit est ingérable.

## Lire les résultats

La plupart des remontées sont des **faux positifs**, pour deux raisons que les scripts ne
peuvent pas déduire :

1. **États mutuellement exclusifs** — `:checked` vs `:not(:checked)`, `.btn-primary` vs
   `.btn-secondary`. Les deux règles ne s'appliquent jamais au même moment.
2. **Conteneurs mutuellement exclusifs** — `.pagination` vs `.sidebar`, `.nav-tabs` vs
   `.nav-pills`… Un élément ne vit pas dans les deux.

Les remontées à examiner sérieusement sont celles où **aucun des deux sélecteurs n'est scopé
à un conteneur** : c'est là que deux jeux de classes qui se recoupent peuvent désigner le même
élément réel. Le scoping strict (règle d'or §8 de `PinkNeon.css`) est ce qui protège du
problème partout ailleurs.

## Limite

Les scripts n'établissent qu'une **liste de suspects**. Ils ne prouvent pas qu'un élément
porte réellement les deux jeux de classes — ça se vérifie dans les sources Stash
(`stash-develop/ui/v2.5/src`) ou dans l'inspecteur du navigateur.
