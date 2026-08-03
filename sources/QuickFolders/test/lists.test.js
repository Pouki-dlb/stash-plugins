/**
 * Le modèle des deux listes : historique auto-alimenté et favoris épinglés.
 *
 * Chaque règle vérifiée ici a été arbitrée volontairement — ce ne sont pas des
 * détails d'implémentation, mais le comportement attendu du plugin.
 */

const { server, helper, check, section } = require("./harness");

module.exports = async function run() {
  const {
    parseList, recordSelection, pin, unpin, clearHistory,
    formatLabel, formatTooltip, sortForDisplay,
  } = helper("lists.js");

  const history = () => parseList(server.config.history);
  const favourites = () => parseList(server.config.favourites);

  section("parseList : robustesse");

  check("JSON invalide", parseList("{pas du json"), []);
  check("valeur absente", parseList(null), []);
  check("chaine vide", parseList(""), []);
  check("tableau vide", parseList("[]"), []);
  check(
    "entrees non-chaines ignorees",
    parseList(JSON.stringify([null, 42, {}, "", { path: "/a" }])),
    []
  );
  check(
    "objet au lieu d'un tableau ignore",
    parseList(JSON.stringify({ v: 1, entries: ["/a"] })),
    []
  );
  check(
    "doublons d'un config.yml edite a la main",
    parseList(JSON.stringify(["/a", "/a", "/b"])),
    ["/a", "/b"]
  );

  section("historique : enregistrement");

  server.config = { maxEntries: 5 };

  await recordSelection(["/media/A", "/media/B", "/media/C"]);
  check("une tache sur 3 dossiers -> 3 entrees", history(), [
    "/media/A", "/media/B", "/media/C",
  ]);
  check(
    "format stocke = tableau JSON nu, sans enveloppe",
    server.config.history,
    '["/media/A","/media/B","/media/C"]'
  );

  await recordSelection(["/media/D"]);
  check("le dernier ajoute est en tete", history(), [
    "/media/D", "/media/A", "/media/B", "/media/C",
  ]);

  await recordSelection(["/media/B"]);
  check("dossier deja connu remonte, pas duplique", history(), [
    "/media/B", "/media/D", "/media/A", "/media/C",
  ]);

  await recordSelection(["/media/X", "/media/X"]);
  check("doublons dans une meme selection ecartes", history(), [
    "/media/X", "/media/B", "/media/D", "/media/A", "/media/C",
  ]);

  await recordSelection(["/media/Y", "/media/Z"]);
  check("troncature a maxEntries, les plus vieux partent", history(), [
    "/media/Y", "/media/Z", "/media/X", "/media/B", "/media/D",
  ]);

  section("favoris : epinglage");

  await pin("/media/B");
  check("epingle : sort de l'historique", history(), [
    "/media/Y", "/media/Z", "/media/X", "/media/D",
  ]);
  check("epingle : entre dans les favoris", favourites(), ["/media/B"]);

  await pin("/media/D");
  check("2e favori ajoute", favourites(), ["/media/B", "/media/D"]);
  check("2e favori sorti de l'historique", history(), [
    "/media/Y", "/media/Z", "/media/X",
  ]);

  await pin("/media/B");
  check("re-epingler est sans effet", favourites(), ["/media/B", "/media/D"]);

  section("favoris : les deux listes restent disjointes");

  await recordSelection(["/media/B", "/media/NEW"]);
  check("un favori re-scanne ne revient pas dans l'historique", history(), [
    "/media/NEW", "/media/Y", "/media/Z", "/media/X",
  ]);
  check("et n'est pas duplique dans les favoris", favourites(), [
    "/media/B", "/media/D",
  ]);

  section("favoris : desepinglage");

  await unpin("/media/D");
  check("desepingle : quitte les favoris", favourites(), ["/media/B"]);
  check("desepingle : revient en tete de l'historique", history(), [
    "/media/D", "/media/NEW", "/media/Y", "/media/Z", "/media/X",
  ]);

  await unpin("/media/INCONNU");
  check("desepingler un inconnu est sans effet", favourites(), ["/media/B"]);

  section("favoris : aucun plafond");

  for (let i = 0; i < 12; i += 1) await pin(`/fav/${i}`);
  check("13 favoris conserves malgre maxEntries=5", favourites().length, 13);

  section("vider l'historique");

  const kept = favourites();
  await clearHistory();
  check("historique vide", history(), []);
  check("favoris intacts", favourites(), kept);

  section("tri d'affichage des favoris");

  check(
    "mode compact : tri sur le nom de dossier",
    sortForDisplay(["/z/Alpha", "/a/Zoulou", "/m/Mike"], false),
    ["/z/Alpha", "/m/Mike", "/a/Zoulou"]
  );
  check(
    "chemins complets : tri sur le chemin entier",
    sortForDisplay(["/z/Alpha", "/a/Zoulou", "/m/Mike"], true),
    ["/a/Zoulou", "/m/Mike", "/z/Alpha"]
  );
  check(
    "tri naturel : Saison 2 avant Saison 10",
    sortForDisplay(["/x/Saison 10", "/x/Saison 2"], false),
    ["/x/Saison 2", "/x/Saison 10"]
  );
  check(
    "tri insensible a la casse et aux accents",
    sortForDisplay(["/x/beta", "/x/Alpha", "/x/Epsilon", "/x/delta"], false),
    ["/x/Alpha", "/x/beta", "/x/delta", "/x/Epsilon"]
  );
  check(
    "tri sans effet de bord sur la liste source",
    (() => {
      const source = ["/x/B", "/x/A"];
      sortForDisplay(source, false);
      return source;
    })(),
    ["/x/B", "/x/A"]
  );

  section("libelles et infobulle");

  const p = "/media/films/Action";
  check("libelle compact", formatLabel(p, false), "Action");
  check("libelle complet", formatLabel(p, true), p);
  check("libelle chemin Windows", formatLabel("D:\\Videos\\Clips", false), "Clips");
  check("libelle slash final", formatLabel("/media/films/", false), "films");
  check("compact -> infobulle = chemin complet", formatTooltip(p, false), p);
  check("chemin complet affiche -> aucune infobulle", formatTooltip(p, true), undefined);
};
