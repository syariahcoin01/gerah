# Pintasan Gerah. Contoh:
#   make up                 # jalankan stack lokal (http://localhost:8080)
#   make dev                # mode pengembangan (API auto-reload, data demo)
#   make release TAG=0.1.0  # build image api+web, push :0.1.0 dan :latest
#   make deploy TAG=0.1.0   # di server: tarik image dari registry lalu jalankan

-include .env
export
TAG ?= latest
COMPOSE = docker compose
DEV = $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: up down dev logs test build push release deploy ps login

# build dulu (image api dipakai juga oleh worker), baru jalankan tanpa menarik dari registry
up:
	$(COMPOSE) build api web
	$(COMPOSE) up -d --pull never
	@echo "Gerah berjalan di http://localhost:$${HTTP_PORT:-8080}"

down:
	$(COMPOSE) down

dev:
	$(DEV) build api web
	$(DEV) up --pull never

logs:
	$(COMPOSE) logs -f --tail=100 api worker

ps:
	$(COMPOSE) ps

test:
	TAG=$(TAG) $(COMPOSE) run --rm --no-deps --pull never api python -m pytest -q tests

build:
	TAG=$(TAG) $(COMPOSE) build api web

login:
	@echo "Login ke $(REGISTRY) …"; docker login $(firstword $(subst /, ,$(REGISTRY)))

push:
	TAG=$(TAG) $(COMPOSE) push api web

# build + push versi bertag sekaligus :latest
release: build test push
	@if [ "$(TAG)" != "latest" ]; then \
	  for s in api web; do \
	    docker tag $(REGISTRY)/gerah-$$s:$(TAG) $(REGISTRY)/gerah-$$s:latest && \
	    docker push $(REGISTRY)/gerah-$$s:latest; \
	  done; fi
	@echo "Terkirim: $(REGISTRY)/gerah-{api,web}:$(TAG)"

# dijalankan di server (cukup docker-compose.yml, proxy/Caddyfile, .env)
deploy:
	TAG=$(TAG) $(COMPOSE) pull api worker web
	TAG=$(TAG) $(COMPOSE) up -d --no-build
	docker image prune -f
