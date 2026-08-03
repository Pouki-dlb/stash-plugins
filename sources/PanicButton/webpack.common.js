const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");

/**
 * L'identifiant technique du plugin : il nomme les trois fichiers de dist/.
 *
 * Pas de point d'exclamation ici, et ce n'est pas un oubli : webpack réserve
 * le "!" pour sa syntaxe de loaders et refuse de produire un fichier qui en
 * contient. Le nom affiché dans Stash, lui, le garde — voir "name:" dans
 * src/source.yml.
 */
const pluginID = "PanicButton";

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
      patterns: [{ from: "src/source.yml", to: pluginID + ".yml" }],
    }),
    new MiniCssExtractPlugin({ filename: pluginID + ".css" }),
  ],
  resolve: {
    alias: {
      "@pluginTypes": path.resolve(__dirname, "./types"),
    },
    extensions: [".ts", ".js"],
  },
};
