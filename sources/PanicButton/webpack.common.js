const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

/**
 * L'identifiant technique du plugin : il nomme les trois fichiers de dist/.
 *
 * Pas de point d'exclamation ici, et ce n'est pas un oubli : webpack réserve
 * le "!" pour sa syntaxe de loaders et refuse de produire un fichier qui en
 * contient. Le nom affiché dans Stash, lui, le garde — voir "name:" dans
 * src/source.yml.
 */
const pluginID = "PanicButton";

/** Récupère un champ de tête du .yml sans dépendre d'un parseur YAML. */
function ymlField(yml, field) {
  const m = yml.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^"(.*)"$/, "$1") : "";
}

/**
 * Retire les commentaires du manifeste livré.
 *
 * src/source.yml est abondamment commenté — numérotation des réglages, pièges
 * de YAML, raison d'un retrait — mais ces notes s'adressent à qui lit le code.
 * Elles n'ont rien à faire dans le fichier qu'on installe.
 *
 * Seules les lignes dont le premier caractère non blanc est un # sont retirées.
 * Un # en milieu de ligne appartient à une valeur — le #000000 d'une
 * description — et doit rester.
 *
 * Exception faite de "# requires:", que build_site.sh lit pour déclarer les
 * dépendances d'un plugin : commentaire pour YAML, donnée pour le dépôt.
 */
function stripYmlComments(yml) {
  return yml
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line) || /^\s*#\s*requires:/.test(line))
    .join("\n")
    // Les blocs retirés laissent des trous. Une ligne vide sépare encore les
    // groupes de réglages, deux ou plus ne veulent plus rien dire.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "\n");
}

/**
 * Bandeau d'identification en tête des fichiers livrés (nom, version, et l'url
 * si le .yml en déclare une — sinon elle est simplement omise). Source unique :
 * src/source.yml, donc la version ne peut pas diverger entre ce qu'affiche
 * Stash et ce que dit le fichier livré.
 */
const sourceYml = fs.readFileSync(
  path.resolve(__dirname, "src/source.yml"),
  "utf8",
);
const url = ymlField(sourceYml, "url");
const banner =
  `/*! ${ymlField(sourceYml, "name")} v${ymlField(sourceYml, "version")}` +
  (url ? ` — ${url}` : "") +
  " */";

/**
 * Colle le bandeau en tête des .js et .css produits.
 *
 * Pourquoi pas webpack.BannerPlugin : il pose le bandeau à l'étape ADDITIONS,
 * donc AVANT les minifieurs (étape OPTIMIZE_SIZE). Terser voit alors un
 * commentaire /*! et, par défaut, l'extrait dans un PanicButton.js.LICENSE.txt
 * — un fichier de plus à livrer, et le bandeau qui disparaît du bundle.
 *
 * En écrivant à l'étape REPORT, on passe après tous les minifieurs : le texte
 * est posé tel quel et personne ne le retouche. Pas de saut de ligne derrière,
 * un commentaire étant un token qui peut coller au code qui suit.
 *
 * Copie conforme de celui de QuickFolders : chaque plugin de sources/ est un
 * projet npm autonome, on ne partage pas de fichier entre eux.
 */
class PrependBannerPlugin {
  constructor(text) {
    this.text = text;
  }

  apply(compiler) {
    const { Compilation, sources } = webpack;
    compiler.hooks.thisCompilation.tap("PrependBanner", (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: "PrependBanner", stage: Compilation.PROCESS_ASSETS_STAGE_REPORT },
        (assets) => {
          for (const name of Object.keys(assets)) {
            if (!/\.(js|css)$/.test(name)) continue;
            compilation.updateAsset(
              name,
              (old) => new sources.ConcatSource(this.text, old),
            );
          }
        },
      );
    });
  }
}

module.exports = {
  entry: "./src/main.ts",
  output: {
    filename: pluginID + ".js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.scss$/i,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          { loader: "sass-loader", options: { api: "modern-compiler" } },
        ],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "src/source.yml",
          to: pluginID + ".yml",
          transform: (content) => stripYmlComments(content.toString()),
        },
      ],
    }),
    new MiniCssExtractPlugin({ filename: pluginID + ".css" }),
    new PrependBannerPlugin(banner),
  ],
  resolve: {
    alias: {
      "@pluginTypes": path.resolve(__dirname, "./types"),
    },
    extensions: [".ts", ".js"],
  },
};
