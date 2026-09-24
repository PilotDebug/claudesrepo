.PHONY: help test new clean

help: ## Show this help
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-6s %s\n", $$1, $$2}'

test: ## Run all lab tests (or one: make test LAB=labs/go/hello)
	@scripts/test-all.sh $(LAB)

new: ## Scaffold a lab: make new LANG=python NAME=myidea
	@scripts/new.sh $(LANG) $(NAME)

clean: ## Remove build output and scratch files
	@find labs -type d \( -name target -o -name node_modules -o -name __pycache__ \) -prune -exec rm -rf {} +
	@find scratch -mindepth 1 ! -name .gitkeep -exec rm -rf {} +
