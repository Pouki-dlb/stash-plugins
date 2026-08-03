const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

// Build de développement : code lisible, source maps pour déboguer dans la
// console du navigateur.
module.exports = merge(common, {
  mode: "development",
  devtool: "inline-source-map",
});
