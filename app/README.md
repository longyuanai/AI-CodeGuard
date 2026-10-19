# AI-CodeGuard GitHub App MVP

Single-tenant, self-hosted PR scanning service. Hono receives signed webhooks;
Octokit authenticates as a GitHub App installation. The existing scanner runs
in-process against head-SHA content, without cloning or executing repository code.

Local verification (2026-10-19): 30 app tests pass on Windows/Node 18.20.8 and 24.18.0,
including a real loopback Node HTTP
`/healthz` request and signature rejection. GitHub API and LLM tests use mocks.
Docker build/container health and real GitHub/paid-provider integration are **not verified**.
See [acceptance evidence](../docs/dev/M8-VALIDATION.md).

## Run locally

From the repository root, use Node 22 (manifest minimum: 18.14.1). Node 18 passed
local checks but three transitive packages declare newer engines; it is not a
fully supported dependency configuration. See the acceptance record for paths.

```sh
npm ci --ignore-scripts
npm run build
npm run build -w app
npm run typecheck -w app
npm test -w app
npm start -w app
```

Set the required variables below in the launching process before `npm start`.
No dotenv file is automatically loaded. To check startup without contacting GitHub,
use `APP_ID=1`, `PRIVATE_KEY=offline-test`, `WEBHOOK_SECRET=offline-secret`, and
`ALLOWED_REPOSITORIES=owner/repo`; `/healthz` works but PR processing requires real credentials.

Windows PowerShell liveness demo (synthetic credentials, no GitHub/LLM calls):

```powershell
$env:APP_ID = '1'
$env:PRIVATE_KEY = 'offline-test'
$env:WEBHOOK_SECRET = 'offline-secret'
$env:ALLOWED_REPOSITORIES = 'owner/repo'
npm start -w app
# In a second terminal: Invoke-RestMethod http://127.0.0.1:3000/healthz
```

`GET /healthz` returns `200 {"status":"ok"}`. `POST /webhook` is the only webhook route.
The endpoint checks process liveness, not GitHub credential validity.

## Deployment environment

| Variable | Required/default | Meaning |
|---|---|---|
| `APP_ID` | required | Numeric GitHub App ID |
| `PRIVATE_KEY` | required | PEM contents; literal `\n` is accepted; never a repository file |
| `WEBHOOK_SECRET` | required | Shared webhook signing secret |
| `ALLOWED_REPOSITORIES` | required | Comma-separated `owner/repo` allowlist, case insensitive |
| `PORT` | `3000` | Listening port |
| `CODEGUARD_PROVIDER` | `claude` | Deployment-selected `claude` or `openai` |
| `CODEGUARD_API_KEY` | optional | Preferred BYO LLM key |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | optional | Fallback for the selected provider, matching CLI key precedence |
| `CODEGUARD_MODEL` | Sonnet default / `gpt-4o-mini` | Deployment model; must match the core pricing table when using Stage 2 |
| `CODEGUARD_MAX_COST` | `1` | Finite nonnegative USD estimate ceiling per processing attempt |
| `CODEGUARD_FAIL_ON` | `high` | `none`, `low`, `medium`, `high`, `critical`, matching CLI threshold semantics |

The App obtains its bot login from the authenticated `/app` endpoint; repository
content cannot nominate a comment author. Keys are never included in prompts,
comments or logs. GitHub traffic is pinned to `https://api.github.com`;
hosted LLM traffic is pinned to the selected official Anthropic/OpenAI origin.
Redirects are rejected. Alternate SDK endpoint environment variables are ignored
in App mode. CLI provider behavior stays unchanged.

## GitHub configuration (operator action)

Register/install an App only when ready to perform the external integration.
Repository permissions: **Contents: read**, **Pull requests: write**, **Checks: write**
(Metadata read is implicit). Subscribe to **Pull request** events. Configure an
HTTPS webhook URL ending in `/webhook`, with the same `WEBHOOK_SECRET`.
Only `opened`, `synchronize`, `reopened` are handled; other valid events return 202.
No Actions secrets are read by this service. BYO keys belong to its deployment environment.

Use one service replica. Webhooks are acknowledged with 202 before scanning;
one in-memory worker serializes jobs, with at most 10 pending jobs. Delivery IDs
are cached for one hour (maximum 1,000). Comments provide durable fingerprint
deduplication after a restart. This is not a durable queue: interrupted jobs and
503/failed processing require operator redelivery from GitHub's delivery UI.
Duplicate attempts may repeat LLM work; the budget is per attempt, not cumulative
across all pushes/redeliveries for a PR. Multiple replicas need shared coordination,
which is outside this MVP.

## Repository data and limits

Supported changed files are downloaded via Contents API at the exact PR head SHA,
including fork heads when the installation token can read them. Unsupported/deleted
files are omitted. Source is limited to 1 MiB/file and 20 MiB total; at most 300
changed files are considered. Larger PRs get summary-only findings and a partial
result. Diff limit: 20 MiB; GitHub response limit: 32 MiB; webhook body limit: 1 MiB.
Unavailable, unsafe, binary or oversized source is skipped with a summary note;
missing optional metadata is allowed only on 404. Other metadata/API errors fail the scan.

Only head-root `.codeguard.yml` (64 KiB) and `.codeguard-baseline.json` (1 MiB)
are loaded. YAML is data only: aliases, unknown tags and malformed documents are
rejected. Repository `rules.preset`, `rules.disable`, simple `scan.exclude` globs,
baseline and inline suppressions are respected. Explicit changed-file paths replace
include globs. Excludes are limited to 100 patterns of 256 characters; brace,
bracket and extglob syntax is rejected. `rules.custom`, JS/TS config, repository
keys/provider/model/concurrency, cache and output paths are ignored. No scripts,
package installation, repository hooks or custom rule code are executed.

Repository `llm.maxCostUSD` may lower the deployment ceiling but cannot raise it.
With a key, the core reserves a conservative request estimate (prompt UTF-8 bytes
plus 1,024 protocol tokens and a 600-token output maximum) before sending. Calls
are sequential, with no automatic provider retries; reservations stay consumed on
failure. Cost estimates depend on the core's built-in pricing table, not live
billing: verify model pricing before paid use. Large contexts may be deferred even
when actual tokenization would have cost less. Without a key, the service makes
zero LLM calls and labels inline and summary comments **未经 AI 分诊**.

Confirmed findings receive inline comments; AI dismissals are folded in the summary.
Budget-deferred (`dismissed-by-budget`, not an AI verdict) and provider-error
candidates are listed separately, with no confirmation claim. The Check is
`failure` for reported findings at the configured threshold, otherwise `neutral`
for partial/untriaged/error results, otherwise `success`. In no-key mode reported
Stage 1 findings use the same threshold with an explicit advisory label.
`CODEGUARD_FAIL_ON=none` never fails on findings but still keeps errors/partial scans neutral.

Temporary files are removed in `finally` on success and exceptions. Nothing is
persisted locally as a scan cache. A process kill cannot execute `finally`; use
an ephemeral container and a `/tmp` tmpfs. SIGTERM stops accepting requests and
drains the worker; set an adequate stop grace period for active LLM calls.

## Container (local build not yet verified)

Build context must be the repository root. The runtime contains production
dependencies and built dist/wasm assets; project source/tests and secrets are not
copied. A local production-only install excludes Vitest, tsup, Vite and esbuild,
but retains TypeScript as cosmiconfig's optional runtime peer. This package-layout
check does not establish that the Docker image builds or runs.

```sh
docker build -f app/Dockerfile -t ai-codeguard-app:local .
# Put deployment variables in an untracked file outside the build context.
docker run --rm --name codeguard-app -p 127.0.0.1:3000:3000 \
  --env-file /secure/location/codeguard-app.env \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  --memory=512m --cpus=1 --stop-timeout=120 ai-codeguard-app:local
curl --fail http://127.0.0.1:3000/healthz
# Expected status: 401
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  -X POST --data '{}' http://127.0.0.1:3000/webhook
# Verify production dependencies, all 7 wasm assets and a zero-API PHP scan.
docker exec -i codeguard-app node --input-type=module < scripts/check-runtime.mjs
```

Run these shell commands from the repository root. The runtime check script is
sent over stdin and is not copied into the image. It fails for retained test/build
tools (including nested Tinypool), missing/empty wasm or a failed static scan.
Two app tests exercise its rejection paths; a fresh isolated production install
passes the real scan locally. Container execution remains unverified while the
Docker engine is unavailable. CI now defines all three checks and always removes
its test container.

Terminate public TLS at a reverse proxy and route only `/webhook` and `/healthz`.
Build a candidate image alongside the previous version; save its image ID and
deployment environment securely before replacing anything. Roll back by starting
the previous image with the same environment and redelivering interrupted events.
No database migration is required. This repository does not deploy automatically.

Compatible dependency repairs leave 3 high production audit entries from one
braces issue, plus development alerts including critical Tinypool (see acceptance evidence); this local MVP
has not passed a production security review. No live GitHub or paid API validation
is implied by the mock tests or liveness probe.
