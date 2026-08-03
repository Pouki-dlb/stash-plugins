/**
 * Point d'entrée des tests : `npm test`.
 *
 * Le script npm compile d'abord src/helpers vers test/.build, puis exécute ce
 * fichier. Le harnais doit être chargé en premier — il installe le stub de
 * window avant que le code compilé ne soit chargé.
 */

const { summary } = require("./harness");

const suites = [require("./config.test"), require("./lists.test")];

(async () => {
  try {
    for (const suite of suites) await suite();
  } catch (err) {
    console.error("\nLe harnais a echoue :", err);
    process.exit(1);
  }

  process.exit(summary() ? 0 : 1);
})();
