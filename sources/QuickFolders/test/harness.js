/**
 * Socle des tests : serveur Stash simulé, résolution des alias, et un
 * micro-vérificateur.
 *
 * Les tests s'exécutent sur le VRAI code du plugin, compilé depuis src/helpers
 * vers test/.build par `npm test`. Rien n'est réimplémenté ici : seul
 * l'environnement navigateur est simulé.
 *
 * Ce module doit être chargé AVANT tout require du code compilé :
 * helpers/config.ts capture window.fetch à l'évaluation du module.
 */

const path = require("path");
const Module = require("module");

/* -------------------------------------------------------------------------- */
/*                            Serveur Stash simulé                            */
/* -------------------------------------------------------------------------- */

/**
 * La section de config du plugin, telle que le serveur la détiendrait.
 * Les tests la lisent et la réinitialisent directement.
 */
const server = { config: {} };

global.window = {
  fetch: async (_url, init) => {
    const body = JSON.parse(init.body);

    if (body.query.includes("configurePlugin")) {
      server.config = body.variables.input;
      return {
        ok: true,
        json: async () => ({ data: { configurePlugin: server.config } }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        data: { configuration: { plugins: { QuickFolders: server.config } } },
      }),
    };
  },
  location: { origin: "http://localhost:9999", href: "http://localhost:9999/" },
  dispatchEvent: () => {},
};

global.document = { querySelector: () => null };
global.CustomEvent = class {};

/* -------------------------------------------------------------------------- */
/*                          Chargement du code compilé                        */
/* -------------------------------------------------------------------------- */

const BUILD = path.join(__dirname, ".build");

// tsc ne réécrit pas les alias de chemins : on résout "@helpers/*" à la main,
// sinon lists.js échouerait à charger config.js.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("@helpers/")) {
    request = path.join(BUILD, request.slice("@helpers/".length));
  }
  return originalResolve.call(this, request, ...rest);
};

/** Charge un module compilé depuis src/helpers, par son nom de fichier. */
function helper(name) {
  return require(path.join(BUILD, name));
}

/* -------------------------------------------------------------------------- */
/*                              Micro-vérificateur                            */
/* -------------------------------------------------------------------------- */

let failures = 0;
let total = 0;

/** Compare par valeur, sérialisation JSON à l'appui. */
function check(label, got, expected) {
  total += 1;
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) failures += 1;

  console.log(`${ok ? "OK  " : "FAIL"} | ${label}`);
  if (!ok) {
    console.log(`       obtenu  = ${JSON.stringify(got)}`);
    console.log(`       attendu = ${JSON.stringify(expected)}`);
  }
}

function section(title) {
  console.log(`\n--- ${title} ---`);
}

/** Affiche le bilan. Renvoie true si tout est passé. */
function summary() {
  console.log("");
  if (failures === 0) {
    console.log(`${total} cas, tous passent.`);
    return true;
  }
  console.log(`${total} cas, ${failures} echec(s).`);
  return false;
}

module.exports = { server, helper, check, section, summary };
