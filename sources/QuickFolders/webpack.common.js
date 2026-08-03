const CopyPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");

/**
 * L'identifiant du plugin. Stash le déduit du nom du fichier .yml, et c'est
 * aussi la clé sous laquelle il range la config (configuration.plugins.<id>).
 * Elle doit rester identique à PLUGIN_ID dans src/helpers/config.ts.
 */
const pluginID = "QuickFolders";

module.exports = {
  entry: "./src/main.tsx",
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
          {
            loader: "sass-loader",
            options: { api: "modern-compiler" },
          },
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
    // Doit rester synchronisé avec "paths" dans tsconfig.json.
    alias: {
      "@components": path.resolve(__dirname, "./src/components"),
      "@helpers": path.resolve(__dirname, "./src/helpers"),
      "@pluginTypes": path.resolve(__dirname, "./types"),
    },
    extensions: [".tsx", ".ts", ".js"],
  },
};
