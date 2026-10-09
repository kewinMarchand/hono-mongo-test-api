# hono-mongo-test-api

Seconde API de test des boilerplates front, en NoSQL. Elle sert exactement le même contrat que [api-platform-test-api](../api-platform-test-api) (API Platform, PostgreSQL, port 8090) : mêmes chemins, mêmes paramètres, mêmes formes JSON, mêmes codes et messages d'erreur, mêmes données. Un front passe de l'une à l'autre en changeant une seule variable d'URL.

| Ressource        | Opération                    | Ce qu'elle renvoie                                                                          |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| `Task`           | `GET /api/tasks`             | Les 3 tâches de démonstration (`id`, `title`, `done`)                                       |
| `Article`        | `GET /api/articles`          | 3 articles (`id`, `slug`, `title`, `excerpt`, `publishedAt`), du plus récent au plus ancien |
| `ContactMessage` | `POST /api/contact_messages` | 201 et le message enregistré, ou 422 avec les violations en français                        |
| `Category`       | `GET /api/categories`        | L'arbre des 14 catégories du catalogue                                                      |
| `ProductList`    | `GET /api/products`          | Une page des 24 produits, filtrée et triée, avec le total et les compteurs de facettes      |

Le détail du contrat (formats, paramètres du catalogue, règles du formulaire, `X-Scenario`, CORS) est celui du [README de l'API Platform](../api-platform-test-api/README.md#consommer-lapi-depuis-un-front) : il s'applique tel quel ici, à l'exception des écarts listés plus bas.

## Stack

| Brique                                                    | Rôle                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| Node 24.14, TypeScript 6 (strict)                         | Exécution directe des `.ts` (type stripping natif de Node)        |
| Hono 4.13, @hono/node-server 2.1                          | Serveur HTTP                                                      |
| zod 4.6, @hono/zod-openapi 1.6                            | Schémas, validation, OpenAPI 3.1 générés depuis les mêmes schémas |
| Driver officiel `mongodb` 7.7                             | Persistance, collections typées, sans ODM                         |
| MongoDB 8.2                                               | Base de données, non exposée sur la machine                       |
| Vitest 5, ESLint 9 (typescript-eslint strict), Prettier 3 | Tests, lint avec les types, format                                |

## Prérequis

- Docker avec Compose v2.
- Le port 8091 libre sur `127.0.0.1`.
- Node 24.14 (`.nvmrc`) et Yarn 1 sur la machine pour les hooks Git et `make contract`. Le reste tourne dans le conteneur.

## Démarrage

```sh
make install    # image, dépendances, hooks Git, conteneurs
make db-reset   # collections validées, index, fixtures
```

L'API répond sur http://localhost:8091/api, Swagger UI sur http://localhost:8091/api/docs dans un navigateur.

Le projet Compose s'appelle `hono-mongo-test-api` : ses conteneurs, son réseau et son volume (`hono-mongo-test-api_mongo_data`) ne touchent à aucun autre projet. Le conteneur de l'API tourne avec l'UID de l'utilisateur courant.

## Commandes

`make help` liste tout. Les principales :

| Commande                                                     | Effet                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `make install`                                               | Image, `yarn install` dans le conteneur, hooks Husky, conteneurs                                          |
| `make up` / `make down`                                      | Lance ou arrête les conteneurs (la base est conservée)                                                    |
| `make db-reset`                                              | Recrée la base : validateurs `$jsonSchema`, index, mêmes fixtures que Doctrine                            |
| `make qa`                                                    | Lint (dont règles d'architecture), auto-test des règles, format, types, contrôle de `openapi.json`, tests |
| `make arch-selftest`                                         | Écrit six violations volontaires des règles d'architecture, exige l'échec d'ESLint, puis les retire       |
| `make lint` / `make format` / `make typecheck` / `make test` | Chaque étape seule                                                                                        |
| `make openapi`                                               | Exporte le schéma OpenAPI dans `openapi.json`                                                             |
| `make contract`                                              | Compare cette API à l'API Platform, les deux lancées (voir plus bas)                                      |
| `make logs` / `make sh` / `make mongo-sh`                    | Journaux, shell dans l'API, mongosh sur la base de dev                                                    |
| `make docker-build-prod`                                     | Image de production (`hono-mongo-test-api:prod`)                                                          |

## Basculer un front d'une API à l'autre

Les deux API ont les mêmes chemins sous `/api` : seule l'origine change.

```sh
# .env du front
API_URL=http://localhost:8090      # API Platform + PostgreSQL
API_URL=http://localhost:8091      # Hono + MongoDB

# types générés, identiques pour les schémas consommés par les fronts
API_SCHEMA_URL=http://localhost:8091/api/docs.jsonopenapi
```

Les origines CORS autorisées sont les mêmes (`CORS_ALLOW_ORIGIN`, surchargeable dans `.env`, voir `.env.example`).

## Client typé `hc`

Le type de l'application est exporté (`AppType`, `src/app.ts`). Un client TypeScript qui partage le dépôt, ou un test, l'utilise avec `hc` :

```ts
import { hc } from 'hono/client'

import type { AppType } from '../hono-mongo-test-api/src/app.ts'

const api = hc<AppType>('http://localhost:8091')

const response = await api.api.products.$get({ query: { category: 'feuillages' } })
if (response.status === 200) {
  const list = await response.json() // Catalog.ProductList, inféré depuis le schéma zod
  console.info(list.totalItems, list.facets.exposure)
}
```

`tests/integration/typedClient.test.ts` exerce ce typage avec `testClient`.

## Typage de bout en bout

Le domaine et le langage publié sont séparés. Le domaine porte le modèle, le contrat (`src/<module>/http/contract.ts`) porte tout ce qui doit rester identique à l'API Platform :

1. **Domaine** (`src/<module>/domain/`) : types en namespaces (`Task.Entity`, `Catalog.ProductList`, `ContactMessage.Violation`), constantes et règles pures, sans zod, Hono ni MongoDB. Les règles renvoient des violations neutres (`{ field: 'email', kind: 'invalidFormat' }`).
2. **Contrat** (`src/<module>/http/contract.ts`) : schémas zod nommés par `.meta({ id })` (composants OpenAPI), messages exacts, codes de contrainte Symfony, `phpTrim`. Il traduit les violations du domaine en `violations[]` de l'API Platform. Le compilateur vérifie qu'une réponse du domaine est assignable au type du contrat.
3. **MongoDB** : chaque adaptateur déclare le schéma zod de son document (`_id`, dates en `Date`, `categoryPath` dénormalisé). `Collection<z.infer<…>>` type les requêtes, et `toBsonSchema` (`src/shared/infrastructure/bsonSchema.ts`) traduit le même schéma en validateur `$jsonSchema` appliqué à la création de la collection : MongoDB refuse un document qui ne le respecte pas.
4. **HTTP et OpenAPI** : les routes sont déclarées par `createRoute` avec les schémas du contrat. La validation d'entrée, le type des réponses et `openapi.json` en sortent.
5. **Client** : `AppType` porte les types des routes jusqu'à `hc`.

## Architecture

```
src/
  app.ts                  composition : routes, CORS, erreurs, documentation, AppType
  database.ts             composition : dépôts MongoDB, schéma, remise à zéro avec les fixtures
  server.ts               connexion MongoDB, schéma, serveur
  config.ts               variables d'environnement, validées par zod
  task/ blog/ contact/ catalog/
    domain/               types, port du dépôt, règles pures (aucune dépendance)
    application/          catalogue seulement : cas d'utilisation searchProducts
    infrastructure/       schéma du document, adaptateur MongoDB, fixtures
    http/                 contract.ts (langage publié), routes createRoute, adaptation HTTP
  shared/
    http/                 négociation, problem+json, X-Scenario, CORS, query string PHP
    infrastructure/       connexion, création des collections, zod vers $jsonSchema
  scripts/                db-reset, export OpenAPI
tests/
  unit/                   règles pures
  integration/            HTTP via app.request contre un MongoDB réel
contract/                 comparaison automatique avec l'API Platform
tools/archSelftest.ts     auto-test des règles d'architecture
eslint.architecture.mjs   règles de dépendance entre modules et couches
```

Règles de dépendance, vérifiées par ESLint : le domaine n'importe que son propre domaine (ni zod, ni Hono, ni MongoDB), l'application que le domaine de son module, `http/` ni l'infrastructure ni un autre module, l'infrastructure ni `http/` ni un autre module, `shared/` aucun module. Tout import interne passe par `#/`, un chemin relatif qui remonte (`../`) est refusé.

Le catalogue calcule filtre, tri, pagination et compteurs disjonctifs en **une agrégation** : `$match` sur la branche (`categoryPath`), puis `$facet` avec la page, le total et un compteur par facette, chacun avec ses propres filtres. Les catégories (14 documents) sont lues à part pour résoudre la branche, renvoyer 404 et nommer les sous-catégories.

## Test de compatibilité

```sh
make contract   # API Platform sur 8090 et cette API sur 8091, lancées et avec leurs fixtures
```

`contract/cases.ts` liste 175 requêtes représentatives (tous les scénarios des tests fonctionnels de l'API Platform, paramètres invalides, négociation, erreurs, CORS). Chacune part vers les deux API, puis le script compare statut, `Content-Type`, en-têtes utiles (`Allow`, `Location`, `Access-Control-*`) et corps JSON normalisé : clés triées, clés de débogage Symfony (`trace`, `class`) retirées, origine des URL et dates-heures masquées, `id` d'un message de contact créé masqué. Il compare ensuite les deux documents OpenAPI : opérations, paramètres, codes de réponse et schémas consommés par les fronts (seule la réponse 413 du contact, documentée ici, est écartée). Toute différence est listée et fait échouer la commande.

Les variables `CONTRACT_REFERENCE_URL` et `CONTRACT_CANDIDATE_URL` changent les deux origines. Les requêtes `POST` créent des messages de contact dans les deux bases.

### Écarts connus

Signalés par le script sans le faire échouer :

| Cas                                                 | API Platform                                     | Ici                                                                                    |
| --------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `Accept: application/ld+json`                       | JSON-LD (Hydra)                                  | JSON simple. JSON-LD n'est pas reproduit                                               |
| Corps JSON `null`, nombre ou booléen sur le contact | 500, détail citant la classe PHP de la ressource | 500, même détail avec `ContactMessage`                                                 |
| Corps de plus de 64 Ko sur le contact               | 422 (message trop long), corps lu sans limite    | 413 `application/problem+json`, « Le corps de la requête ne doit pas dépasser 64 Ko. » |
| 404 ou 405 du routeur sans `Accept` JSON            | Page HTML de débogage Symfony                    | Même JSON qu'avec `Accept: application/json`                                           |

Non comparés, mais à connaître :

- **Échappement** : l'API Platform échappe les accents (`é`) et les barres obliques (`\/`), ici le JSON est en UTF-8 brut. Les deux sont équivalents une fois décodés.
- **En-têtes** : `Link`, `ETag`, `Vary`, `X-Debug-*` ne sont pas reproduits.
- **OpenAPI** : 3.1.0 ici, 3.2.0 côté API Platform. Pas de variantes `.jsonld` ni de schémas Hydra. Les paramètres tableau n'ont pas `style: deepObject`. Le corps du `POST` contact est un schéma en ligne, la réponse 201 référence `ContactMessage` comme côté API Platform. Vérifié avec `openapi-typescript` 7.13 (la version des boilerplates) : les types générés pour les 11 schémas comparés et pour les paramètres de `/api/products` sont identiques.
- **Nombres JSON** : `1.0` est vu comme un entier (JavaScript ne distingue pas `1.0` de `1`), PHP y voit un flottant. Seul le libellé d'une erreur de type change.
- **Routes absentes** : l'entrypoint `/api`, le suffixe de format (`/api/tasks.json`) et la redirection 301 des barres obliques finales.
- **Production** : une 500 y renvoie `Internal Server Error` comme détail. L'API Platform de comparaison tourne en dev, ce cas n'est pas comparé.

## Production

`make docker-build-prod` construit une image multi-étapes : dépendances sans `devDependencies`, sources `.ts` exécutées directement par Node, utilisateur `node`, port 8080, `APP_ENV=prod` (X-Scenario inactif). Elle attend `MONGODB_URI` et `MONGODB_DB`. Les collections et leurs validateurs sont créés au démarrage, les fixtures se chargent à part (`node src/scripts/dbReset.ts`).

## Intégration continue

`.github/workflows/ci.yml` lance MongoDB 8.2 en service, installe Node depuis `.nvmrc`, puis `make qa EXEC=` (les commandes tournent sur le runner, sans Docker Compose) et construit l'image de production.

## Licence

MIT
