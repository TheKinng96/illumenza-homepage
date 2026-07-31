# Illumenza homepage + blog.
#
# Every recipe goes through `mise exec --` because Ruby 3.x is mandatory here:
# the macOS system Ruby (2.6) cannot build the `ffi` native extension this
# gemset needs. `mise.toml` pins ruby = "3.3".

PORT ?= 4000
JEKYLL := mise exec -- bundle exec jekyll

.DEFAULT_GOAL := help
.PHONY: help setup serve drafts build check clean

help: ## Show this help
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk -F':.*?## ' '{printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  Override the port with:  make serve PORT=4321"

setup: ## Install Ruby 3.3 and gems (first time, or after Gemfile changes)
	mise install
	mise exec -- bundle config set path 'vendor/bundle'
	mise exec -- bundle install

serve: ## Run the site locally with live reload (default port 4000)
	@echo "→ http://localhost:$(PORT)/blog/"
	$(JEKYLL) serve --port $(PORT) --livereload

drafts: ## Same as serve, but also renders future-dated posts
	@echo "→ http://localhost:$(PORT)/blog/  (including future-dated posts)"
	$(JEKYLL) serve --port $(PORT) --livereload --future

build: ## Build the site into _site/
	$(JEKYLL) build --trace

check: ## Build, then run every assertion in script/check-build.sh
	mise exec -- bash script/check-build.sh

clean: ## Remove build output and caches
	rm -rf _site .jekyll-cache .jekyll-metadata
