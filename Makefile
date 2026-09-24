.PHONY: help test new project graduate site serve clean

help: ## Show this help
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-9s %s\n", $$1, $$2}'

test: ## Run all lab + project tests (or one: make test LAB=projects/e6b)
	@scripts/test-all.sh $(LAB)

new: ## Scaffold a language lab: make new LANG=python NAME=myidea
	@scripts/new.sh $(LANG) $(NAME)

project: ## Scaffold a web prototype: make project NAME=slug [TITLE="Nice Name"]
	@scripts/new-project.sh $(NAME) "$(TITLE)"

graduate: ## Export a project as its own deployable repo: make graduate NAME=slug
	@scripts/graduate.sh $(NAME)

site: ## Build the gallery website into site/dist
	@node site/build.mjs

serve: site ## Build the site and serve it on http://localhost:8000
	@python3 -m http.server 8000 -d site/dist

clean: ## Remove build output and scratch files
	@find labs -type d \( -name target -o -name node_modules -o -name __pycache__ -o -name build \) -prune -exec rm -rf {} +
	@rm -rf site/dist
	@find scratch -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
