/**
 * resolveConfig : valeurs par défaut et assainissement des réglages.
 *
 * L'UI de Stash produit maxEntries via Number.parseInt, donc des lettres
 * saisies deviennent NaN. Un config.yml édité à la main peut en revanche
 * contenir n'importe quoi.
 */

const { helper, check, section } = require("./harness");

module.exports = async function run() {
  const { resolveConfig } = helper("config.js");

  section("resolveConfig : maxEntries");

  const cases = [
    ["absent (undefined)", undefined, 8],
    ["null", null, 8],
    ["chaine vide", "", 8],
    ['chaine "abc"', "abc", 8],
    ["NaN (lettres saisies dans l'UI)", NaN, 8],
    ["zero", 0, 8],
    ["negatif -5", -5, 8],
    ["fraction 0.5 (config.yml a la main)", 0.5, 8],
    ["fraction 3.7 -> tronquee vers le bas", 3.7, 3],
    ["valide 1", 1, 1],
    ["valide 12", 12, 12],
    ["au-dela du plafond : 500", 500, 20],
    ["Infinity", Infinity, 8],
    ["-Infinity", -Infinity, 8],
    ['chaine numerique "6"', "6", 6],
    ["tableau [3]", [3], 3],
    ["objet", {}, 8],
  ];

  for (const [label, value, expected] of cases) {
    check(`maxEntries ${label}`, resolveConfig({ maxEntries: value }).maxEntries, expected);
  }

  section("resolveConfig : booleens");

  const boolCases = [
    ["absent", undefined, false],
    ["true", true, true],
    ["false", false, false],
    ['chaine "false" (config.yml a la main)', "false", false],
    ['chaine "true"', "true", false],
    ["nombre 1", 1, false],
  ];

  for (const [label, value, expected] of boolCases) {
    check(`autoRun ${label}`, resolveConfig({ autoRun: value }).autoRun, expected);
  }

  section("resolveConfig : config absente");

  const defaults = { maxEntries: 8, autoRun: false, showFullPath: false };
  check("config undefined -> defauts", resolveConfig(undefined), defaults);
  check("config vide -> defauts", resolveConfig({}), defaults);
};
