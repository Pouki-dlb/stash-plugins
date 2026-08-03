/**
 * Build du thème : PinkNeon.css + PinkNeon.yml -> dist/
 *
 * Le CSS source est volontairement bavard (gros bandeau de principes de design,
 * commentaires de section) : c'est la documentation du thème, elle reste dans la
 * source. dist/ ne contient que ce que Stash a besoin de charger, minifié.
 *
 * Le nom des fichiers de dist/ ne doit pas changer : PinkNeon.yml référence
 * "PinkNeon.css" par ce nom exact.
 *
 *   npm run build     une passe
 *   npm run watch     rebuild à chaque sauvegarde du CSS
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import postcss from "postcss";
import discardComments from "postcss-discard-comments";
import normalizeWhitespace from "postcss-normalize-whitespace";

const pluginID = "PinkNeon";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcCss = path.join(root, `${pluginID}.css`);
const srcYml = path.join(root, `${pluginID}.yml`);
const dist = path.join(root, "dist");

/** Récupère un champ de tête du .yml (name/version/url) sans dépendre d'un parseur. */
function ymlField(yml, field) {
  const m = yml.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^"(.*)"$/, "$1") : "";
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

/**
 * Colle les listes de sélecteurs : ".a,\n.b" -> ".a,.b".
 *
 * postcss garde `rule.selector` tel qu'écrit — les deux plugins ci-dessous ne
 * compactent que l'intérieur des règles. Sans ça, le source écrivant un
 * sélecteur par ligne, la sortie garde ~283 retours à la ligne.
 *
 * Sans risque : un blanc adjacent à une virgule de liste ne peut pas être un
 * combinateur descendant, et la spécificité se calcule sur le sélecteur qui
 * matche, pas sur sa mise en forme. Seul angle mort théorique — une virgule
 * DANS la chaîne d'un sélecteur d'attribut, ex. [title="a, b"] : vérifié, il
 * n'y en a aucune dans PinkNeon.css. Si tu en ajoutes un jour, retire ceci.
 */
const joinSelectorLists = {
  postcssPlugin: "join-selector-lists",
  Rule(rule) {
    rule.selector = rule.selector.replace(/\s*,\s*/g, ",");
  },
};

async function build() {
  const [css, yml] = await Promise.all([
    readFile(srcCss, "utf8"),
    readFile(srcYml, "utf8"),
  ]);

  // Bandeau conservé dans la sortie : les commentaires /*! ... */ sont épargnés.
  // Pas de \n derrière : un commentaire est un token, il peut coller au sélecteur
  // qui suit. C'est ce qui permet au fichier de tenir sur une seule ligne.
  const banner =
    `/*! ${ymlField(yml, "name")} v${ymlField(yml, "version")} — ` +
    `${ymlField(yml, "url")} */`;

  // Deux plugins, rien de plus : on retire les commentaires et on compacte les
  // espaces. Pas de minifieur complet (cssnano & co) : leurs presets fusionnent
  // aussi des règles et réécrivent des valeurs, ce qui touche à la cascade — et
  // sur ce fichier ça ne gagnait que ~0,8 kB de plus sur 130. Le gain vient des
  // commentaires, qui font l'essentiel du source. Ici, aucune déclaration n'est
  // déplacée ni réécrite, donc dist/ ne peut pas rendre autrement que le source.
  const result = await postcss([
    discardComments(), // garde les /*! ... */ : c'est ce qui préserve le bandeau
    normalizeWhitespace(),
    joinSelectorLists,
  ]).process(css, {
    from: srcCss,
    to: path.join(dist, `${pluginID}.css`),
  });

  for (const warning of result.warnings()) {
    console.warn(`  ! ${warning.toString()}`);
  }

  // On écrase au lieu de purger dist/ : les deux noms de sortie sont fixes, donc
  // rien ne peut y devenir obsolète, et un rmdir échoue en EBUSY sous Windows dès
  // qu'un process (éditeur, explorateur, indexeur) tient le dossier ouvert.
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, `${pluginID}.css`), banner + result.css);
  await copyFile(srcYml, path.join(dist, `${pluginID}.yml`));

  const out = banner.length + result.css.length;
  console.log(
    `dist/${pluginID}.css  ${kb(css.length)} -> ${kb(out)} ` +
      `(-${Math.round((1 - out / css.length) * 100)} %)`,
  );
}

await build();

if (process.argv.includes("--watch")) {
  let pending = null;
  console.log(`watch: ${pluginID}.css`);
  watch(srcCss, () => {
    // Un enregistrement d'éditeur déclenche souvent plusieurs événements.
    clearTimeout(pending);
    pending = setTimeout(() => build().catch((e) => console.error(e.message)), 100);
  });
}
