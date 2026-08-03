const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");

/**
 * L'identifiant du plugin. C'est LA chaîne à changer pour renommer le plugin :
 * elle donne leur nom aux trois fichiers produits dans dist/ (.js, .css, .yml).
 *
 * Attention, elle doit rester identique à la clé utilisée dans src/main.tsx
 * pour lire la config (configuration.plugins.<pluginID>), sinon Stash ne
 * retrouvera pas tes réglages.
 */
const pluginID = "StashPluginTemplate";

module.exports = {
  // Le point d'entrée : webpack part de ce fichier et suit tous les imports.
  entry: "./src/main.tsx",
  output: {
    filename: pluginID + ".js",
    path: path.resolve(__dirname, "dist"),
    // Vide dist/ avant chaque build, pour ne pas garder de vieux fichiers.
    clean: true,
  },
  module: {
    rules: [
      // Les .ts / .tsx passent par TypeScript (vérification + compilation).
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      // Les .scss sont compilés en CSS, puis extraits dans un fichier à part.
      {
        test: /\.scss$/i,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          {
            loader: "sass-loader",
            // Utilise l'API moderne de Dart Sass. Sans ça, sass-loader passe
            // par l'ancienne, dépréciée, et le build affiche un avertissement.
            options: { api: "modern-compiler" },
          },
        ],
      },
    ],
  },
  plugins: [
    // Le manifeste n'a pas besoin d'être compilé, juste copié et renommé.
    new CopyPlugin({
      patterns: [{ from: "src/source.yml", to: pluginID + ".yml" }],
    }),
    new MiniCssExtractPlugin({ filename: pluginID + ".css" }),
  ],
  resolve: {
    // Doit rester synchronisé avec "paths" dans tsconfig.json.
    alias: {
      "@components": path.resolve(__dirname, "./src/components"),
      "@helpers": path.resolve(__dirname, "./src/helpers"),
      "@pluginTypes": path.resolve(__dirname, "./types"),
    },
    // Permet d'écrire import x from "./Foo" sans préciser l'extension.
    extensions: [".tsx", ".ts", ".js"],
  },
};
