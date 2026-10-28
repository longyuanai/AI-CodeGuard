# AI-CodeGuard GitHub App MVP

Single-tenant, self-hosted PR scanning service. Hono receives signed webhooks;
Octokit authenticates as a GitHub App installation. The existing scanner runs
in-process against head-SHA content, without cloning or executing repository code.

Historical main acceptance (2026-10-20), commit
`045d4073ec8dd3a3c347b30bb2c61edfd35e2ae3`: all nine root/App checks passed on
Windows/Node 24.22.0, with 582 root passes/2 opt-in skips, 35 App passes,
precision 95.8%/recall 92.0%, and zero full/production audit vulnerabilities.
The same main push passed [Linux CI](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39387448393)
and [security-scan](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39387448454),
including real container build, isolation, HTTP 200/401, seven wasm assets and
static PHP scans. The local Docker engine was unavailable; those container
results are Linux CI evidence, not local Docker results. This is a correction of
the old snapshot, not a new 2026-10-21 regression run. The earlier 30-test snapshot
is retained in Git history and [historical acceptance](../docs/dev/M8-VALIDATION.md).
Real GitHub App integration, paid providers and other Node 24 patches remain
**unverified**. The [rehearsal below](#真实-github-app-联调手册待外部授权执行) prepares that work only.

**Published preview (2026-10-27):**
[selfhosted-preview-20261026.1](https://github.com/longyuanai/AI-CodeGuard/releases/tag/selfhosted-preview-20261026.1)
is fixed at `d5d474cf5d4d27fd103171276afc5967949708ed` and contains the Zod 4.6.6/OpenAI 6.0.0 remediation.
Use its [source ZIP](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261026.1/ai-codeguard-selfhosted-preview-20261026-source.zip),
[same-batch checksums](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261026.1/SHA256SUMS)
and [deployment snapshot](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261026.1/DEPLOYMENT.md).
Prepublication source-lock and clean consumer audits were zero. The hosted App pins
official provider origins and disables retries; the CLI retains trusted operator
endpoint configuration and SDK defaults. Live App and paid-provider integration remain unverified.

**Historical source fix (2026-10-26, before publication):** [PR #21](https://github.com/longyuanai/AI-CodeGuard/pull/21)
merged as `1c7cc64e`: Zod 4.6.6/OpenAI 6.0.0, bounded configuration collections,
605 root passes/2 opt-in skips, 35 App passes and zero complete/production audit alerts.
At that time, building fixed main was the available remediation. The old 20261022.1 source ZIP
still locks affected dependencies (2 high); its CLI's fresh production install
still reports 3 high in the dated assessment. Those attachments were not replaced;
the new batch was then a draft. This is not proof of exploitability in a real deployment.

Historical source download update (2026-10-25): the published
[selfhosted-preview-20261022.1](https://github.com/longyuanai/AI-CodeGuard/releases/tag/selfhosted-preview-20261022.1)
is fixed at `9b949df555ea1e215accf7659359bba358ebbeb1`.
It includes the Vitest/mocker 4.1.12 fix from [PR #19](https://github.com/longyuanai/AI-CodeGuard/pull/19).
The historical `selfhosted-preview-20261021.1` source ZIP retains the 4.1.11
development chain assessed on 2026-10-22; production CLI/App installs omit that
test chain. The dated audit results remain historical in
[M8 acceptance](../docs/dev/M8-VALIDATION.md). This download-entry update is not a
new regression or audit run.

**Historical dependency warning (2026-10-25, 20261022.1):** that CLI's isolated production
install audit reports **3 high package entries** (ai-codeguard/openai/zod,
aggregated from one [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)).
Zod `<4.6.6` can exhaust memory while validating oversized constrained collections;
the advisory's patched version is `4.6.6`. The small synthetic `--dry-run` demo is
not an exploit validation or proof of no risk. Dependencies were not upgraded and
CI audit gates were not bypassed; historical zero-audit results are not current.
The installed versions are Zod `3.25.76` and OpenAI `4.104.0`. CLI `--dry-run`
still parses configuration; untrusted config/custom-rule YAML needs bounded inputs.
The SDK4 peer then supported Zod 3; PR #21 later completed the compatibility migration.
The advisory patch addresses bounded collections, not every resource-exhaustion case.

## Run locally

From the repository root, use **Node 24.x >=24.22.0 LTS** for runtime and development
(`engines: ^24.22.0`). Older Node versions are no longer supported after the security
toolchain migration. Docker uses `node:24.22.0-bookworm-slim`; see the acceptance
record for actual execution evidence and rollback limitations.

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

## Container (verified in Linux CI; local engine unavailable at acceptance)

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
Two app tests exercise its rejection paths. A fresh isolated production install
and the real Linux CI container both pass vulnerable/safe PHP scans (1/0 findings,
zero API calls). CI verifies UID 1000, read-only root (EROFS), writable /tmp tmpfs,
HTTP 200/401, dependency pruning and all seven wasm assets, then removes its test
container. Docker uses a clean production-dependencies stage: npm prune left an
@vitest scope in the first actual image test. See the run links and failure/fix
evidence in [M8 acceptance](../docs/dev/M8-VALIDATION.md).

Terminate public TLS at a reverse proxy and route only `/webhook` and `/healthz`.
Build a candidate image alongside the previous version; save its image ID and
deployment environment securely before replacing anything. Roll back by starting
the previous image with the same environment and redelivering interrupted events.
No database migration is required. This repository does not deploy automatically.

The vulnerable fast-glob/micromatch/braces chain has been replaced with tinyglobby
0.2.16. Complete and production npm audits report zero vulnerabilities locally
and in Linux CI (2026-10-20). Audit and container checks are independent gates;
neither establishes a production security review. Live GitHub App integration
and paid-provider validation remain unverified.

## 真实 GitHub App 联调手册（待外部授权执行）

2026-10-21 本轮只准备文档和离线样本，以下注册、安装、启动、推送测试分支、创建
测试 PR、重投及清理步骤**均未执行**。后续逐项授权后操作；不要把私钥、Token 或
webhook secret 发到聊天、PR、截图或日志。不得在真实业务仓库照搬这些合成漏洞。

### A. 填写联调配置单

| 项目 | 待填写值 | 配置/核对位置 |
|---|---|---|
| 负责人和授权范围 | `__OPERATOR__ / __APP_OWNER__` | 记录允许注册/安装/测试部署/仓库写入的范围 |
| 测试仓库 | `__TEST_OWNER__/__TEST_REPO__` | 独立空白仓库；核对 clone 的 origin，禁止使用 AI-CodeGuard 本身充当目标 |
| 测试基线 | `__TEST_BASE_BRANCH__ / __BASE_SHA__` | 专用基线分支，无业务代码、Actions secrets、规则禁用、baseline 或 suppression |
| 运行环境 | `__TEST_HOST_OR_PLATFORM__` | 支持 Node `^24.22.0` 或本仓 Dockerfile 的隔离单副本；记录平台/启动者/停止方法 |
| 代码/镜像 | `__APP_SHA__ / __IMAGE_ID__` | 首次可固定已验收 main `045d4073ec8dd3a3c347b30bb2c61edfd35e2ae3`；记录实际构建 SHA 和镜像 ID |
| 旧版本回滚点 | `__PREVIOUS_SHA__ / __PREVIOUS_IMAGE_ID__` | 首次部署没有旧版本时填 NONE，回滚动作是停止测试服务 |
| HTTPS webhook | `https://__TEST_HOST__/webhook` | App registration 的 Webhook URL；测试反代转发到服务 `/webhook`，保留原始请求体和签名头 |
| 健康地址 | `https://__TEST_HOST__/healthz` | 相同反代到 `/healthz`；健康检查不证明凭据有效 |
| App/安装身份 | `__APP_ID__ / __APP_SLUG__ / __INSTALLATION_ID__` | GitHub App 设置和指定仓库安装记录；这些是标识符，不是 Token |
| secret 存放位置 | `__SECRET_STORE_REFERENCE__` | 只写 secret manager 引用或受限 env 文件路径，不写值；文件位于 checkout/build context 外 |
| 本轮资源标识 | `__RUN_ID__ / __CONTAINER_NAME__` | 测试容器、分支和证据统一命名，便于定点回收 |

占位符全部替换并复核后才能执行命令；本手册不假设已有域名、仓库、App 或服务器。
保留证据到操作者本地受限目录 `__EVIDENCE_DIR__`，不提交原始 webhook payload/响应头。

### B. App 注册与指定仓库安装（未来操作）

在所属个人/组织的 Developer settings → GitHub Apps 中配置：Repository permissions
仅 **Contents: read、Pull requests: write、Checks: write**（Metadata read 隐含）；
不申请 Actions、Administration、组织或用户权限。启用 webhook、配置上表 HTTPS URL
及安全保存的 secret，只订阅 **Pull request**。程序只处理 opened/synchronize/reopened，
其余合法事件 202 ignored；无需订阅 push/check_run 来触发扫描。

安装时选择 **Only select repositories**，只选配置单中的测试仓库；服务端
`ALLOWED_REPOSITORIES` 也只放同一个 `owner/repo`。不选 All repositories。
fork 场景另行授权并检查 head 仓库可读性；私有 fork 读不到应 partial/neutral，不能当作干净。
配置依据：[权限](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)、
[webhook 配置](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)。

### C. 首次运行：纯静态、成本 0

沿用上方环境变量表，在部署平台的 secret manager/进程环境中注入真实必填值。
无自动 dotenv 加载；容器可用 checkout 外的受限 env 文件。下面仅是模板，不能直接启动：

```dotenv
APP_ID=__NUMERIC_APP_ID__
PRIVATE_KEY=__INJECT_PEM_FROM_SECRET_STORE__
WEBHOOK_SECRET=__INJECT_FROM_SECRET_STORE__
ALLOWED_REPOSITORIES=__TEST_OWNER__/__TEST_REPO__
PORT=3000
CODEGUARD_MAX_COST=0
CODEGUARD_FAIL_ON=high
```

`PRIVATE_KEY` 接受 PEM 或包含字面 `\n` 的值。首次环境中 **不设置**
`CODEGUARD_API_KEY`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`；检查平台继承的变量，
只核对是否存在，不打印值。有 key + 成本 0 会产生预算未分诊/neutral，
与无 key 的 Stage 1 模式不是同一个预期。无需为这轮准备 LLM key。

Node 启动沿用上方 Run locally 的构建/`npm start -w app` 命令，置于测试平台防火墙和
HTTPS 反代之后，不直接暴露 3000。容器运行可用以下显式命名模板（Bash，未来执行）：

```sh
RUN_ID='__RUN_ID__'
APP_IMAGE='__VERIFIED_LOCAL_IMAGE_TAG_OR_ID__'
ENV_FILE='/__SECURE_LOCATION__/codeguard-app.env'
CONTAINER="codeguard-rehearsal-$RUN_ID"
# 填写并复核以上值，先记录旧镜像 ID/env 版本；不得将 env 文件复制入镜像。
docker run -d --name "$CONTAINER" --label "ai-codeguard.rehearsal=$RUN_ID" \
  -p 127.0.0.1:3000:3000 --env-file "$ENV_FILE" \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  --memory=512m --cpus=1 --stop-timeout=120 "$APP_IMAGE"
curl --fail http://127.0.0.1:3000/healthz
curl --silent --output /dev/null --write-out '%{http_code}\n' \
  -X POST --data '{}' http://127.0.0.1:3000/webhook
```

预期 200 和 401。之后从独立客户端验证配置单中的 HTTPS 地址同样 200/401，
反代不得重写/解析后重序列化 webhook JSON。不要关闭 TLS 校验来掩盖证书问题。
没有 HTTPS 地址时停在此处，不能宣布真实联调通过。Docker 不可用可使用隔离 Node
测试环境；2026-10-20 的 CI 容器通过不证明这个尚未提供的环境可运行。

### D. 样本、测试 PR 与预期（未来操作）

样本均为**只扫描、不执行**的函数，无顶层调用，无依赖或真实凭据。
[vulnerable.ts](../docs/examples/github-app/vulnerable.ts) 从原
[injection.ts 的 CG-003 模式](../tests/fixtures/vulnerable/injection.ts) 缩减，
去掉 SQL/命令执行等无关告警；安全/修复版本用 JSON 数据解析代替执行代码。
不要将三个状态一起复制进测试仓库，否则漏洞版本会一直存在。

| 源样本 | 测试仓库目标路径 | 全文件离线预期 | 完整 PR、无 key/阈值 high 时 |
|---|---|---|---|
| [safe.ts](../docs/examples/github-app/safe.ts) | `src/codeguard-probe.ts` | 0 findings | `success`，0 内联，1 条汇总 |
| [vulnerable.ts](../docs/examples/github-app/vulnerable.ts) | 同上 | 1 × **CG-003 critical**，第 3 行 | `failure`，1 条 CG-003 内联 + 汇总，明确未经 AI 分诊 |
| [fixed.ts](../docs/examples/github-app/fixed.ts) | 同上 | 0 findings | `success`，汇总当前计数归零；旧内联讨论保留 |

1. 在授权测试仓库创建专用 `app-rehearsal/base-__RUN_ID__` 基线，只有 safe 内容的
   `src/codeguard-probe.ts`；记录基线 SHA，推送前核对 origin 属于配置单测试仓库。
   不向业务默认分支提交或合并这些测试 PR。
2. 从这个基线创建 `app-rehearsal/safe-__RUN_ID__`，在该文件追加
   `export const rehearsalRevision = 1;`，提交并创建 **以专用基线为 base** 的安全 PR。
   等到 202 accepted **之后**检查该 App 身份的 Check/汇总，预期 success。
3. 从同一 safe 基线另开 `app-rehearsal/vulnerable-__RUN_ID__`，把目标文件替换为
   vulnerable 内容，提交并创建漏洞 PR。不能运行 eval 函数；仅由扫描器解析。
   预期表中 CG-003/第 3 行、绑定此次 head SHA，LLM calls/cost 都为 0。
4. 在漏洞 PR 追加 `rehearsalRevision` 常量并正常推送，触发 synchronize。
   PR diff 比较的是 **base…head，不是仅最后一次提交**：原 CG-003 仍为 1，Check 仍 failure；
   相同 fingerprint 不新增重复内联，汇总更新 head，当前 head 有新的 Check。
5. 同一漏洞 PR 改用 fixed 内容，正常提交/推送：预期 success、当前 findings=0，
   汇总编辑同一条而不是新增；历史内联不删除。确认 App 配置没有 baseline/suppression
   吞掉规则，不能以其他 CI 的绿色状态代替本 App 的 Check。
6. 在 App 设置 → Advanced → Recent deliveries 找到上述 delivery，保存 GUID/响应状态后
   使用 Redeliver。相同 delivery ID 在缓存窗口内应 202 duplicate、无新增工作；
   若 GitHub 产生新的 delivery ID 或服务已重启，允许重新扫描，但持久化的 bot 标记
   应避免重复内联/汇总，不能要求 LLM 消耗跨重投累计（此轮本来就为 0）。
   参考 [GitHub 重投说明](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/redelivering-webhooks)。

### E. 变更行、中文路径、重命名与不完整 diff

- **变更行隔离**：另建专用 `app-rehearsal/line-base-__RUN_ID__`，基线文件为 vulnerable
  内容并追加 `export const rehearsalRevision = 1;`（仅合成输入，不执行）。新 PR head
  只将常量改为 2，以这个 line-base 为 base。旧 eval 不在新增行，预期 0 findings、
  `Outside diff: 1`、success。不要用 safe base，否则旧 eval 对 PR 仍是新增行。
- **中文路径**：从 safe 基线开独立分支，将 safe 内容复制到 `src/中文探针.ts` 并记录
  一个基线提交；head 替换为 vulnerable。以该中文 safe 提交所在专用分支为 PR base，
  预期 1 × CG-003，内联路径是实际中文路径，第 3 行，Check failure。
  `git -c core.quotePath=true diff BASE...HEAD` 应呈现 Git 的转义路径，不能把转义字符串当成真实文件名。
- **重命名并修改**：从 safe 基线将 `src/codeguard-probe.ts` 重命名为 `src/重命名探针.ts`，
  同次提交改为 vulnerable。核对 GitHub Files changed/文件 API 实际是否标为 renamed
  （重命名由相似度推断，若显示 added/removed，记为该分支而非伪称验证了 renamed）。
  函数结构共用以保持相似度；预期新路径 CG-003/第 3 行、failure。另做 safe 的纯重命名，
  API additions=0 时预期无 finding、success。
- **不完整 diff**：不能通过编辑已签名 webhook 或手工截断 payload 来制造 GitHub 的
  文件 diff。真实 GitHub 不保证小样本产生截断；若未发生，证据标 **NOT_RUN（真实 API）**。
  已有离线回归可作为明确标记的 mock 辅助验证（需已构建根库）：

  ```sh
  npm exec -w app -- vitest run tests/pipeline.test.ts -t 'no usable diff lines|partially available diff|zero-addition binary'
  ```

  实际遇到时记录文件 API `additions` 与可用新增行数及跳过说明：缺少任何部分应 partial，
  没有达到阈值的 finding 时 Check neutral；若可见 CG-003 仍存在，则按阈值 failure。
  绝不能因缺行而 success。解析/下载异常可能只有 neutral Check，没有新汇总。
  过期 head 应停止发评论并 neutral；内联 422 应回退汇总并标 partial。

### F. 脱敏证据模板

每个用例复制一行，初始为 **NOT_RUN**；只有真实执行并取证才改 PASS/FAIL。
服务不输出 delivery ID/head 等请求内容到业务日志；这些字段取自 App delivery UI、
PR 页面及 Check 详情，HTTP 202 只是 ACK，不是扫描完成证据。

| 用例 | 状态 | UTC 时间 | delivery GUID / redelivery | PR URL / base SHA / head SHA | App 代码 SHA/镜像 ID | webhook HTTP | bot slug / 内联 ID、路径、行、fingerprint | 汇总 ID（前/后） | Check ID / head_sha / app.slug / conclusion | finding / skipped / partial / LLM calls / cost | 脱敏截图或本地文件 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `__CASE__` | NOT_RUN | `__UTC__` | `__GUID__` | `__PR__/__BASE__/__HEAD__` | `__SHA__/__IMAGE__` | `__HTTP__` | `__BOT_AND_ANCHOR__` | `__SUMMARY_ID__` | `__CHECK__` | `__COUNTS__` | `__EVIDENCE_REF__` |

留存版本/时间/结果及必要标识符即可。移除 Authorization、签名头、cookies、私钥、secret、
installation token、原始 webhook/body 及无关源码；不要导出全部平台环境或分享完整 delivery JSON。

### G. 常见错误定位

| 现象 | 核查与预期处理 |
|---|---|
| health 200 但没有 Check | health 只测存活；检查安装范围、白名单、事件/action、installation 权限和 App ID/key；202 ignored 不代表扫描 |
| 401 signature | 核对 secret 引用及代理是否原样转发 body/签名头；不要打印 secret 或禁用验签 |
| 413 / 400 | webhook 超 1 MiB 或事件字段/delivery ID 不合法；查看脱敏状态，不扩大限制绕过 |
| 503 | 10 个待处理任务队列已满，等待完成后按原 delivery 重投；不循环轰炸 endpoint |
| neutral / generic processing error | 先核对 Check 输出、head 是否过期、GitHub API 401/403/404、私有 fork 可读性、YAML/baseline 格式、文件/diff 上限；保留固定错误，别开启含 Token 的 HTTP debug |
| 有 key、预算 0 时 neutral | 清除部署继承的 LLM key 后重新启动；首次应是无 key 的 Stage 1 模式 |
| 漏洞 PR 意外 success | 对比 base…head、实际文件路径、排除项、rules.disable、baseline、inline suppression、阈值和 bot 身份；停测定位，禁止降低门槛 |
| 重命名锚点 422 / partial | 核对最新 head、API renamed/additions、Git 转义路径及汇总回退；不把旧 head 结果附到新提交 |
| 关闭后重开没扫描 | reopened 是允许事件；检查 delivery/服务队列；同一 delivery 缓存与 fingerprint 去重不等于所有工作重跑 |

### H. 停止、回滚和定点清理（未来操作，本轮不执行）

1. **暂停入口**：在测试安装的 Configure 中移除**仅本轮测试仓库**的访问；若安装专用于本轮，
   可 Suspend installation。共享安装不能整体暂停影响其他仓库。关闭 registration webhook
   会影响该 App 所有安装，只有专用测试 App 才能这么做。位置/范围见
   [GitHub 安装管理](https://docs.github.com/en/apps/using-github-apps/reviewing-and-modifying-installed-github-apps)。
2. **停止服务**：Node 前台用 Ctrl+C/SIGTERM 等待 worker 排空；由平台启动的仅停止记录的测试
   service ID。容器先核对本轮标签和名称，再正常停止；不 kill 其他 Node/Docker 进程：

   ```sh
   # CONTAINER/RUN_ID 必须来自本轮配置单，不使用默认生产名称。
   test "$(docker inspect --format '{{index .Config.Labels "ai-codeguard.rehearsal"}}' "$CONTAINER")" = "$RUN_ID" || exit 1
   docker stop --time 120 "$CONTAINER"
   docker rm "$CONTAINER"
   ```

   `/tmp` tmpfs 随该容器释放。App 正常/异常均 finally 清理自己创建的临时目录；强杀后的
   平台临时卷由负责人按记录的单一资源 ID 回收，不给出全机 `rm -rf`/批量 prune 命令。
3. **恢复旧版本**：使用配置单记录的旧镜像 ID及其 env secret 版本，重复 C 的同一单副本
   启动步骤（只替换 APP_IMAGE），复查 200/401，再恢复仅测试仓库访问并重投。
   Node 方式在独立 checkout 选择已记录旧 SHA，构建后由平台切换测试 service；不 reset main。
   无旧版本则保持停止。不要自动降级到有已知依赖告警的版本。
4. **失败投递**：GitHub 不自动替本服务恢复内存队列；负责人在 App Recent deliveries
   检查已完成/失败/202但未完成项，修复根因后逐个重投，记录新 GUID（若有）和结果。
   失败、关闭 PR、过期 head 与已完成任务分别登记；不要盲目批量重放所有历史事件。
5. **测试分支/PR**：保留脱敏证据后，按配置单的单一 PR/分支关闭和清理。例如：

   ```sh
   gh pr close __TEST_PR_NUMBER__ --repo __TEST_OWNER__/__TEST_REPO__
   # 仅此明确的本轮测试分支；先核对 origin，先保留 head SHA，不删除 main。
   git -C /__TEST_CLONE__ push origin --delete app-rehearsal/vulnerable-__RUN_ID__
   ```

   其他 safe/line/中文/基线分支逐个列名核对，不使用通配符或默认删除仓库。
   本地分支只在确认不用且安全切离后用 `git branch -d 精确分支名`；拒绝删除时保留，不强制清理。
6. **撤销专用凭据**：服务停止且测试访问已暂停后，在测试 App 设置删除本轮专用私钥
   （按 key ID/指纹核对），撤销本轮专用 Token（如曾创建；应用本身不需要 PAT），
   停用/轮换该测试 webhook secret，并清除平台该服务的 secret 版本/专用 env 文件。
   不撤销共享 App 的 key；轮换必须由其负责人另行安排。不要假定删除私钥立即撤销所有已发
   installation token，安装暂停/移除才是入口隔离步骤。记录撤销时间和 ID，不保留秘密值。
   保留脱敏证据和回滚标识，不保留原始凭据、客户代码或完整 HTTP dump。

### I. 本地离线复核样本（可在本轮执行）

在 AI-CodeGuard checkout、受支持 Node 下运行已构建 CLI；不要执行/导入样本函数：

```sh
node dist/index.js scan docs/examples/github-app/safe.ts --dry-run --output json --fail-on high
node dist/index.js scan docs/examples/github-app/vulnerable.ts --dry-run --output json --fail-on high
node dist/index.js scan docs/examples/github-app/fixed.ts --dry-run --output json --fail-on high
```

预期退出码为 **0 / 1（阈值命中，非工具故障）/ 0**，findings **0 / 1 × CG-003 / 0**，
均无 skipped/LLM calls/cost。完整九项/审计/容器历史门禁见顶部对应 main SHA 的运行，
本轮未因纯文档/合成样本变化重新声称执行这些验收。
