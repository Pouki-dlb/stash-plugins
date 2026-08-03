const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

// Build de production : tout est minifié (noms de variables raccourcis,
// espaces supprimés). C'est ce qu'on installe dans Stash.
module.exports = merge(common, {
  mode: "production",
  optimization: {
    minimize: true,
    minimizer: [`...`, new CssMinimizerPlugin()],
  },
});
