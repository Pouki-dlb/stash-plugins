/**
 * Le nom des réglages "case à cocher" de la liste de touches.
 *
 * Le préfixe numérique n'est pas décoratif : Stash trie les options par ordre
 * alphabétique de leur clé, c'est donc le seul moyen d'imposer un ordre
 * d'affichage. À garder aligné sur src/source.yml et sur TRIGGER_KEYS.
 */
type PanicTriggerSetting =
  | "05keyBackquote"
  | "06keyInsert"
  | "07keyEscape"
  | "08keyPause"
  | "09keyScrollLock"
  | "10keyF01"
  | "11keyF02"
  | "12keyF03"
  | "13keyF04"
  | "14keyF05"
  | "15keyF06"
  | "16keyF07"
  | "17keyF08"
  | "18keyF09"
  | "19keyF10";

/** La config telle que Stash la renvoie : tout est optionnel, car Stash ne
 * stocke une option qu'une fois modifiée par l'utilisateur. */
interface PanicConfigMap extends Partial<Record<PanicTriggerSetting, boolean>> {
  "01overlayColor"?: string;
  "02overlayImageUrl"?: string;
  "03disguiseTitle"?: string;
  "04disguiseFaviconUrl"?: string;
  "22customTriggerKeys"?: string;
}

/** La config effective, une fois les valeurs par défaut appliquées. Les
 * touches n'y figurent pas : elles sont résolues en une liste de Hotkey. */
interface PanicConfig {
  disguiseFaviconUrl: string;
  disguiseTitle: string;
  overlayColor: string;
  overlayImageUrl: string;
}

/** Une entrée de la liste de touches proposées en case à cocher. */
interface TriggerKeyOption {
  /** Le nom du réglage correspondant dans source.yml. */
  setting: PanicTriggerSetting;
  /** Ce qui sera comparé à l'événement clavier. Une seule touche par case. */
  key: string;
}

/** Un raccourci clavier décomposé, tel que produit par parseHotkey(). */
interface Hotkey {
  /** La touche principale, en minuscules. Comparée à KeyboardEvent.key et
   * KeyboardEvent.code, ce qui accepte aussi bien "p" que "Backquote". */
  key: string;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}
