.DEFAULT_GOAL := help

export HOST_UID := $(shell id -u)
export HOST_GID := $(shell id -g)

COMPOSE ?= docker compose
# Préfixe des commandes Node. En CI il est vidé (EXEC=) : les commandes tournent sur le runner.
EXEC ?= $(COMPOSE) exec -T api
YARN = $(EXEC) yarn -s

include Makefile.qa.mk

help: ## Affiche cette aide
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: build ## Construit l'image, installe les dépendances, lance les conteneurs
	$(COMPOSE) run --rm --no-deps api yarn install --frozen-lockfile --ignore-scripts
	@if command -v node >/dev/null; then node_modules/.bin/husky; else echo "Node absent : hooks Git non installés"; fi
	$(MAKE) up

build: ## Construit l'image Docker de développement
	$(COMPOSE) build

up: ## Lance l'API (http://localhost:8091) et MongoDB
	$(COMPOSE) up -d --wait

down: ## Arrête les conteneurs (la base est conservée dans son volume)
	$(COMPOSE) down

logs: ## Suit les journaux des conteneurs
	$(COMPOSE) logs -f

sh: ## Ouvre un shell dans le conteneur de l'API
	$(COMPOSE) exec api sh

mongo-sh: ## Ouvre mongosh sur la base de dev
	$(COMPOSE) exec mongo mongosh -u app -p app --authenticationDatabase admin app

db-reset: ## Recrée la base de dev : collections validées, index, fixtures
	$(YARN) db:reset

openapi: ## Exporte le schéma OpenAPI dans openapi.json
	$(YARN) openapi

contract: ## Compare les réponses de l'API Platform (8090) et de cette API (8091), lancées toutes deux
	yarn -s contract

docker-build-prod: ## Construit l'image de production
	docker build --target prod -t hono-mongo-test-api:prod .

.PHONY: help install build up down logs sh mongo-sh db-reset openapi contract docker-build-prod
