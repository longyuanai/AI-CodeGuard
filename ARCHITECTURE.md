# AI-CodeGuard 架构设计

> 本文描述当前源码中的模块、数据流与边界。测试、依赖审计、Docker 和真实外部联调的实际结果集中记录在 [M8 验收记录](docs/dev/M8-VALIDATION.md)，不以旧规划或 CI 定义代替运行证据。

## 1. 当前系统概览

AI-CodeGuard 使用 Node.js 和 TypeScript，提供 CLI、库入口和单租户自托管 GitHub App。核心扫描器支持 JavaScript / TypeScript / Python / Go / Java / PHP，包含 19 条内置规则及可选 YAML custom rules。各语言的规则覆盖不同，见 [README](README.md)。

- **Stage 1**：Tree-sitter 归一化解析与静态规则预筛。
- **Stage 2**：可选 Claude / OpenAI 确认、驳回及修复建议生成。
- `--dry-run` 明确停在 Stage 1；CLI 的非 dry-run 路径在有候选时需要 API key。
- 输出支持 `text` / `json` / `sarif` / `github`；GitHub 输出是 review payload，发布由调用方负责。

### 1.1 扫描数据流

```text
CLI (scan / init / rules)               库调用方 / GitHub App
    │ loadConfig()                         │ resolveConfig() / 显式配置
    └──────────────────┬───────────────────┘
                       ▼
                 scan(options)
    ├─ fast-glob 文件发现、按扩展名识别语言
    ├─ Tree-sitter → 归一化 AST → built-in / custom rules
    ├─ inline suppression → baseline → diff 变更行过滤
    ├─ Stage 2（可选）：cache → provider → confirm / dismiss
    ├─ 最低严重度过滤、ScanResult
    └─ Reporter（可选，report: false 时只返回结果）
```

Stage 2 缓存、composite GitHub Action、SARIF 上传 workflow 和 GitHub App MVP 均已有实现。源码存在、CI 定义存在、本机通过和外部联调通过是不同状态，具体证据见验收记录。

## 2. 目录与入口

```text
ai-codeguard/
├── src/
│   ├── lib.ts                   # 对外库入口
│   ├── cli/                     # Commander 命令与退出码
│   ├── scanner/                 # scan、baseline、diff、suppression
│   ├── parser/                  # Tree-sitter runtime、wasm 定位、语言适配器
│   ├── rules/                   # built-in rules、YAML custom rules、执行引擎
│   ├── analyzer/                # Stage 2、provider、托管模式固定出口
│   ├── cache/                   # 磁盘缓存与测试用内存缓存
│   ├── reporter/                # text / json / sarif / github
│   ├── config/                  # 配置搜索、数据解析、schema、默认值
│   └── types/
├── app/
│   ├── src/                     # server、auth、pipeline、review、启动入口
│   ├── tests/
│   ├── Dockerfile
│   └── README.md                # 启动、部署变量、容器与运维边界
├── action.yml                   # composite Action
├── .github/workflows/           # CI、Action smoke、SARIF 上传与发布定义
├── tests/                       # 单元、集成、精度/分诊语料与 fixtures
└── docs/
```

`package.json` 将 CLI 指向 `dist/index.js`，库导出指向 `dist/lib.js` 及其声明文件。`src/lib.ts` 暴露 `scan()`、配置解析、GitHub reporter、fingerprint、diff 工具、语言检测、托管 provider 及必要类型；导入库不会启动 CLI 或服务。

`tsup.config.ts` 构建两个入口，并复制 Tree-sitter core 和六种语言 grammar 的 wasm 到 `dist/tree-sitter/`。CLI 与库共用解析器，优先使用包内资产，缺失时解析 grammar 包中的 wasm；运行时按包的位置定位资产，不依赖调用者工作目录。

## 3. 扫描器与结果

`src/scanner/orchestrator.ts` 的 `scan()` 负责发现文件、加载规则、解析、运行规则、过滤候选、调用 analyzer 和生成报告。显式文件路径按字面匹配；目录按 include 展开。当前支持扩展名为 `.js`、`.jsx`、`.mjs`、`.cjs`、`.ts`、`.tsx`、`.py`、`.go`、`.java`、`.php`；默认 include glob 仅列出 `.ts/.js/.py/.go/.java/.php`，扫描其他支持扩展名需显式文件路径或相应 include。路径统一为 `/`，解析失败进入 `skipped`。

`ScanOptions.rootDir` 指定文件发现和 finding 相对路径的根目录，默认使用 cwd；diff 以这些相对路径匹配。App 每个任务传入独立 rootDir，并为 diff/baseline 传入绝对文件路径，不使用 `process.chdir()`。`report: false` 仅返回 `ScanResult`，避免输出源代码到服务日志；CLI 默认生成报告。

过滤顺序影响成本：

1. `codeguard-ignore` inline suppression 在 Stage 1 收集时生效，可由 CLI 关闭以审计隐藏项。
2. baseline 按 fingerprint 吸收已知 finding。
3. unified diff 仅保留与新增/修改行重叠的 finding。
4. 经过上述过滤的候选才进入 Stage 2；最低严重度在最终报告前应用。

`ScanResult` 包含 `files`、`suspicious`、`suppressed`、`baselined`、`diffFiltered`、`findings`、可选 `dismissedFindings`、`skipped`、`duration`、`llmCalls`、`estimatedCost` 和 `cacheHits`。Stage 2 驳回项保留作审计；核心扫描器在预算不足或 provider/响应解析异常时保留静态 finding。App 将这些未确认项单列，避免冒充 AI 确认结论。

## 4. 核心模块

### 4.1 Parser 与规则

Tree-sitter 解析后输出兼容的归一化 `ASTree`，语言适配器抽取调用名、对象、参数及完整表达式。规则主要消费 `function_call`、`template_string`、`string_concat`、`assignment` 等节点；不是直接操作 Tree-sitter 原生 AST。

规则由 TypeScript built-in rules 和运行时编译的 YAML custom rules 组成，共用 `check(node, ctx)`。引擎按语言过滤，消除相同位置和同 ruleId 的嵌套重复命中。覆盖注入、XSS、凭据/加密、路径/文件、敏感数据、反序列化、配置、SSRF、随机数、ReDoS、重定向、JWT 和 XXE。

CLI 的 `rules --list` 列出内置规则；`rules validate/create/test` 提供自定义规则工作流，`rules test` 复用 Stage 1 扫描。custom rule 加载/校验失败会中止扫描。当前轻量赋值关联不等于完整数据流分析；尚无跨文件符号解析、CFG 或完整污点传播。

### 4.2 Analyzer、缓存与成本

Analyzer 处理 provider 选择、prompt、JSON 响应、并发、预算及 `llmAnalysis` / `fix` 回填。prompt 将代码片段、上下文和 metadata 标为不可信数据；这一措施不能保证消除提示注入。修复建议仅作为输出，不自动改写源文件。

`cache.enabled` 为 true 时，扫描器注入 `FileCacheStore`。缓存键包含规则、provider、model、snippet、context、fix 开关及 schema 版本；命中可回放 confirmed/dismissed，不调用 LLM、不计调用成本。记录按 TTL 读取，损坏或读写失败降级为 miss/忽略写入。代码默认关闭缓存，`init` 模板默认开启；App 不启用持久缓存。详见 [缓存设计](docs/design/CACHING.md)。

定价来自内置 pattern 映射。设置 `llm.maxCostUSD` 时未知定价模型会报错；普通 CLI 的并发在途调用可能使估计成本超过阈值，之后不再启动新请求。App 使用更严格的串行预留策略（见 §5），估价仍不是实际账单保证。Analyzer 未实现跨 provider 自动 fallback；App provider 不自动重试。

### 4.3 Reporter 与 CI

Reporter 实现 text、JSON、SARIF 2.1.0 和 GitHub review JSON，承载静态 finding、LLM verdict、修复建议和调用/成本统计。`src/reporter/github.ts` 只格式化，不发送请求。

根目录 `action.yml` 已实现 composite Action：安装/构建扫描器、运行扫描并输出 SARIF 路径与 finding 数量；默认只跑 Stage 1。`.github/workflows/ci.yml` 定义根项目、App、精度、Action smoke 和容器检查；`security-scan.yml` 定义扫描、artifact 与 Code Scanning 上传。workflow 的执行结果和发布状态须另行验证。使用者应审核 workflow 的 PR/fork 权限边界，尤其避免在高权限上下文执行未审核的目标代码或配置。

容器 job 定义只读根文件系统、`/tmp` tmpfs、回环端口、health 200、无签名 401，
并通过 stdin 执行 `scripts/check-runtime.mjs`，检查生产包不残留测试/构建工具、
7 个 wasm 及真实 PHP 静态扫描。脚本可以对隔离生产安装复用；本机脚本通过不等于 Docker 通过。

### 4.4 配置与信任边界

CLI 配置加载顺序为：配置文件 → 环境变量覆盖 → Zod 校验与默认值，再由命令行参数覆盖。支持 `.codeguard.yml`、`.codeguard.yaml`、`.codeguard.json`、`codeguard.config.js`、`codeguard.config.ts`；JS/TS 配置属于本地受信代码加载路径，不能直接用于不可信 PR 服务。

配置域 `scan`、`rules`、`llm`、`output`、`cache` 均有运行时用途。`scan` 的 CLI output 参数默认 text，优先于配置 `output.format`。API key 支持 `CODEGUARD_API_KEY`，其次为所选 provider 的环境变量；model 与成本可由环境覆盖。

库的 `resolveConfig(raw, env)` 只解析数据，允许调用方显式传入可信环境。App 使用该入口并对白名单字段重新构造配置；不调用目标仓库的 `loadConfig()`。

## 5. GitHub App 数据流

`app/` 是 npm workspace，通过 `ai-codeguard` 库在进程内复用扫描器。Hono 暴露：

| 路由 | 行为 |
|---|---|
| `GET /healthz` | 进程存活检查，返回 200；不验证 GitHub 凭据有效性 |
| `POST /webhook` | 原文签名校验、事件/仓库过滤、去重后入队；无有效签名返回 401 |

```text
pull_request webhook
  → 验证签名、opened/synchronize/reopened、仓库 allowlist
  → delivery ID 去重 → 202 ACK → 有界串行内存 worker
  → installation token + 已认证 App bot 身份
  → PR 元数据、文件列表、diff；Contents API 按 head SHA 下载
  → 临时 rootDir + 白名单 YAML / baseline
  → scan(report: false, diffPath, baselinePath, dryRun = 无 key)
  → 按本 bot 评论 fingerprint / occurrence 去重
  → head 复查 → 内联 review + 可更新汇总 → Check Run
  → finally 清理本任务临时目录
```

App 不 clone、不安装依赖、不执行目标仓库脚本、hook 或 JS/TS 配置。配置与 baseline 仅读取 head 根目录 `.codeguard.yml` 与 `.codeguard-baseline.json`；目标 YAML 只允许规则 preset/disable、受限 exclude 和降低后的成本上限。仓库 key、provider/model、custom rule、cache 和 output 路径不能覆盖部署端设置。GitHub 请求固定官方 API origin，托管 LLM 请求固定官方 provider origin，拒绝重定向并忽略自定义 endpoint 环境变量。

扫描受文件数、单文件/总大小、diff、响应、webhook body 和路径安全检查限制；不可读、超限等未完整扫描项会记录 partial，而非宣称干净。纯重命名且无变更行的文件不扫描。内联只锚定 finding 范围内的变更行，并绑定 head SHA；422 回退汇总。只信任本 App bot 评论末尾的 fingerprint 标记，同片段按 occurrence 数去重；汇总通过固定标记更新同一条评论，同 head 复用 Check。

无 LLM key 时纯静态运行，内联和汇总注明“未经 AI 分诊”。有 key 时仅 AI 确认项发内联，dismissed、预算不足及 provider 错误项分别列入汇总。预算由部署端限定，仓库只能降低；发送前按 prompt 字节与输出上限保守预留，串行、无自动重试，失败不返还预留。

Check 结论优先级为：报告项达到部署阈值则 failure；否则 partial/未分诊/错误/过期 head 则 neutral；完整且未达到阈值才 success。`none` 不因 finding 失败，partial/error 仍 neutral。过期或关闭的 PR 不更新评论。

临时源码在正常、异常和过期 head 返回时通过 `finally` 删除，日志使用固定错误信息；进程强杀不能保证清理，部署建议 `/tmp` tmpfs。单副本内存队列不保证崩溃恢复，多副本没有共享锁；失败/丢失投递需人工 redelivery，可能重复 LLM 消费。预算按处理尝试计算，并非 PR 生命周期累计额度。

部署变量、权限、具体资源限制、停止/回滚及容器命令见 [App 部署说明](app/README.md)，协议细节见 [GitHub App 设计](docs/design/GITHUB_APP.md)。

## 6. 技术选型

运行时与开发环境统一要求 Node **24.x >=24.22.0 LTS**（`^24.22.0`），两个构建入口
target 为 `node24`；CI、Action 默认值与 Docker 同步。Node 18/20/22 的旧验证仅保留
作历史记录，不代表当前依赖组合支持这些版本。安全工具迁移与回滚证据见验收记录。

| 职责 | 实现 |
|---|---|
| CLI / 配置 / 文件发现 | Commander / cosmiconfig + Zod / fast-glob |
| Parser | web-tree-sitter + 六种语言 grammar wasm |
| Stage 2 | Anthropic / OpenAI provider，App 使用固定出口封装 |
| 构建 / 类型 / 测试 | tsup / TypeScript / Vitest |
| App HTTP / GitHub | Hono + Node adapter / Octokit App、Core、Webhooks |
| 交付形态 | CLI、ESM 库、composite Action、自托管 App Dockerfile |

具体依赖版本与运行环境要求以 package.json、lockfile 和验收记录为准。

## 7. 验证入口

根项目运行 build、test:run、precision、typecheck、lint；App 另行运行 build、test、typecheck、lint，并依赖已构建的根库。签名、重复事件、变更行、降级、预算、Check 映射和异常清理有本地测试；外部 API mock 不能作为真实 GitHub/付费 provider 联调证据。

[M8 验收记录](docs/dev/M8-VALIDATION.md) 统一保存实际命令、日志、容器检查、依赖告警与未验证项。历史专题中的旧测试数字和计划不代表当前验收。

## 8. 已知边界

- 当前检测仍以局部模式和轻量赋值关联为主，不是完整语义或跨文件安全审计。
- 缓存是 Stage 2 结果复用，不是文件级跳过或跨机共享服务；`.gitignore` 联动过滤尚未实现。
- 定价映射、并发预算、提示注入、评论长度及 GitHub API 权限/限流均有边界。
- App 是单租户、单副本 MVP，未提供持久队列、仪表盘、计费、多租户密钥存储或自动修复提交。
- Dockerfile / CI 的存在不代表镜像、跨平台矩阵、线上服务或真实联调已通过；以验收记录为准。
