# M8 本地交付与验收记录

日期：2026-10-18（Asia/Shanghai）。环境：Windows、Node **24.18.0**、npm **11.16.0**。
初始分支 `main`、HEAD `cc43a84f87434b789cb7cad67b05ce81bdea2a3f`；交付分支
`codex/m8-github-app-mvp`。没有推送、发布、部署、注册 GitHub App 或调用付费 API。

## 实际验证

[完整命令与原始输出](validation/M8-2026-10-18.log) 包含每项退出码、测试计数、
precision、CLI fixtures、真实回环 HTTP 响应及 Docker 引擎错误。

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
| 编译后 CLI / vulnerable fixtures | 14 文件、**97 findings**、0 skipped、0 LLM calls、$0 |
| 编译后 CLI / safe fixtures | 8 文件、**0 findings**、0 skipped、0 LLM calls、$0 |
| 编译后 Node HTTP 服务 | 实际启动进程；`GET /healthz` → **200 `{"status":"ok"}`**，无签名 POST → **401** |
| 工作区检查 | `git diff --check`、修改内容凭据模式检查通过；文档相对链接存在 |
| Docker | 客户端存在，`dockerDesktopLinuxEngine` pipe 不存在；**镜像构建/容器 health 未验证** |
| 真实 GitHub / 付费 LLM / 远程 CI | **未验证、未执行**。现有测试对外部 API 使用 mock |
| `npm audit` | **未通过**：原始基线已有的 15 项告警仍在，见下文 |

HTTP smoke 使用合成启动凭据，不会创建 JWT 或联系 GitHub；它验证真实服务监听、
路由和验签拒绝行为，不验证真实 App 凭据。受限沙箱拒绝 127.0.0.1 连接的首次
尝试曾失败；在允许本地回环连接的执行环境重跑后通过，没有用跳过测试替代。

## 基线恢复

初始 `npm ls tree-sitter-php --depth=0` 为空，本地缺少 wasm；原 package.json
已经声明 `^0.24.2`，锁文件已固定 `0.24.2`。按原锁执行
`npm ci --ignore-scripts` 后恢复，无需改版本。实际基线重新得到 build、typecheck、
lint 通过，**572 passed / 2 skipped**，precision/recall **95.8% / 92.0%**。
README 历史数字没有直接作为验收结果。

安装前原锁文件 SHA256：
`B6DF16586684A25EED8D073FC59FC39FFCAD1744F28574DCFCFAC8D1865CC3B4`。
恢复后哈希相同。后续锁文件只增量加入 workspace/App 依赖；逐项比较原始提交的
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
| T6 | `app/Dockerfile`、`.dockerignore`、`app/README.md`、根 README/CHANGELOG、`docs/design/GITHUB_APP.md`/`CODEX_PLAN.md`、本记录/日志；容器 CI 定义已补，运行验证待 Docker 可用 |

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
3. **依赖审计仍未通过**：原提交 `cc43a84` 的清单/lock 单独审计，与当前均为
   15 项（2 critical / 10 high / 2 moderate / 1 low）。critical 是开发链
   Vitest/Tinypool；其余涉及 humanfs、mocker、brace-expansion/braces、fast-glob/
   micromatch、esbuild、form-data、js-yaml、nanoid、postcss、source-map-js、vite。
   没有把告警当作已修复。新增 HTTP 适配器告警已修补；App 不开放 Vitest UI、
   不执行目标配置，并限制不可信 glob，但这些边界不等于整个依赖树安全。
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
另行处理历史依赖审计。只有获得后续明确授权后，才注册/配置 App、在授权仓库
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

原始本机报告还保存在 `.artifacts/m8/`（已忽略、不入库），含 audit JSON、
CLI JSON 和单项 smoke 日志；上述可审阅命令日志已另行保存到本文的 tracked log。
