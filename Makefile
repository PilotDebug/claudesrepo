.PHONY: help test new site serve clean

help: ## Show this help
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-6s %s\n", $$1, $$2}'

test: ## Run all lab tests (or one: make test LAB=labs/go/hello)
	@scripts/test-all.sh $(LAB)

new: ## Scaffold a lab: make new LANG=python NAME=myidea
	@scripts/new.sh $(LANG) $(NAME)

site: ## Build the gallery website into site/dist
	@node site/build.mjs

serve: site ## Build the site and serve it on http://localhost:8000
	@python3 -m http.server 8000 -d site/dist

clean: ## Remove build output and scratch files
	@find labs -type d \( -name target -o -name node_modules -o -name __pycache__ -o -name build \) -prune -exec rm -rf {} +
	@rm -rf site/dist
	@find scratch -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
