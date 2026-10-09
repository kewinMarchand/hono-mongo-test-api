# CLAUDE.md — hono-mongo-test-api

Seconde API de test des boilerplates front, interchangeable avec `../api-platform-test-api` (8090). Les conventions générales sont dans `~/.claude/CLAUDE.md` : ce fichier ne note que les choix propres au projet.

## Règle d'or

**Le contrat est celui de l'API Platform**, pas celui qu'on trouverait plus propre. Toute modification d'une réponse se vérifie par `make contract` (les deux API lancées). Un écart assumé se déclare dans `contract/cases.ts` (`knownDifference`) et dans le tableau « Écarts connus » du README.

## Choix du projet

- **Architecture** : hexagonale légère par domaine (`task`, `blog`, `contact`, `catalog`), comme l'API Platform. `domain/` = schémas zod, types (`z.infer`, en namespaces), port du dépôt, règles pures, sans Hono ni MongoDB. `infrastructure/` = schéma zod du document, adaptateur, fixtures. `http/` = routes `createRoute` et adaptation HTTP. `app.ts` compose, `shared/` porte le transverse.
- **Une source de vérité** : le schéma zod du domaine. `.meta({ id })` (zod natif) nomme le composant OpenAPI, @hono/zod-openapi le lit, le domaine n'importe donc pas Hono. Le document MongoDB a son propre schéma zod, traduit en `$jsonSchema` par `toBsonSchema`.
- **Node exécute les `.ts`** (type stripping natif de Node 24) : pas d'étape de build, l'image de prod copie `src/`. D'où `erasableSyntaxOnly` (ni `enum`, ni propriétés de paramètre, namespaces de types en `declare namespace`), les imports en `.ts` et l'alias `#/` par le champ `imports` de `package.json` (résolu par Node, TypeScript et Vite sans configuration).
- **Identifiants entiers** : `_id` numérique (fixtures), compteur atomique `counters` pour les messages de contact, comme la séquence PostgreSQL. Catégories : `_id` = slug.
- **Pagination** : `page` bornée à 1 000 000 (`MAX_PAGE`), comme l'API Platform, pour garder le décalage dans les entiers sûrs.
- **Catalogue** : `categoryPath` (slugs de la racine à la feuille) dénormalisé sur chaque produit. Filtre de branche = `{ categoryPath: slug }` sur un index multiclé, compteur de sous-catégorie = `$unwind` + `$group` sur ce même champ. Une agrégation `$facet` calcule page, total et compteurs disjonctifs. Tri stable par `_id` en second critère (le `usort` de PHP 8 est stable), collation `fr` seulement pour le tri par nom, pour garder les index des autres requêtes.
- **Paramètres du catalogue** : lus par `parsePhpQuery` avec la sémantique PHP (dernière affectation gagnante, `a[]`, `a[k]`, `%5B` en toute casse), puis `parseCriteria` (domaine) ignore toute valeur invalide. Le schéma `request.query` de la route est documentaire (`z.unknown().meta({ type })`) : un validateur zod rejetterait ce que l'API Platform ignore.
- **Formulaire de contact** : `bodyLimit` à 64 Ko (413 problem+json en français, écart assumé : l'API Platform lit tout le corps), `requireJsonContentType` (415), `negotiateFormat` (406), `scenario`, puis `deserializeContactMessage` reproduit le serializer Symfony (500 « Syntax error », identifiant fourni, type invalide dans l'ordre du corps). Les contraintes (NotNull, NotBlank, Length avec `trim` PHP et comptage en points de code, Email HTML5, maximum 255 pour le nom et l'e-mail, 5000 pour le message, messages de dépassement en français identiques à l'API Platform) sont dans `contactMessageViolations`, branchées sur le schéma par `superRefine`. Les codes de contrainte Symfony sont renvoyés tels quels.
- **Erreurs** : classes dédiées (`CategoryNotFoundError`, `ContactMessageValidationError`, `NotAcceptableError`…), traduites en `application/problem+json` dans `app.onError`. Le corps prend la forme JSON-LD d'API Platform (`@context`, `@id`, `@type`, `description`) sauf si le client demande explicitement `application/json` ou n'envoie pas d'Accept (`errorFlavor`). Routes inconnues : JSON du routeur Symfony, 405 avec `Allow`.
- **CORS** : réécrit à la main (`shared/http/cors.ts`) pour reproduire nelmio/cors-bundle, dont le préflight diffère du middleware `cors` de Hono (200 et non 204, en-têtes renvoyés à une origine refusée, 400 « Unauthorized header »). Regex insensible à la casse dans `CORS_ALLOW_ORIGIN`.
- **X-Scenario** : middleware par route, désactivé quand `APP_ENV=prod`. Ordre identique à l'API Platform : 415, 406, puis scénario, puis lecture du corps.
- **Tests d'intégration** : `app.request` contre un MongoDB réel (celui de Compose, ou le service de la CI), une base par fichier (`app_test_<nom>`) pour que les fichiers tournent en parallèle. Pas de mongodb-memory-server : il télécharge un binaire `mongod` à l'installation, d'une version qui ne serait pas celle de l'image, et le service Compose existe déjà.
- **Docker** : MongoDB non publié sur l'hôte, API sur `127.0.0.1:8091`. Les commandes `make` passent par `docker compose exec -T api` (`EXEC=` en CI), sauf `make contract` qui tourne sur l'hôte pour joindre 8090 et 8091.

## Versions, et pourquoi

| Brique                                       | Version                                     | Raison                                                                                                                     |
| -------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Node                                         | 24.14 (`.nvmrc`, image `node:24.14-alpine`) | Demandé. Type stripping stable, sans avertissement                                                                         |
| TypeScript                                   | ~6.0.3                                      | Même ligne que les boilerplates. typescript-eslint 8.71 exige `<6.1.0`, TypeScript 7 est donc exclu                        |
| hono / @hono/zod-openapi / @hono/node-server | 4.13 / 1.6 / 2.1                            | Versions vérifiées demandées                                                                                               |
| zod                                          | 4.6                                         | `z.toJSONSchema` natif, `.meta()` lu par zod-openapi                                                                       |
| mongodb (driver)                             | 7.7                                         | Driver officiel, pas d'ODM : les schémas zod suffisent                                                                     |
| MongoDB                                      | **8.2** (8.2.12)                            | `mongo:8` (8.3.8) refuse de démarrer sur un noyau Linux ≥ 6.19 (SERVER-121912). 8.2 démarre sur le noyau 7.0 de la machine |
| ESLint                                       | 9                                           | Même ligne que les boilerplates (typescript-eslint accepterait aussi la 10)                                                |
| Vitest / Vite                                | 5.0 / 8                                     | Vitest 5 attend `vite` en dépendance pair, à installer explicitement                                                       |

## Dépendances ajoutées, et pourquoi

- `@hono/swagger-ui` : Swagger UI sur `/api/docs` (navigateur), comme l'API Platform. Sans Accept HTML, `/api/docs` sert le JSON OpenAPI.
- `vite` (dev) : dépendance pair de Vitest 5.
- `globals`, `@eslint/js`, `typescript-eslint` (dev) : configuration ESLint plate.

## Règles de lint ajustées

- `@typescript-eslint/no-unused-vars` avec `ignoreRestSiblings: true` : retirer un champ d'un document par déstructuration (`{ _id, categoryPath, ...product }`) est l'écriture la plus lisible, la variable écartée est voulue.
- `@typescript-eslint/consistent-type-assertions` en `never` : aucun `as` (hors `as const`), le narrowing passe par des gardes ou par zod.
- `@typescript-eslint/no-namespace` avec `allowDeclarations` : namespaces de types uniquement (`declare namespace`).
- `no-console` autorise `info`, `warn`, `error` : journal de démarrage et scripts.

## Pièges rencontrés

- **`mongo:8` ne démarre pas** sur ce noyau (7.0) : message « Linux kernel versions 6.19 and newer has a known incompatibility ». Image épinglée en `mongo:8.2`, y compris en CI.
- **`$jsonSchema` n'est pas du JSON Schema** : MongoDB refuse `type: "integer"`, `$schema`, `format`, `default`. `toBsonSchema` réécrit tout en `bsonType` (`int`/`long` pour les entiers, `date` pour `z.date()` via `override`) et retire les bornes d'entier sûr que zod ajoute.
- **`.meta({ id })` et `z.toJSONSchema`** : un sous-schéma nommé produirait `$defs`/`$ref`, refusés par MongoDB. Les schémas de document ne réutilisent donc aucun schéma nommé (les énumérations `exposureSchema`/`sizeSchema` ne le sont pas).
- **zod-openapi ne sait pas documenter `.catch()`** (`UnknownZodTypeError`) : d'où `z.unknown().meta({ type })` pour les paramètres du catalogue.
- **Hook de validation** : en échec, le résultat n'expose pas `data` dans ses types. Les violations sont relues depuis les issues zod (`violationsFromIssues`, code Symfony dans `params.code`).
- **Tableau JSON sur le contact** : PHP le désérialise comme un objet sans champ, donc 422 sur les trois champs. zod rejette un tableau à la racine, le hook le ramène à `{}`.
- **Symfony normalise la query string** avant API Platform : `exposure%5b%5d` (minuscules) filtre comme `exposure[]`. Trouvé par le test de contrat.
- **Forme des erreurs selon Accept** : `*/*`, `application/*`, un type inconnu ou `application/json; charset=utf-8` donnent la forme JSON-LD. Seuls `application/json` explicite et l'absence d'Accept donnent la forme simple. Le Content-Type reste `application/problem+json`.
- **415 avant 406** sur le `POST`, et `X-Scenario: error` avant la lecture du corps (un JSON invalide reçoit la 500 simulée).
- **`fetch` ajoute `Accept: */*`** : le script de contrat passe par `node:http` pour maîtriser chaque en-tête (l'absence d'Accept change la forme des erreurs).
- **`curl` et les crochets** : sans `-g`, curl interprète `[...]` comme un motif. Toujours `curl -g` pour tester les paramètres du catalogue.
- **Husky dans le conteneur** : pas de `git` dans l'image, `husky` y échoue. `make install` installe les hooks depuis l'hôte, `prepare` est `husky || true`.
- **`c.json(body, status, { 'Content-Type': … })`** garde le Content-Type fourni : c'est ainsi que les erreurs sortent en `application/problem+json`.
