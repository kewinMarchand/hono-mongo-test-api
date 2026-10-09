qa: lint format-check typecheck openapi-check test ## QA complète : lint, format, types, OpenAPI à jour, tests

lint: ## ESLint (typescript-eslint strict, avec les types)
	$(YARN) lint

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

.PHONY: qa lint format format-check typecheck openapi-check test
