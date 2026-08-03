.PHONY: install dev worker check up down logs migrate seed

install:
	npm ci

dev:
	npm run dev

worker:
	npm run dev:worker

check:
	npm run check

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api worker web

migrate:
	npm run db:migrate

seed:
	npm run db:seed
