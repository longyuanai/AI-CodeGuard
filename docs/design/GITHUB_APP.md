# AI-CodeGuard GitHub App（PR 机器人）

> 状态：**MVP 已实现，本地验证**（2026-10-18）。源码位于 `app/`。Docker 镜像/容器健康、真实 GitHub 和付费 LLM 尚未验证。见 [部署说明](../../app/README.md) 与 [实际验收](../dev/M8-VALIDATION.md)。

## 1. 定位与差异化

定位是 **PR 内的 AI 告警分诊层**：

- Stage 1 静态预筛只扫 **PR 变更文件的新增/修改行**（零 LLM 成本）
- Stage 2 用**客户自己的 API key**（BYO-key）对候选做 confirm/dismiss 分诊，只把确认的真问题以内联评论贴回 PR，附解释与修复建议
- 已被 dismiss 的候选折叠进一条汇总评论（可展开），保持可审计而不刷屏

无 key 时仍报告静态候选，并在内联/汇总明确标注“未经 AI 分诊”。不执行目标仓库代码。

## 2. MVP 范围（公测版）

| 包含 | 不包含（后续） |
|------|----------------|
| PR opened / synchronize / reopened 触发，扫 diff 变更行 | 全仓扫描调度、定时任务 |
| 内联评论（finding 行）+ 一条汇总评论（严重度统计、dismissed 折叠区、baseline 吸收数） | 仪表盘、组织级视图 |
| BYO-key：单租户部署环境的 Anthropic / OpenAI key | 托管 key / 计费、多租户密钥存储 |
| 仓库 YAML 的安全字段白名单、baseline、inline suppression | App 侧规则管理 UI、目标仓库脚本执行 |
| Check Run 结论（`--fail-on` 语义映射到 check 状态） | 自动修复 PR（--fix 建议已有，autofix commit 后续） |
| 幂等：同一 commit 重复事件不重复评论（按 `codeguardFingerprint/v1` 去重） | |

## 3. 架构

```text
GitHub webhook (pull_request events)
   │
   ▼
App 服务（Hono + @octokit/app + @octokit/webhooks，单副本）
   ├─ 校验 webhook 签名 → 获取 installation token
   ├─ 202 ACK → 有界内存 worker；拉取 PR diff 和文件列表
   ├─ Contents API 按 head SHA 下载变更文件（不 clone、不执行）
   ├─ 调用现有 scan() 库入口（非 CLI 子进程）：
   │    paths = 变更文件；baseline = 仓库根 .codeguard-baseline.json（若存在）
   │    dryRun = 无客户 key 时 true（纯 Stage 1 降级模式）
   ├─ findings → 按 diff hunk 过滤（只评论 PR 实际触碰的行）
   ├─ 幂等去重：对比已有评论中的 fingerprint 隐藏标记
   └─ 输出：内联 review comments + 汇总评论 + Check Run
```

复用 `src/lib.ts` 的 `scan()`、reporter、diff、baseline、suppression、fingerprint 和成本控制。独立 `rootDir` 避免 `process.chdir()`；`report: false` 避免在服务日志输出源代码。CLI/库都优先加载包内 `dist/tree-sitter/` wasm，缺失时才解析 grammar 包。

最多处理 300 个变更文件，单文件 1 MiB，总量 20 MiB；diff 20 MiB，GitHub 响应 32 MiB，webhook 1 MiB。大 PR 仅扫前 300 文件、关闭内联并标记 partial。无法获取、非法路径、二进制、超限文件均记录跳过说明；不因跳过而声称干净。私有 fork 无读取权限时同样降为 partial。

单 worker 串行处理，最多 10 个待处理任务；delivery ID 缓存一小时、最多 1,000 个。评论标记在重启后仍能去重，但内存队列不耐崩溃，多副本没有分布式锁。丢失/失败/503 的任务须操作者从 GitHub 手动重投；重投可能重复 LLM 工作。

## 4. BYO-key 与隐私

- key 存储：仅部署环境；不读取仓库 Actions secret（Actions 方案见 §6）。`CODEGUARD_API_KEY` 优先，其次所选 provider 的 `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`，复用 CLI 的 key 优先级。
- provider/model 由部署端 `CODEGUARD_PROVIDER` / `CODEGUARD_MODEL` 决定。`APP_ID`、`PRIVATE_KEY`、`WEBHOOK_SECRET`、`ALLOWED_REPOSITORIES` 必填。bot 身份从认证的 `/app` 取得。
- GitHub 请求固定到 `https://api.github.com`，App LLM 请求固定到所选官方 Anthropic/OpenAI 地址；拒绝重定向，忽略 SDK 自定义 endpoint 环境变量。CLI provider 行为保持兼容。
- LLM payload = rule/title/severity、相对路径、location、language、snippet、约 ±3 行 context、metadata、fixRequested；**不发送整个文件/仓库**。系统 prompt 将代码视为不可信数据；不能据此保证完全消除提示注入。
- 无 key 降级：纯 Stage 1 模式照常工作（评论标注"未经 AI 分诊"），保证免费路径可用
- 数据保留：不持久化源代码或扫描 cache；日志只输出固定错误信息，不打印原始 API 错误、payload 或 token。临时目录在成功、异常、过期 head 时均通过 finally 清理；强杀无法执行 finally，部署建议 `/tmp` tmpfs。

目标配置仅读取 head 根目录 `.codeguard.yml`（64 KiB）和 `.codeguard-baseline.json`（1 MiB）。YAML 只作数据，拒绝 alias、未知 tag、重复 key、非法文档。支持 `rules.preset/disable`、简单 `scan.exclude`、降低后的 `llm.maxCostUSD`；显式文件列表替代 include。exclude 限 100 条/每条 256 字符，拒绝 brace/bracket/extglob。忽略仓库的 key、provider/model/并发、custom rule、cache、output 路径；不读取 JS/TS 配置、不安装或执行仓库 package/hook。

服务端 `CODEGUARD_MAX_COST` 默认每次处理 1 USD，仓库只能降低上限；0 表示不发请求。复用核心 pricing 表，发送前按 prompt UTF-8 字节数 + 1,024 token 协议余量 + 600 output token 上限预留预算。串行调用、无自动重试，失败预留不返还；估计可能比实际 tokenization 保守。未知 pricing 的模型失败为 neutral。**估价不是账单保证**，付费运行前须核对模型价格；每次 redelivery/push 的预算独立，不是 PR 全生命周期累计额度。

## 5. 评论格式与 Check Run

内联评论：

```markdown
🔴 **Code Injection (eval)** `CG-003` · CWE-95

Potential Code Injection ... Confirmed by Stage 2 analysis.

> Stage 2 (90% confidence): User input reaches eval.

<sub>Reported by AI-CodeGuard. Add `// codeguard-ignore CG-003` to suppress.</sub>

<!-- codeguard-fp: 0123456789abcdef -->
```

复用 `codeguardFingerprint/v1` 对应的 `fingerprintFinding()`：rule + 相对路径 + 归一化 snippet，不含行号。只信任本 App bot 评论末尾的标记，其他用户伪造的标记无效。同片段多个实例按 occurrence 数去重；已修复问题的旧评论保留讨论，汇总更新计数。

内联取 finding 范围内第一条变更行，绑定 `commit_id=head SHA`，每批最多 50 条；review 前复查 head，422 回退到汇总并标记 partial。评论按 100 条分页读取，最多 100 页。无 key 时每条内联都注明 **Stage 1 only — 未经 AI 分诊**。

汇总末尾固定为 `<!-- ai-codeguard-summary:v1 -->`，按 bot 身份和标记定位后编辑同一条 issue comment，内容为 head SHA、文件数、四级严重度、baseline/suppressed/diffFiltered、LLM calls/估计成本、partial/跳过说明，以及以下折叠区：

- Stage 2 dismissed：AI 驳回的候选及 reasoning。
- `dismissed-by-budget (not AI dismissed)`：预算不足而未发请求的候选。
- Untriaged after provider errors：调用或解析失败的候选。
- Findings without inline comments：大 PR、无有效锚点或 422 回退结果。

评论及 Check output 有限长，大结果可能截断，不能视为完整安全审计报告。预算/异常候选不作为 AI 确认结果发内联。

Check 名称 `AI-CodeGuard`，`external_id` 包含 PR number 与 head SHA；同 head 复用本 App 的已有 Check。部署端 `CODEGUARD_FAIL_ON` 默认 high，按下列优先级决定：

| 情况 | conclusion |
|---|---|
| 报告 finding 达到阈值；有 key 时仅 AI 确认，无 key 时为明确标注的静态 finding | `failure` |
| partial、未分诊/预算不足、扫描或评论出错、过期/关闭 PR | `neutral` |
| 没有达到阈值的 finding，且扫描完整 | `success` |

`none` 不因 finding 失败，partial/error 仍 neutral。过期 head 不更新 PR 评论；不自动批准、拒绝或合并 PR。

## 6. Actions 复用备选方案

不运行服务时可继续使用 [pr-review.yml](../examples/pr-review.yml) 与根目录 [action.yml](../../action.yml)：Actions checkout head，提供 diff，扫描变更行，使用 `GITHUB_TOKEN` 提交 reporter JSON；LLM key 来自使用者的 Actions secret。它复用扫描器和 reporter，但不是相同的托管服务/幂等汇总实现，不读取 App 部署凭据。

使用者须审核 workflow 的 PR/fork 信任边界；不要在高权限事件下执行未审核的 PR 脚本。App 使用 API 读取数据，无须执行目标 checkout。流程以示例和 [Action 文档](../dev/GITHUB-ACTION.md) 为准。

## 7. 当前验收边界

2026-10-19 重新执行根项目五项检查与 app build/test/typecheck/lint，全部本地通过。根测试 574 passed / 2 opt-in skipped，app 28 passed；app 测试包括 mock GitHub + 真实扫描器的完整签名 webhook 流程，以及限定 127.0.0.1 的编译后 Node 服务真实 HTTP 测试；**不是 GitHub 联调结果**。

Dockerfile 和 CI 定义已补；本地 Docker 引擎不可用，镜像构建、容器 health/401 与运行镜像依赖/wasm 检查未验证。隔离生产包的本机安装及 wasm 扫描通过，不能代替容器验证。远程 CI、GitHub 注册、上线、付费 API、npm/Release 均未执行。兼容依赖修补将 audit 包条目从 15 降到 7，生产从 5 降到 3；开发链仍有 2 个 critical 条目，审计未通过。版本、引入路径、触发条件与延期理由集中见 [验收记录](../dev/M8-VALIDATION.md)。
