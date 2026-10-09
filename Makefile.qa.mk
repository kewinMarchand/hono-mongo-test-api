qa: lint arch-selftest format-check typecheck openapi-check test ## QA complète : lint (dont architecture), auto-test des règles, format, types, OpenAPI à jour, tests

lint: ## ESLint (typescript-eslint strict, avec les types, et règles d'architecture)
	$(YARN) lint

arch-selftest: ## Écrit des violations volontaires des règles d'architecture, exige l'échec d'ESLint, puis les retire
	$(EXEC) node tools/archSelftest.ts

format: ## Prettier (écriture)
	$(YARN) format

format-check: ## Prettier (vérification)
	$(YARN) format:check

typecheck: ## tsc --noEmit
	$(YARN) typecheck

openapi-check: ## Vérifie que openapi.json correspond au schéma servi
	$(EXEC) node src/scripts/exportOpenapi.ts /tmp/openapi.json
	$(EXEC) diff -q openapi.json /tmp/openapi.json

test: ## Tests unitaires et d'intégration HTTP (Vitest, MongoDB de test)
	$(YARN) test

.PHONY: qa lint arch-selftest format format-check typecheck openapi-check test
