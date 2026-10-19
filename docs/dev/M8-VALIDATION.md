# M8 本地交付与验收记录

最近复验：**2026-10-19**（Asia/Shanghai）。环境：Windows、Node **24.18.0**、npm **11.16.0**。
本轮起点：分支 `codex/m8-github-app-mvp`，HEAD
`75602a8bd39673dd313baf88bb8dba34ccf4ed5c`，仅原有 `ROADMAP.md`、`SECURITY.md` 未跟踪。
本轮完成兼容依赖修补、文档核对与交付复验，没有扩展功能；没有推送、发布、部署、
注册 GitHub App、写入真实仓库或调用付费 API。

M8 原实现日期为 2026-10-18，起点是 `main` / `cc43a84f87434b789cb7cad67b05ce81bdea2a3f`。
其 [原始日志](validation/M8-2026-10-18.log) 保留当时结果；下面的实际验证与审计表为 10-19 复验结果。

## 实际验证

[本轮命令与原始输出](validation/M8-2026-10-19-security.log) 包含九项退出码、测试计数、
precision、CLI fixtures、生产包检查及 Docker 引擎错误。测试代码的真实 HTTP 断言
验证 health 200 与无签名 401；外部 GitHub/LLM 响应仍使用 mock。

| 命令/检查 | 实际结果 |
|---|---|
| `npm run build` | 通过：CLI、lib、声明文件及 7 个 wasm 资产生成 |
| `npm run test:run` | **574 passed / 2 skipped**，18 文件通过、1 文件跳过；未减少任何原有测试 |
| `npm run precision` | **23 TP / 2 FN / 1 FP**，precision **95.8%**、recall **92.0%**，原 ratchet 未降低 |
| `npm run typecheck` | 退出 0 |
| `npm run lint` | 退出 0 |
| `npm run build -w app` | 退出 0，生成 `app/dist/index.js` |
| `npm test -w app` | **28 passed**，8 文件通过，无跳过 |
| `npm run typecheck -w app` | 退出 0，包含 app 源码与测试 |
| `npm run lint -w app` | 退出 0 |
| 编译后 CLI / vulnerable fixtures | 14 文件、**97 findings**、0 skipped、0 LLM calls、$0；通过 cosmiconfig 加载含 merge alias 的受信 YAML，复验 js-yaml 更新兼容性 |
| 编译后 CLI / safe fixtures | 8 文件、**0 findings**、0 skipped、0 LLM calls、$0 |
| 编译后 Node HTTP 服务 | 合成凭据启动真实子进程，测试 bootstrap 将监听限制为 **127.0.0.1**；`GET /healthz` → **200 `{"status":"ok"}`**，无签名 POST → **401** |
| 隔离生产包（非容器） | `npm ci --omit=dev --ignore-scripts` 成功；Vitest/tsup/Vite/esbuild 不在隔离安装中，TypeScript 作为 cosmiconfig 可选运行时 peer 保留；7 个 wasm 齐全，真实 PHP 静态扫描 1 文件/1 finding/0 LLM calls |
| 工作区检查 | `git diff --check`、修改内容凭据模式检查通过；文档相对链接存在 |
| Docker | 客户端 29.8.2；`docker version` 退出 1，`dockerDesktopLinuxEngine` pipe 不存在；**镜像构建、容器 health/401、运行镜像依赖/wasm 未验证**；未创建容器、未修改系统 |
| 真实 GitHub / 付费 LLM / 远程 CI | **未验证、未执行**。现有测试对外部 API 使用 mock |
| `npm audit --json` | **退出 1，未通过**：15 → **7** 包条目（2 critical / 3 high / 1 moderate / 1 low） |
| `npm audit --omit=dev --json` | **退出 1，未通过**：5 → **3 high** 包条目，均来自 braces；见下文 |

HTTP smoke 使用合成启动凭据，不会创建 JWT 或联系 GitHub；它验证真实服务监听、
路由和验签拒绝行为，不验证真实 App 凭据。本轮仅修改测试 bootstrap 的 bind，
未增加服务配置或改变容器监听行为。检查在允许本机回环连接的执行环境中完成。
`CODEGUARD_E2E=0`，两个付费 opt-in 测试保持跳过；没有删除测试或降低 precision ratchet。

## 10-19 依赖安全收尾

先读取原 `.artifacts/m8/audit.json`，再对当前 lockfile 做完整/生产审计；按 npm
包条目计数（含上游传播），**不等于独立漏洞数**。例如 3 个生产 high 条目是同一个
braces 问题沿 micromatch/fast-glob 传播；2 个 critical 条目是 Tinypool 与 Vitest 聚合条目。

| 范围 | 修补前 | 修补后 |
|---|---|---|
| 完整依赖树 | 15：2 critical / 10 high / 2 moderate / 1 low | 7：2 critical / 3 high / 1 moderate / 1 low |
| `--omit=dev` | 5 high | 3 high |

保留既有清单和锁文件，以 `npm update ... --package-lock-only --ignore-scripts` 定向
更新，再执行 `npm ci --ignore-scripts`。没有 `audit fix`、强制大版本更新或新增直接
生产依赖。Vitest 3.2.4 → **3.2.7**（清单下限同步），其 Vite 依赖允许 5/6/7；
原锁 Vite 7.3.2 要求 Node 20.19+/22.12+，与项目声明的 Node 18 不符，因此显式
override 为已修补的 **6.4.4**，使用上游允许的 Node 18 兼容 Vite 分支。
这不代表整套工具链兼容 Node 18：开发依赖 brace-expansion **5.0.12** 的 engines
由 `18 || 20 || >=22` 收窄到 `20 || >=22`，其 minimatch 10.2.5 父包仍声明支持 Node 18。
这是**尚未解决的 Node 18 开发链兼容风险**；没有为消除告警强制替换为不受支持的
依赖 major，也未擅自修改项目 Node 支持声明。本轮仅 Windows/Node 24 实测，
Node 18/20/22 与远程 CI 均未验证，不能把 Vite 分支选择描述为全链兼容保证。
新增锁节点主要是 Vite 6 所需 esbuild 0.25 的可选平台二进制，未重建整份锁文件。

### 已修补的告警及实际条件

下表列出受影响的原锁版本、引入路径和触发条件。链接为上游安全公告；未运行漏洞 PoC。

| 分类与引入路径 | 版本变化及受影响范围 | 使用条件与本项目边界 |
|---|---|---|
| 生产：`cosmiconfig → js-yaml` | **4.1.1 → 4.3.2**；4.x 各问题截至 `<4.3.2`，见 [merge/alias](https://github.com/advisories/GHSA-h67p-54hq-rp68)、[merge chain](https://github.com/advisories/GHSA-52cp-r559-cp3m)、[omap](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj)、[empty merge](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | 恶意 YAML merge/alias/omap 可耗尽 CPU；CLI 会加载 YAML 配置，故需修补。App 使用独立 `yaml` 包解析白名单配置，不用此配置加载器。更新后真实 CLI merge 配置 smoke 通过。 |
| 生产：`@anthropic-ai/sdk / openai → @types/node-fetch → form-data` | **4.0.5 → 4.0.6**；`>=4.0.0 <4.0.6`，[CRLF 公告](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) | 不可信 multipart 字段名/文件名可注入 CRLF。现有 provider 仅发 JSON；SDK multipart 路径另用 formdata-node，但生产安装仍包含 form-data，已修补而非以暂未调用忽略。 |
| 开发：`vitest` UI/API | **3.2.4 → 3.2.7**；`<3.2.6`，[UI 公告](https://github.com/advisories/GHSA-5xrq-8626-4rwp) | 需运行可访问的 UI/API server；本轮为 `vitest run`，未开放 UI。修补此问题不消除下方 Tinypool/mocker 告警。 |
| 开发：`vitest → vite-node / mocker → vite` | **7.3.2 → 6.4.4**；原 7.3.2 命中 [Windows 路径绕过](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) / [UNC 凭据泄漏](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) 公告的 `>=7.0.0 <=7.3.4` 范围 | 需可访问的开发服务器/编辑器路由；当前没有目标仓库 Vite server。选择受支持 6.x 分支，回归验证通过。 |
| 开发：`eslint → @humanfs/node` | **0.16.7 → 0.16.8**；`<0.16.8`，[symlink copy 公告](https://github.com/advisories/GHSA-p498-v437-472g) | 递归复制可跟随文件软链接读取源树外数据；当前 lint 读源码，不调用该复制接口，未来工具链调用仍有风险。 |
| 开发：`eslint → minimatch`、`typescript-eslint → typescript-estree → minimatch → brace-expansion` | **1.1.13 → 1.1.21**、**5.0.7 → 5.0.12**；各自低于目标修补版本有嵌套/展开 DoS，见 [最新修补公告](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | 不可信 brace pattern 可导致 CPU、栈或内存耗尽；lint/文件匹配会经过依赖链，同 major 更新两份安装。此包与仍未修补的 `braces` 是不同依赖。 |
| 开发：`tsup → postcss-load-config`、`vitest → vite → postcss` | **8.5.9 → 8.5.31**；原版本命中 `<=8.5.22` 范围内多条公告，见 [sourceMappingURL](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)、[路径加载](https://github.com/advisories/GHSA-r28c-9q8g-f849)、[CSS stringify](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | 不可信 CSS/map 可读本地 map/文件，CSS 输出进入 HTML 时可 XSS；当前构建 TypeScript，不处理目标仓库 CSS。仍修补构建链，不能泛称开发依赖无风险。 |
| 开发：`postcss → nanoid` | **3.3.11 → 3.3.20**；原版本在 `<=3.3.17` 影响范围，[负数](https://github.com/advisories/GHSA-28wg-ghj8-5hjv)、[零长度](https://github.com/advisories/GHSA-2v37-7h3g-55p8)、[溢出](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | 非安全/自定义生成器接收负数、零或溢出 size 可能循环/溢出；不是默认可信 size 都会触发。 |
| 开发：`postcss → source-map-js` | **1.2.1 → 1.2.2**；`>=1.0.0 <1.2.2`，[indexed map 公告](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | 恶意 indexed source-map section offset 可阻塞事件循环；现有构建不读取目标仓库 source map。 |

相关同系列配套更新包括 @vitest 子包、@humanfs/core、tinyspy、hasown 与 Vite 的嵌套
picomatch；未改变规则、扫描策略、App 生产代码或精度门槛。完整版本差异保存在本轮日志。

本轮修改文件：根 `package.json` / `package-lock.json`；仅约束回环监听的
`app/tests/runtime.test.ts`；`README.md`、`ARCHITECTURE.md`、`CHANGELOG.md`、
`docs/README.md`、`app/README.md`、`docs/design/GITHUB_APP.md`、本验收记录及
`validation/M8-2026-10-19-security.log`。当前架构已补齐库/App 数据流并修正
cache/Action 未实现的旧描述；历史专题通过导航明确标记，不重复新建状态文档。

### 仍未修补，审计不通过

| 包、级别与路径 | 受影响版本 / 安全修复边界 | 实际风险、现有约束与延期原因 |
|---|---|---|
| **生产 high ×3 条目**：`fast-glob 3.3.3 → micromatch 4.0.8 → braces 3.0.3` | `braces <=3.0.3`，[深嵌套 DoS](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)；本次 registry/audit 无已发布兼容修补 | 恶意 glob 可栈耗尽，CLI 的路径/配置匹配存在此输入面。App 显式文件路径转义、忽略 include，exclude 限 100 条/256 字符且禁用 brace/bracket/extglob，减少暴露；不能据此宣称整个依赖已安全。替换 glob 库或维护 fork 超出本轮兼容修补范围，待上游补丁。 |
| **开发 critical ×2 条目**：`vitest 3.2.7 → tinypool 1.1.1`（Vitest 为传播条目） | worker-options 问题 `<=2.1.0`，[公告一](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)；run-options 问题 `<2.1.2`，[公告二](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)；修补为 2.1.2 | 需上游原型污染，继承的 worker/filename 选项可转为代码执行；run 变体还涉及调用者传入 options。开发/CI 进程可受影响，不能标为无风险，也不是已证明的无认证 App RCE。Vitest 3 依赖 `^1.1.1`，无 1.x 修补；2.1.2 越过依赖 major 且要求 Node 20/22+，不能强制 override。需另行规划测试栈/Node 支持升级。 |
| **开发 moderate**：`vitest 3.2.7 → @vitest/mocker 3.2.7` | `>=2.1.0 <4.1.11`，[redirect mock 公告](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)；修补 4.1.11，3.x 无计划回补 | 暴露 standalone mocker/interceptor plugin 的 Vite HMR websocket 时可未认证注册越界文件重定向；browser RPC 有 token 认证。当前仅 run 模式、未启动上述 server，仍保留告警；跨 major 升级需独立兼容验证。 |
| **开发 low**：`tsup 8.5.1 → esbuild 0.27.7` | `>=0.27.3 <0.28.1`，[Windows serve 公告](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | Windows 上 `.serve()` 可任意文件读取；本项目 build/watch 未调用 serve。tsup 8.5.1 要求 `^0.27.0`，该系列无补丁；不强制越过 0.x minor。可另行评估父包回退或上游支持 0.28.1+，本轮优先 critical/high 兼容修补，明确保留此 low。 |

生产安装排除测试/构建链并不消除开发机、CI 或构建阶段风险。本机隔离生产包检查仅
证明上述包布局、wasm 和静态 scan 可用，**没有验证运行镜像**。TypeScript 仍由
cosmiconfig 可选 peer 留在生产安装中，未宣称运行包不含编译器。

## 10-18 历史基线恢复

初始 `npm ls tree-sitter-php --depth=0` 为空，本地缺少 wasm；原 package.json
已经声明 `^0.24.2`，锁文件已固定 `0.24.2`。按原锁执行
`npm ci --ignore-scripts` 后恢复，无需改版本。实际基线重新得到 build、typecheck、
lint 通过，**572 passed / 2 skipped**，precision/recall **95.8% / 92.0%**。
README 历史数字没有直接作为验收结果。

安装前原锁文件 SHA256：
`B6DF16586684A25EED8D073FC59FC39FFCAD1744F28574DCFCFAC8D1865CC3B4`。
恢复后哈希相同。10-18 后续锁文件只增量加入 workspace/App 依赖；逐项比较原始提交的
所有既有包版本，结果 `Existing locked version changes: []`。新引入的
`@hono/node-server` 因审计告警由 1.19.11 修补为 **1.19.17**；原 YAML 2.8.3
保持不变。没有执行 `npm audit fix` 或重建整个锁文件。

## 完成范围与文件

| 任务 | 交付与关键文件 |
|---|---|
| T0 (`b1a43b1`) | `src/lib.ts`、`package.json`/lock、`tsup.config.ts`、`src/parser/tree-sitter/languages.ts`、`src/scanner/orchestrator.ts`；app workspace/库冒烟测试 |
| T1 (`5652770`) | `app/src/server.ts`、`auth.ts`、`types.ts`；签名、事件/白名单、投递去重、installation 认证及测试 |
| T2 (`8857ff6`) | `app/src/pipeline.ts`；head SHA 下载、限额、安全路径、真实扫描器、baseline/suppression/diff 复用、finally 清理 |
| T3 (`5dd57dd`) | `app/src/review.ts`；本 bot fingerprint/occurrence 去重、汇总编辑、锚点过滤、422 回退、Check 复用与映射 |
| T4 (`895edac`) | `src/config/loader.ts`、`src/analyzer/index.ts`、两个 provider 与 `hosted-fetch.ts`；可信环境解析、固定出口、预算预留、降级和未分诊记账及测试 |
| T5 (`7879a63`) | `app/src/index.ts`、构建/类型配置、app 测试、`.github/workflows/ci.yml`；真实 HTTP、完整 mock webhook 流程、安全补丁、字面文件路径与 glob 限制 |
| T6 (`75602a8`) | `app/Dockerfile`、`.dockerignore`、`app/README.md`、根 README/CHANGELOG、`docs/design/GITHUB_APP.md`/`CODEX_PLAN.md`、本记录/日志；容器 CI 定义已补，运行验证待 Docker 可用 |

关键行为测试：签名缺失/伪造/原文不符拒绝；事件/仓库过滤；重复投递不再次执行；
重启后评论标记继续去重；新增 finding 只补差量；多个相同片段的 occurrence
计数；他人伪造标记无效；更新同一汇总；同 SHA 复用 Check；PR 行过滤在 Stage 2
前生效；无 key 零调用；key 优先级；零/小预算预拦截；provider 失败保持未分诊；
Check failure/success/neutral；错误不泄露密钥；正常/异常临时清理；baseline 与
inline suppression；路径穿越/Windows 别名；YAML tag/alias；超限文件；过期 head；
SDK 非预期 endpoint/重定向；CLI 与库加载 bundled wasm。均为本地离线测试。

原有 `ROADMAP.md`、`SECURITY.md` 始终未跟踪，没有修改或纳入提交。前后哈希：

- ROADMAP：`1BE82CE9F8FFCBF3D1B5D038E2E7C9DC035DA829285486C4D9D59150746B2D0D`
- SECURITY：`82EBDEB2185E9079937E50599F3DD881E14F2E0C42F1B0DCE063B16BCFCC9B9F`

## 剩余风险与未完成验收

1. **Docker DoD 未验证**：本机引擎不可用，没有声称镜像能构建或容器 health 通过。
   CI 新增 build/health job，但远程尚未运行。Linux、Node 18/20/22 矩阵同样
   只是 CI 定义，当前实际本地验证环境为 Windows/Node 24。
2. **真实联调未做**：权限、fork 可读性、真实 review 锚点、GitHub 限流、Webhook
   端到端需后续在授权测试仓库验证。所有 token/LLM 响应是 mock，不是付费实测。
3. **依赖审计仍未通过**：10-18 的 15 条历史结果在本轮修补后降为 7 条，仍含
   Tinypool/Vitest 开发链 critical 和生产 braces high；本记录的审计登记列明路径、
   条件及兼容修补阻塞。App 的输入限制、生产裁剪不能等同于整个依赖树安全。
4. 单副本、有界内存队列不保证崩溃后的任务恢复；需要人工 redelivery。多副本
   不提供全局互斥。标记只防重复评论，重复投递仍可能重复 LLM 消费。
5. 预算是基于内置 pricing 的保守估计，每次处理独立；须在付费前核对定价。
   强杀无法执行 finally，部署应使用 tmpfs；大 PR/不可读文件/预算未分诊为 partial。
   评论存在长度上限，不能把摘要当作完整安全审计报告。

## 最短下一步

先审阅此分支及 [部署说明](../../app/README.md)。Docker 引擎可用后执行：

```sh
docker build -f app/Dockerfile -t ai-codeguard-app:local .
```

随后以文档中的**合成启动凭据**做容器 health smoke，无需真实 key。生产化前
继续跟进 braces 修补，另行评估 Vitest/Tinypool/mocker 与 Node 支持升级。只有获得后续明确授权后，才注册/配置 App、在授权仓库
真实联调或调用付费 LLM；本轮没有执行这些外部动作。

复现本地功能验收（完整构建先于 app 测试）：

```sh
npm ci --ignore-scripts
npm run build
npm run test:run
npm run precision
npm run typecheck
npm run lint
npm run build -w app
npm test -w app
npm run typecheck -w app
npm run lint -w app
```

原始本机报告保存在 `.artifacts/m8/`（10-18）及 `.artifacts/m8-security/`（10-19，
均忽略、不入库），含完整/生产 before/after audit JSON、CLI JSON、锁版本差异和
单项 smoke 日志；可审阅命令输出与审计快照已另行保存到本文的 tracked log。
