DOCKER_CTX=kami
IMAGE=mull-io:latest
SERVICE=mullio

.PHONY: build build-server build-client docker-build compose-build up deploy logs ps prune shell

build:
	npm run build

build-server:
	npm run build:server

build-client:
	npm run build:client

docker-build:
	docker --context $(DOCKER_CTX) build -t $(IMAGE) .

compose-build:
	docker --context $(DOCKER_CTX) compose build

up:
	docker --context $(DOCKER_CTX) compose up -d

deploy: build compose-build up

logs:
	docker --context $(DOCKER_CTX) compose logs -f $(SERVICE)

ps:
	docker --context $(DOCKER_CTX) compose ps

prune:
	docker --context $(DOCKER_CTX) system prune -f

shell:
	docker --context $(DOCKER_CTX) exec -it $(SERVICE) sh
