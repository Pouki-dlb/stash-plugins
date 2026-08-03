/**
 * Détection des tâches lancées sur une sélection de dossiers.
 *
 * Stash ne conserve aucune trace des chemins scannés : la description du job
 * est la constante "Scanning...", les sous-tâches sont effacées à la fin du
 * job, et l'historique des jobs terminés est un buffer mémoire de 10 entrées
 * vidé au redémarrage. Il faut donc enregistrer la sélection au moment même où
 * elle est envoyée.
 *
 * Le point d'accroche fiable est window.fetch : LibraryTasks n'est pas
 * patchable, et mutateMetadataScan est un binding de module ES non
 * réassignable. Le client Apollo de Stash est construit avec
 * createUploadLink({ uri }) sans fetch personnalisé, donc il résout le fetch
 * global à chaque requête et voit bien notre remplacement.
 */

import { recordSelection } from "@helpers/lists";

/** Opérations GraphQL qui acceptent une liste de chemins. */
const WATCHED: ReadonlySet<string> = new Set<string>([
  "MetadataScan",
  "MetadataAutoTag",
  "MetadataGenerate",
  "MetadataClean",
]);

const PATCH_FLAG = "__quickFoldersFetchPatched";

/** Récupère l'URL de la requête, ou null si on ne sait pas la lire. */
function requestURL(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return null; // objet Request : Apollo n'en utilise pas ici
}

function isGraphQLRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (!init || (init.method ?? "GET").toUpperCase() !== "POST") return false;

  const raw = requestURL(input);
  if (raw === null) return false;

  try {
    return new URL(raw, window.location.href).pathname.endsWith("/graphql");
  } catch {
    return false;
  }
}

interface GraphQLPayload {
  operationName?: string;
  variables?: { input?: { paths?: unknown } };
}

/** Les sélections de dossiers contenues dans le corps de la requête. */
function extractSelections(body: unknown): string[][] {
  if (typeof body !== "string") return []; // FormData (upload) : ignoré

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }

  // Apollo n'active pas le batching par défaut, mais un tableau reste valide.
  const payloads: GraphQLPayload[] = Array.isArray(parsed)
    ? (parsed as GraphQLPayload[])
    : [parsed as GraphQLPayload];

  const found: string[][] = [];

  for (const payload of payloads) {
    const op = payload?.operationName;
    if (!op || !WATCHED.has(op)) continue;

    const paths = payload?.variables?.input?.paths;
    if (!Array.isArray(paths) || paths.length === 0) continue;

    const clean = paths.filter((p): p is string => typeof p === "string" && p !== "");
    // Un scan complet n'envoie pas de chemins : rien à mémoriser.
    if (clean.length > 0) found.push(clean);
  }

  return found;
}

/** Vrai si la réponse GraphQL ne contient pas d'erreur. */
async function succeeded(probe: Response): Promise<boolean> {
  try {
    const json = await probe.json();
    return !Array.isArray(json?.errors) || json.errors.length === 0;
  } catch {
    // Corps illisible (streaming, réponse vide…) : on fait confiance au statut.
    return true;
  }
}

/**
 * Remplace window.fetch par une version qui observe les mutations de tâches.
 * Idempotent : un second appel ne réinstalle rien.
 */
export function installScanInterceptor(): void {
  const w = window as unknown as Record<string, unknown>;
  if (w[PATCH_FLAG]) return;
  w[PATCH_FLAG] = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await original(input, init);

    try {
      if (response.ok && isGraphQLRequest(input, init)) {
        const selections = extractSelections(init?.body);
        if (selections.length > 0) {
          // Le clone doit être pris tout de suite, avant qu'Apollo ne consomme
          // le corps de la réponse.
          const probe = response.clone();

          // Volontairement sans await : l'enregistrement ne doit ni retarder
          // ni faire échouer la tâche que l'utilisateur vient de lancer.
          void (async () => {
            if (!(await succeeded(probe))) return;
            for (const paths of selections) {
              await recordSelection(paths);
            }
          })().catch((err) => {
            console.error("[QuickFolders] failed to record selection", err);
          });
        }
      }
    } catch (err) {
      console.error("[QuickFolders] failed to inspect request", err);
    }

    return response;
  };
}
