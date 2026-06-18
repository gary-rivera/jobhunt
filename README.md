# jobhunt-server

Express + Prisma + Postgres (pgvector) + Ollama. See `job-aggregator-spec.md` for design.

## Setup

```bash
# 1. Install deps
npm install

# 2. Start Postgres (pgvector)
docker run -d --name jobhunt-postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jobhunt \
  -p 5432:5432 -v jobhunt-pgdata:/var/lib/postgresql/data \
  pgvector/pgvector:pg16

# 3. Install + start Ollama, pull required model
brew install ollama
brew services start ollama
ollama pull nomic-embed-text

# 4. Configure env
cp .env.default .env
# edit .env — see values below

# 5. Migrate
npx prisma migrate deploy
npx prisma generate

# 6. Run
npm run dev
```

## .env

```dotenv
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jobhunt?schema=public"
OLLAMA_HOST="localhost"
OLLAMA_PORT="11434"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"
OLLAMA_CHAT_MODEL="llama3.1:8b"
```

## Verify

```bash
curl http://localhost:3000/health
```

## Scripts

- `npm run dev` — dev server
- `npm test` — tests
- `npm run lint` / `npm run format` — lint / format
- `npm run prisma:seed` — seed default user
