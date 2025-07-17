build:
	docker compose build

up:
	export WATCH_FILES=0 && docker compose up -d

watch:
	export WATCH_FILES=1 && docker compose up -d

logs:
	docker compose logs -f -n 10

down:
	docker compose down

login:
	docker compose run -w /app payment-worker-one /bin/bash
