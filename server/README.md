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

# 3. Install + start Ollama, pull required models (see "Ollama runs natively" below)
brew install ollama
brew services start ollama
ollama pull nomic-embed-text
ollama pull qwen2.5:7b

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
OLLAMA_CHAT_MODEL="qwen2.5:7b"
OLLAMA_EXTRACTION_MODEL="qwen2.5:7b"
OLLAMA_EXTRACTION_NUM_CTX="4096"
OLLAMA_EXTRACTION_MAX_HTML_CHARS="12000"
```

> In the Docker stack these are set in `docker-compose.yml` with `OLLAMA_HOST=host.docker.internal`.

## Ollama runs natively (NOT in Docker)

The Docker stack (`../docker-compose.yml`) deliberately has **no `ollama` container**.
Ollama runs on the **Mac host** instead, for two reasons:

- **Memory**: the Docker Desktop VM is capped (~3.8 GiB on an 8 GB Mac). A 7B model needs
  ~5–6 GiB and simply OOMs inside that VM. Native Ollama uses the full unified memory.
- **Speed**: native Ollama on Apple Silicon uses the **Metal GPU**; the Linux VM is CPU-only.

This means the stack has a **host dependency**: `docker compose up` does **not** start Ollama.
The host must be running it independently (launchd keeps it up across reboots via `RunAtLoad`).

### One-time host setup

1. Pull the models into the **host** Ollama: `ollama pull qwen2.5:7b && ollama pull nomic-embed-text`
2. Make Ollama reachable from the containers. By default it binds `127.0.0.1`, which
   `host.docker.internal` can't reach — it must bind `0.0.0.0`. Add to the launchd plist
   (`~/Library/LaunchAgents/homebrew.mxcl.ollama.plist`, under `EnvironmentVariables`):
   ```xml
   <key>OLLAMA_HOST</key>
   <string>0.0.0.0:11434</string>
   ```
   then reload: `launchctl unload <plist> && launchctl load <plist>`.
   > ⚠️ `0.0.0.0` exposes the Ollama API on your LAN. Fine on a trusted home network;
   > otherwise firewall port 11434.
   > ⚠️ `brew services restart ollama` may regenerate the plist and drop this binding —
   > re-check `lsof -iTCP:11434 -sTCP:LISTEN` shows `*:11434` after any service restart.

The containerized API reaches the host via `OLLAMA_HOST=host.docker.internal` (set in
`docker-compose.yml`). Extraction uses `qwen2.5:7b` at a reduced context window
(`OLLAMA_EXTRACTION_NUM_CTX=4096`, input capped by `OLLAMA_EXTRACTION_MAX_HTML_CHARS`) to
fit the M1. Inspect throughput/memory with `GET /metrics/ollama`.

## Verify

```bash
curl http://localhost:3000/health        # local dev
# or, against the Docker stack:
curl http://localhost:3000/metrics/ollama # confirms the API reaches host Ollama + per-call stats
```

## Scripts

- `npm run dev` — dev server
- `npm test` — tests
- `npm run lint` / `npm run format` — lint / format
- `npm run prisma:seed` — seed default user
