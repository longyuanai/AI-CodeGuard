# M8 本地交付与验收记录

## 当前交付：2026-10-22 公开预览版用户上手

固定 [selfhosted-preview-20261021.1](https://github.com/longyuanai/AI-CodeGuard/releases/tag/selfhosted-preview-20261021.1)
已公开，源码仍为 `045d4073ec8dd3a3c347b30bb2c61edfd35e2ae3`；没有修改标签或附件。
本轮在原 `codex/github-app-rehearsal-prep` / PR #18 复用已有三份合成样本，
补齐 [快速上手](../QUICKSTART.md)、README 首屏、试用反馈 Issue 模板和
[发布介绍草稿](../blog/02-selfhosted-preview-draft.md)。旧发布说明/验收记录保留其日期和边界。

便携 Node 24.22.0 / npm 11.19.1，在独立临时目录从公开 Release **匿名重新下载** CLI tgz 与
SHA256SUMS，校验、安装、版本/帮助均通过。将教程全部 5 个 PowerShell 代码块逐字提取、语法检查并实际执行：
安全/危险/修复扫描各 1 文件，发现 **0 / 1 CG-003 critical（第 3 行）/ 0**，退出 **0 / 1 / 0**，
零跳过、零 LLM 调用、零费用。缺失配置运行错误实际退出 2；未知参数可能退出 1，教程明确要求结合报告和 stderr 判定。
实际已安装 CLI 输出录为 [终端回放](../examples/preview-demo.cast)，不是桌面视频或真实 App 演示。
脱敏原始输出、命令与退出码见 [本轮日志](validation/PREVIEW-2026-10-22-onboarding.log)。

只改文档、反馈模板及演示产物，没有运行时/依赖/构建变更，因此不手动重跑未变化源码的完整验收；
若 PR/main 自动 CI 运行，其结果单独记录，不冒充新用户安装或真实 App 联调。
本轮实测范围为 Windows/PowerShell/Node24.22.0，真实 App/付费 provider/其它 Node 补丁仍未验证。
宣传中的 95.8%/92.0% 明确来自项目标注语料，不是任意真实项目的准确率。
没有发送邀请或发布自媒体，也未部署服务；ROADMAP.md / SECURITY.md 保持原样且不提交。

## 历史准备：2026-10-21 真实 GitHub App 联调资料（未执行外部联调）

基线为已合并、已验收 main **`045d4073ec8dd3a3c347b30bb2c61edfd35e2ae3`**，
PR #17 不重复合并。2026-10-20 的 main 本地九项、582/2 skipped + App 35、
95.8%/92.0%、两项 audit 0 告警及
[main Linux CI/真实容器](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39387448393)、
[security-scan](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39387448454)
是历史有效证据，原本地报告为 `.artifacts/main-acceptance-2026-10-20/RESULT.md`（忽略目录）。
本轮没有重新运行 main 的完整验收，也不把旧运行改写为 10-21 新结果。

在 `codex/github-app-rehearsal-prep` 完善已有
[App 手册](../../app/README.md#真实-github-app-联调手册待外部授权执行)，修正旧快照，
补充配置单、指定仓库权限/安装、无 key/成本 0 的首次运行、测试操作、脱敏证据模板、
故障定位及定点回滚/清理。源码、依赖、构建配置和原 fixtures 均未修改。

新增 [safe](../examples/github-app/safe.ts)、[vulnerable](../examples/github-app/vulnerable.ts)、
[fixed](../examples/github-app/fixed.ts) 三个最小合成样本，继承原 CG-003 fixture 模式，
只供解析，不执行函数。本轮在便携 Node 24.22.0 / npm 11.19.1 使用已构建主分支 CLI
实际扫描：findings **0 / 1 × CG-003 critical（第 3 行）/ 0**，退出码 **0 / 1（预期）/ 0**，
均无 skipped/LLM calls/cost；三份样本的 TypeScript `--noEmit` 检查退出 0。
隔离临时 Git fixture 的真实 diff + 编译后 CLI 复核通过：历史 eval 不在变更行时
**0 findings / Outside diff 1**；中文路径及重命名并修改均检出第 3 行 CG-003，
实际 Git 重命名相似度 **82%**。本地核验脚本语法/执行通过，临时目录已按本轮前缀定点清理。
[本轮命令与结果日志](validation/M8-2026-10-21-app-prep.log) 与 10-20 历史日志分别保存。

真实 App 注册/安装、服务部署、公网 HTTPS、真实测试 PR/投递及清理、付费 provider、
其他 Node 24 补丁仍 **NOT_RUN/未验证**；不完整 diff 的已有 mock 回归不冒充真实 API 截断。
ROADMAP.md、SECURITY.md 原哈希未变，仍未跟踪、不提交。

## 历史审阅：2026-10-20 PR #17 正确性修复与验收

起点 `0cd395801700aa57812c0466c1798862e13c3203`，PR 目标 `main`，实际 merge-base
`cc43a84f87434b789cb7cad67b05ce81bdea2a3f`；按完整差异审阅生产代码和相关测试，
没有用 CI 全绿代替代码审查。分支仍为 `codex/m8-github-app-mvp`。
ROADMAP.md、SECURITY.md 哈希未变、未跟踪、未提交。

### 有依据的发现与处置

| 优先级 | 位置（起点行号） | 触发与实际影响 | 最终处置 |
|---|---|---|---|
| P1，已修复 | `app/src/pipeline.ts:78-81` | 重命名且有新增行的文件没有可用 diff 行时，旧实现因 status=renamed 直接跳过，`incomplete=false`，空 findings 被 Check 报为 success；同文件只解析到部分新增行也未核对完整性 | 只有 API 确认 `additions=0` 才可跳过；非零新增行缺失/行数不符标记 partial，保留可见 finding；纯重命名的合法无 hunk diff 正常处理 |
| P2，已修复 | `src/scanner/diff.ts:66-67` | Git 将中文等路径写为带引号/八进制 UTF-8，旧解析器保存转义字面字符串，无法匹配实际文件名；CLI --diff 静默丢弃 findings，App 无法扫描/锚定对应行，并触发上项重命名漏洞 | 复用同一核心 parser 解码 Git C-quoted 路径再去 b/ 前缀；CLI、库和 App 一起受益，无公开接口变更 |

回归先在旧代码实际失败（根 2 项、App 2 项），修复及二进制边界复核后新增 7 项全部通过。
使用合成目录由真实 `git -c core.quotePath=true diff` 生成中文路径 diff，编译后 CLI
扫描 **1 文件、1 finding、0 LLM 调用**，不是只验证手写字符串或 mock。
代码提交 **`e4b6c7b3bec045bb03340763496334418f43f771`**；
[本轮失败复现/本地回归/实际 CI 日志](validation/M8-2026-10-20-pr17-review.log)。

收尾复核发现上述修复对 `additions=0` 的豁免过宽，会把二进制修改误认为纯重命名；
新增回归在修复前实际失败，已在 **`cf2d71b25f6c5bf9c304d43098c8c5fb0c931d51`**
收紧为非二进制纯重命名或删除文件。再次运行全部九项和两项 audit 均通过；
最终 App 为 35 项通过，不沿用中间阶段 34 项的结果。

### 审查覆盖与边界

- Webhook 先对原文验签，再过滤事件/action/仓库白名单；installation token 的 GitHub 请求限定官方 origin、禁止重定向。仓库配置不能选择凭据/模型/出口、自定义执行代码、缓存和输出路径。
- PR 内容按 fork head 仓库及 SHA 读取，扫描前后与发评论前检查过期 head；路径穿越/Windows 别名、大小/总量、finally 清理有边界。tinyglobby 显式路径、隐藏文件、排除、目录及字面路径行为已读代码并复核，无新发现需要改动。
- 评论仅信任本 App bot 归属与末尾标记，分页/fingerprint occurrence 去重，summary 更新和 Check 复用；无 key 为标明的 Stage 1，预算/错误候选列为未分诊，不冒充 AI 确认或扫描完整。
- 库/CLI 导出、bundled wasm 优先定位、生产依赖独立安装和只读容器约束检查通过。
- **无未解决的 P0/P1 或现有契约 P2 阻塞项**。已登记的 MVP 限制不扩展：单 worker 内存队列/去重（不耐重启、多副本无锁）、手动重投、每次处理独立预算、估价非账单保证、结果长度上限及局部静态分析。仓库规则/排除/baseline/suppression 政策变更仍需人工审阅。

### 本轮实际验证

Windows 便携 Node **24.22.0 / npm 11.19.1**，系统 Node 未替换；支持仍为 **`^24.22.0`**。
根 build/test:run/precision/typecheck/lint、App build/test/typecheck/lint **全退出 0**；
根 **582 passed / 2 原有 opt-in skipped**、App **35 passed**；
**23 TP / 2 FN / 1 FP，precision 95.8%、recall 92.0%**，门槛未降低。
完整和生产 `npm audit` **各 0 告警，退出 0**；依赖和构建配置未改。
编译后 CLI 漏洞/安全 fixtures **97/0 findings**，库多语言 wasm、真实 HTTP **200/401** 均通过。

中间修复 SHA `e4b6c7b3bec045bb03340763496334418f43f771` 的
[Linux CI](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39384389745) 与
[security-scan](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39384389771) **成功**。
实际容器重新构建并通过非 root/只读根/tmpfs、HTTP 200/401、开发依赖裁剪、7 wasm 和 PHP
安全/漏洞实扫；容器已清理。后续仅文档交接提交也须核对其自身 CI，PR 描述保存最终 HEAD 的链接。

最终代码 **`cf2d71b25f6c5bf9c304d43098c8c5fb0c931d51`** 的
[Linux CI](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39385143556)（4 个 job，含真实容器）及
[security-scan](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39385143504) **全部成功**；
对应日志附在同一本轮审查日志的 FINAL FOLLOW-UP 段。

未验证：真实 GitHub App 安装及 webhook→真实 PR 写流程、付费 provider、其他 Node 24 补丁/平台；
本地 Docker 引擎不可用，容器证据为真实 Linux CI，API 测试仍是 mock。neutral 代表未完成，
人工合并前须阅读汇总，不能当作干净扫描。未提交 APPROVE、合并、部署或发布。
本轮修复回滚点为 `0cd3958`（保留依赖安全整改）；若必要可人工按逆序 revert `cf2d71b`、`e4b6c7b` 后重验，
但会恢复以上漏扫风险。完整 PR 的回滚应保存已验证构建/配置，不自动降回有已知告警的旧依赖。

## 历史验收：2026-10-20 braces 整改与远程交付通过（早于本次审阅）

本轮起点 `621ea730ce19f10a5dd8ce78cbb5ef0d7d33473a`，分支
`codex/m8-github-app-mvp`。已核实远程为 `longyuanai/AI-CodeGuard`，正常推送，
[草稿 PR #17](https://github.com/longyuanai/AI-CodeGuard/pull/17)；未合并、发布或部署。
根 ROADMAP.md、SECURITY.md 保持原哈希、未跟踪、未提交。下方迁移记录均为历史。

本轮唯一日志：[实际命令、审计前后、回归和 CI/容器日志摘录](validation/M8-2026-10-20-remote.log)。
代码提交：`d09624c`（依赖/扫描调用/6 项回归）、`6f75a19`（容器验收）、
`5de5fc0817f76587ec288bdf31f8fb5e8198e6ef`（真实容器发现的问题修复）。

### 依赖整改与兼容性

- 重新查询 [官方 GHSA](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)：
  `braces <=3.0.3` 仍受影响且 `first_patched_version: null`；不是沿用历史判断。
  npm 最新 braces 3.0.3、fast-glob 3.3.3，故没有可用的同链兼容修补版本。
- 移除生产 `fast-glob 3.3.3 → micromatch 4.0.8 → braces 3.0.3`，改为已在项目工具链
  使用的 **tinyglobby 0.2.16**（当前最新版 0.2.17，但不为整改追新）。实际生产路径为
  `tinyglobby 0.2.16 → fdir 6.5.0 / picomatch 4.0.4`；锁文件没有无关版本升级。
  替换生产依赖有明确漏洞修复目的，没有新增 override、忽略告警或改变审计分类来过关。
- 两处调用限定于扫描器文件发现、自定义 YAML 规则发现，未改变 CLI 参数/配置/规则接口。
  显式 `expandDirectories: false` 保持原行为；保留绝对路径、onlyFiles、dot=false、ignore，
  字面文件名使用库的 escapePath。未自写 glob 匹配器。
- 新增回归验证递归 brace、数字范围、extglob、否定模式、排除/隐藏文件、去重、
  配置 include、含 `[code]{a,b}` 的字面路径和 2000 层嵌套 brace；原递归 yml/yaml
  加载、排序/重复 ID、CLI 与 App 字面路径测试全部保留并通过。
- 原镜像 `npm prune` 残留 `node_modules/@vitest` 目录，首次真实容器作业失败；
  未弱化检查器，Dockerfile 改为独立阶段全新 `npm ci --omit=dev --ignore-scripts
  --engine-strict`，运行镜像仅复制该阶段依赖和构建产物。复验通过。

| 本轮门禁 | 实际结果 |
|---|---|
| 完整 / 生产 audit | 修复前各 **3 high（退出 1）** → 修复后各 **0 vulnerabilities（退出 0）**；本地及 Linux 均通过，3 条目来自同一 braces 公告传播 |
| Windows Node 24.22.0 / npm 11.19.1 | 根 build/test:run/precision/typecheck/lint、app build/test/typecheck/lint 全部退出 0；便携 PATH，未替换系统 Node |
| 根测试 / App 测试 | **580 passed / 2 opt-in skipped**（19 文件通过、1 跳过）；App **30 passed / 9 文件**；原有效测试没有减少 |
| 精度门槛 | **23 TP / 2 FN / 1 FP，precision 95.8%、recall 92.0%**，未降低 ratchet |
| 编译后 CLI / 库 | 漏洞 fixtures 14 文件/97 findings、安全 fixtures 8 文件/0；库入口、bundled wasm 和特殊文件名扫描通过；零 LLM 调用 |
| Windows 真实 HTTP | health **200**、无签名 webhook **401**；GitHub API 仍为 mock |
| 隔离生产安装 | engine-strict 安装成功；开发工具缺席、7 个 wasm 非空；PHP 漏洞/安全样本 **1/0 findings**，零跳过/零 API |
| Linux CI | 根/App 门禁、Action 漏洞/安全冒烟全部通过；安全扫描 SARIF 作业通过 |
| Linux 真实 Docker | 构建成功；USER node/UID **1000**；只读根写入 **EROFS**；`/tmp:rw,noexec,nosuid,size=256m` 实际可写；health **200**、无签名 webhook **401** |
| 容器运行包 / 实扫 | Vitest/@vitest/Tinypool/tsup/Vite/esbuild 目录均缺席；7 wasm；PHP 漏洞 **1 finding**、安全 **0**，各扫描 1 文件/零跳过/零 LLM；临时容器已清理 |

最终代码 SHA **`5de5fc0817f76587ec288bdf31f8fb5e8198e6ef`** 的实际运行：
[Linux CI（4 个 job 成功）](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39363604041)、
[真实容器 job](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39363604041/job/118435201482)、
[security-scan 成功](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39363603938)。
[首轮失败](https://github.com/longyuanai/AI-CodeGuard/actions/runs/39363468144) 保留作为问题与修复证据。
PR 工作流使用合成凭据，只有临时本机绑定容器，不推送镜像或部署；release 仅手动触发且未执行。

剩余边界：本机 Docker named pipe `dockerDesktopLinuxEngine` 不存在，退出 1，未安装/重置；
实际容器证据来自 Linux CI。其他 Node 24 补丁和平台未测；支持政策仍为 `^24.22.0`。
真实 GitHub App 安装、签名 webhook 到真实 PR 写入、付费 provider 均未联调；
不把草稿 PR/CI 操作冒充 App 联调。`node-domexception@1.0.0` 的维护性弃用提示仍在，
不是本次 audit 漏洞。**容器通过与 audit 通过分别取证，零告警不等于完整生产安全审查。**
回滚点为本轮起点 `621ea73`，回滚会恢复已知 braces 风险，不能作为安全上线方案。
最短下一步：审阅草稿 PR；另行授权后再进行真实 GitHub App 联调，本轮不执行。

## 历史记录：2026-10-20 Node 24 工具链迁移（早于本轮）

起点：`codex/m8-github-app-mvp` / `99334d08f6ef8a3a81eab6d3c95ef44fe6c8b62e`，未推送。
开始时已跟踪文件干净，只有原有根 ROADMAP.md、SECURITY.md 未跟踪；两者未修改、未提交。
本节保留当时事实；当前状态以上方 braces 整改与远程交付验收为准。
[10-20 全新命令、回归与审计日志](validation/M8-2026-10-20-security.log) 不沿用旧结果。

安全迁移代码提交：**`bf0201d`**。本轮修改文件清单：

- 代码/配置 11 个：`package.json`、`package-lock.json`、`app/package.json`、`tsup.config.ts`、
  `app/tsup.config.ts`、`.github/workflows/ci.yml`、`.github/workflows/security-scan.yml`、
  `action.yml`、`app/Dockerfile`、`docs/examples/pr-review.yml`、`app/tests/runtime.test.ts`。
- 文档/证据 8 个：`README.md`、`ARCHITECTURE.md`、`CHANGELOG.md`、`app/README.md`、
  `docs/design/GITHUB_APP.md`、`docs/dev/GITHUB-ACTION.md`、本验收记录、
  `docs/dev/validation/M8-2026-10-20-security.log`。未修改核心规则、扫描算法或精度语料。

### Node 政策、实施范围与兼容影响

- **最低运行时与开发环境均为 Node 24.22.0，支持范围 `^24.22.0`（24.x）**。
  官方 [发行索引](https://nodejs.org/dist/index.json) 确认 v24.22.0 于 2026-10-14 发布、LTS 为 Krypton；
  [官方维护计划](https://github.com/nodejs/Release/blob/main/schedule.json) 的 24 分支维护至 2028-04-30。
- 本轮在 Windows x64 **Node 24.22.0 / npm 11.19.1** 全量实测。使用官网便携 ZIP，SHA256
  `f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3` 与官网 SHASUMS 一致。
  仅放入忽略目录、临时修改子进程 PATH，未安装或替换系统 Node。
- 根/App engines、两个 tsup target（`node24`）、CI、Action 默认值、PR 示例、SARIF workflow
  和 Docker（`node:24.22.0-bookworm-slim`）已同步。**Node 18/20/22、24.22.0 之前的 Node 24
  不再支持；25/26 不在本分支声明范围。其他 Node 24 补丁、Linux、远程 CI 未实际运行。**
- 阅读了 [Vitest 4.1.11 官方迁移说明](https://github.com/vitest-dev/vitest/blob/v4.1.11/docs/guide/migration.md)
  和 [tsup 9 发行说明](https://github.com/egoist/tsup/releases/tag/v9.0.0)。现有配置没有旧 poolOptions、
  自定义 pool、被移除的 coverage 选项或构造器箭头 mock，故不添加无用迁移配置；原测试完整保留。
  Vitest 4 的通过日志未展示精度 console 输出，`precision` 脚本增加 `--disableConsoleIntercept`，
  恢复 TP/FN/FP 可见性；HTTP 测试仅增加实际状态码的安全日志，不改服务行为。

本机便携环境仍位于 `.artifacts/security-2026-10-20/node-v24.22.0-win-x64/`（忽略、不提交）；
系统 Node 未替换，直接调用系统 npm 可能使用较旧版本。仅在当前 PowerShell 会话复现：

```powershell
$nodeBin = (Resolve-Path '.artifacts/security-2026-10-20/node-v24.22.0-win-x64').Path
$env:PATH = $nodeBin + ';' + $env:PATH
node --version # v24.22.0
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

干净 checkout 不含该便携目录，须自行准备满足相同范围的 Node；不要用旧全局 Node 的结果
替代本轮环境验收，也不要将 API key 放进命令或提交。

| 依赖/路径 | 原锁 → 最终安装 | 实际处理 |
|---|---|---|
| vitest、配套 @vitest/*、mocker | 3.2.7 → **4.1.11** | 使用已发布修补版本，不升级到无必要的 Vitest 5；mocker 的越界读取告警从最终 audit 消失 |
| `vitest → tinypool` | 1.1.1 → **移除** | Vitest 4 使用重写后的 worker pool；最终锁和安装路径均无 Tinypool，不使用跨范围强制 override，两个 critical 包条目消失 |
| tsup | 8.5.0 → **9.0.0** | 必要安全工具升级；Node 24.22.0 满足其 engine，声明与两个 ESM 入口构建通过 |
| `tsup → source-map` | 0.8.0-beta.0 → **移除** | tsup 9 使用已修补的 source-map-js 1.2.2；全锁无 source-map 包，废弃 beta 警告移除 |
| `tsup → esbuild` | 0.25.12 → **0.28.2** | 移除与 tsup 9 冲突的全局 esbuild override；Vite/bundle-require 的 0.25.12 保持在各自允许范围，两条路径均被审计 |
| Vite | **6.4.4 保持** | 原有 override 在 Vitest 4 的 6/7/8 范围内，保留以避免无关 Vite 大版本升级；不新增 override |
| 直接生产依赖 | **清单与既有锁版本保持** | 没有新增生产依赖、批量更新 SDK 或替换文件匹配器；其余变化限于必要工具的配套开发依赖，完整锁差异见日志 |

### 新审计与未修复的生产 high

| 范围 | 10-20 整改前 | 最终实际结果 |
|---|---|---|
| 完整 audit | 6：2 critical / 3 high / 1 moderate | **3 high、0 critical、0 moderate、0 low；退出 1，未通过** |
| `--omit=dev` | 3 high | **3 high；退出 1，未通过** |

先排查生产链：`fast-glob 3.3.3 → micromatch 4.0.8 → braces 3.0.3`。
10-20 官方 npm 查询显示这三个仍是各自最新可用版本，audit 无可用修补；
[braces 公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) 涉及深嵌套 pattern 栈耗尽。
这 **3 个包条目来自同一漏洞传播**，不是 3 个独立漏洞。CLI 路径、配置与 custom-rule glob
仍有不可信 pattern 输入面；App 对字面路径转义，限制 exclude 数量/长度并拒绝复杂语法，
只是减少暴露。没有为了消除数字而删除扫描能力、将不存在/不兼容版本塞入 override，或声称
开发工具整改能修复生产问题。后续需跟进上游兼容补丁，或单独评审 matcher 替换/维护补丁的
兼容性、授权及维护成本。本轮先完成其余可执行整改，**整体依赖审计仍不合格**。

最终所有锁中 Node engine 均接受 v24.22.0，安装没有 EBADENGINE；旧 engine 冲突由明确的
运行环境迁移解决，并非改低子依赖要求。仍有既有 node-domexception 1.0.0 废弃提示，
不是本轮新增的审计项；没有宣称整个安装无任何维护警告。

### 最终实际验收（全部重新执行）

| 命令/检查 | 10-20 实际结果 |
|---|---|
| 根 `build`、`test:run`、`precision`、`typecheck`、`lint` | **全部退出 0**；574 passed / 2 opt-in skipped，18 文件通过 / 1 跳过 |
| App `build`、`test`、`typecheck`、`lint` | **全部退出 0**；30 passed，9 文件通过，无跳过 |
| 精度门槛 | **23 TP / 2 FN / 1 FP，95.8% precision / 92.0% recall**；未改语料、规则或 ratchet |
| 编译后 CLI 漏洞 / 安全 fixtures | **14 文件 / 97 findings**、**8 文件 / 0 findings**；均 0 skipped、0 LLM calls、$0，使用显式受信 YAML 与 dry-run |
| 新锁隔离生产包 | `npm ci --omit=dev --ignore-scripts --engine-strict` **退出 0**；Vitest/@vitest/Tinypool/tsup/Vite/esbuild 均不在生产安装，TypeScript 可选 runtime peer 仍保留 |
| 库入口与 bundled wasm | **7 个正确且非空 wasm**；从隔离生产 cwd 以容器相同 stdin 方式导入构建库，PHP 实扫 **1 文件 / 1 finding / 0 skipped / 0 LLM calls** |
| 编译后本机 HTTP | 合成凭据、仅 **127.0.0.1**：health **200**、无签名 webhook **401**；日志有实际响应码，子进程 finally 终止 |
| 文档/工作区 | 相对链接、表格/代码围栏、凭据模式、`git diff --check` 与受保护文件哈希核对；未推送或发布 |

完整回归先通过一次；为恢复精度/HTTP 日志可见性做了小修改后，九项在最终状态再次通过。
额外精度日志检查首次在受限沙箱遭遇临时缓存 rename **EPERM**（0 tests 加载），允许临时
文件正常写入的执行环境重跑通过；失败及重跑均留档，没有用跳过测试或降门槛替代。
未调用真实 GitHub 写操作或付费 API；外部 API 流程仍使用 mock，真实联调未验证。

### Docker 独立边界、回滚与下一步

- Docker 客户端 **29.8.2**；`docker version` **退出 1**，`dockerDesktopLinuxEngine` 管道不存在。
  无镜像构建、无本轮容器，因此无需删除容器；没有安装、重置或配置 Docker。
- 独立只读 `docker manifest inspect node:24.22.0-bookworm-slim` **退出 1**，Docker Hub
  `registry-1.docker.io/v2/` 请求超时；因此连新 base tag 拉取也未验证，不能把这个失败解释为
  标签不存在。镜像构建、非 root、只读根、tmpfs、容器 HTTP/wasm/PHP **全部未验证**。
  本机生产包或 HTTP 通过不替代 Docker，容器将来通过也不替代 audit。
- 回滚点 **99334d0**：本轮 Node/依赖/构建/CI 变更作为一组恢复，使用定向 revert，按旧锁
  重装并重建，重跑原门槛；不把新 bundle 与旧锁混用、不 reset 用户修改或强推。回滚会同时
  恢复 Tinypool/mocker、Node 18 engine 与 source-map beta 风险，不能称为安全回滚。
  本轮没有已验证旧镜像可供声称。用户现有 ROADMAP/SECURITY 不属于任何提交或回滚范围。
- 最短下一步：审阅本轮迁移提交；Docker 可用后按既有部署说明完成独立镜像验收并清理本次
  容器，继续跟进 braces 生产 high；远程 CI、真实 GitHub、付费 provider、发布仍需另行授权。

## 历史记录：2026-10-18～19（不是当前支持或审计状态）

历史复验：**2026-10-19**（Asia/Shanghai）。环境：Windows、Node **24.18.0** / npm **11.16.0**，
及隔离便携 Node **18.20.8** / npm **10.8.2**。Node 18 官网 ZIP 的 SHA256 已核对，未安装到系统。
本轮起点：分支 `codex/m8-github-app-mvp`，HEAD
`75602a8bd39673dd313baf88bb8dba34ccf4ed5c`，仅原有 `ROADMAP.md`、`SECURITY.md` 未跟踪。
本轮完成兼容依赖修补、文档核对与交付复验，没有扩展功能；没有推送、发布、部署、
注册 GitHub App、写入真实仓库或调用付费 API。
同日续验从 `15332b7` 开始，继续消除 esbuild low、补齐容器检查定义并实测 Node 18；
此记录正文为续验后的当前状态，原始日志保留前一阶段 7 条告警 / 28 项 app 测试的历史输出。
随后以 `43da9971cc5034f7eaa871f513ef8d3e9ecffaf2` 为起点完成 Docker 重查与升级方案评估，
结果见下方独立小节。该阶段只更新本记录与证据日志，**未安装候选依赖、未实施跨 major 升级**。

M8 原实现日期为 2026-10-18，起点是 `main` / `cc43a84f87434b789cb7cad67b05ce81bdea2a3f`。
其 [原始日志](validation/M8-2026-10-18.log) 保留当时结果；下面的实际验证与审计表为 10-19 复验结果。

### 实际验证

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
| `npm test -w app` | **30 passed**，9 文件通过，无跳过；新增嵌套开发工具残留、缺失 wasm 的两个真实文件系统拒绝测试 |
| `npm run typecheck -w app` | 退出 0，包含 app 源码与测试 |
| `npm run lint -w app` | 退出 0 |
| 编译后 CLI / vulnerable fixtures | 14 文件、**97 findings**、0 skipped、0 LLM calls、$0；通过 cosmiconfig 加载含 merge alias 的受信 YAML，复验 js-yaml 更新兼容性 |
| 编译后 CLI / safe fixtures | 8 文件、**0 findings**、0 skipped、0 LLM calls、$0 |
| 编译后 Node HTTP 服务 | 合成凭据启动真实子进程，测试 bootstrap 将监听限制为 **127.0.0.1**；`GET /healthz` → **200 `{"status":"ok"}`**，无签名 POST → **401** |
| 隔离生产包（非容器） | `npm ci --omit=dev --ignore-scripts` 成功；Vitest/tsup/Vite/esbuild 不在隔离安装中，TypeScript 作为 cosmiconfig 可选运行时 peer 保留；7 个 wasm 齐全，真实 PHP 静态扫描 1 文件/1 finding/0 LLM calls |
| 工作区检查 | `git diff --check`、修改内容凭据模式检查通过；文档相对链接存在 |
| Docker | 客户端 29.8.2；`docker version` 退出 1，`dockerDesktopLinuxEngine` pipe 不存在；**镜像构建、容器 health/401、运行镜像依赖/wasm 未验证**；未创建容器、未修改系统 |
| 真实 GitHub / 付费 LLM / 远程 CI | **未验证、未执行**。现有测试对外部 API 使用 mock |
| `npm audit --json` | **退出 1，未通过**：15 → 7 → **6** 包条目（2 critical / 3 high / 1 moderate / 0 low） |
| `npm audit --omit=dev --json` | **退出 1，未通过**：5 → **3 high** 包条目，均来自 braces；见下文 |

HTTP smoke 使用合成启动凭据，不会创建 JWT 或联系 GitHub；它验证真实服务监听、
路由和验签拒绝行为，不验证真实 App 凭据。本轮仅修改测试 bootstrap 的 bind，
未增加服务配置或改变容器监听行为。检查在允许本机回环连接的执行环境中完成。
`CODEGUARD_E2E=0`，两个付费 opt-in 测试保持跳过；没有删除测试或降低 precision ratchet。
上述九项命令在 Windows/Node 24 和 Node 18 上分别完整运行并通过。生产检查脚本还以
与容器相同的 stdin 模式在两种 Node 上运行，通过 7 个 wasm 与 PHP 实扫；**不是 Docker 验收**。

### 10-19 依赖安全收尾

先读取原 `.artifacts/m8/audit.json`，再对当前 lockfile 做完整/生产审计；按 npm
包条目计数（含上游传播），**不等于独立漏洞数**。例如 3 个生产 high 条目是同一个
braces 问题沿 micromatch/fast-glob 传播；2 个 critical 条目是 Tinypool 与 Vitest 聚合条目。

| 范围 | 修补前 | 首次收尾 | 同日续验（当前） |
|---|---|---|---|
| 完整依赖树 | 15：2 critical / 10 high / 2 moderate / 1 low | 7：2 critical / 3 high / 1 moderate / 1 low | 6：2 critical / 3 high / 1 moderate / 0 low |
| `--omit=dev` | 5 high | 3 high | 3 high |

保留既有清单和锁文件，以 `npm update ... --package-lock-only --ignore-scripts` 定向
更新，再执行 `npm ci --ignore-scripts`。没有 `audit fix`、强制大版本更新或新增直接
生产依赖。Vitest 3.2.4 → **3.2.7**（清单下限同步），其 Vite 依赖允许 5/6/7；
原锁 Vite 7.3.2 要求 Node 20.19+/22.12+，与项目声明的 Node 18 不符，因此显式
override 为已修补的 **6.4.4**，使用上游允许的 Node 18 兼容 Vite 分支。
这不代表整套工具链兼容 Node 18：开发依赖 brace-expansion **5.0.12** 的 engines
由 `18 || 20 || >=22` 收窄到 `20 || >=22`，其 minimatch 10.2.5 父包仍声明支持 Node 18。
这是**尚未解决的 Node 18 上游支持风险**；没有为消除告警强制替换为不受支持的
依赖 major，也未擅自修改项目 Node 支持声明。续验用 Node 18 按锁安装和运行九项检查均通过，
但 npm 实际报出三项 `EBADENGINE`：

- 开发：`typescript-eslint → typescript-estree → minimatch → brace-expansion 5.0.12`，要求 `20 || >=22`。
- 开发：`typescript-eslint → visitor-keys → eslint-visitor-keys 5.0.1`，要求 `^20.19.0 || ^22.13.0 || >=24`。
- 生产 App：`@octokit/app → @octokit/auth-app → toad-cache 3.7.4`，要求 `>=20`。

后两项在续验前已存在。没有忽略日志中的警告，也没有使用 `--force`；未启用 engine-strict
时安装退出 0。实际通过不等于上游声明支持，尤其不能据此保证真实 installation token
路径在 Node 18 全面兼容。Node 20/22、Linux 与远程 CI 均未验证。
首次收尾新增锁节点主要是 Vite 6 所需 esbuild 0.25 的可选平台二进制；续验统一版本后
这些重复节点已去重。没有重建整份锁文件，两个阶段的具体增删分别保留在日志。

#### 已修补的告警及实际条件

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
| 开发：`tsup → esbuild`（同日续验） | tsup **8.5.1 → 8.5.0**，esbuild **0.27.7 → 0.25.12**；原 `>=0.27.3 <0.28.1` 命中 [Windows serve 公告](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | Windows `.serve()` 可读任意文件；现有构建未调用它，仍消除安装告警。固定父包及 esbuild 在所有调用方支持的范围，不强制覆盖 tsup 8.5.1 到不允许的 0.28。 |

续验核对了 [tsup 8.5.1 发行说明](https://github.com/egoist/tsup/releases/tag/v8.5.1)
及对应补丁：浏览器 CJS `import.meta` shim 校验与 SWC source-map 路径不是本项目的
Node ESM 构建路径；现有构建、声明、扫描和测试完整通过。tsup 8.5.0 原生依赖 esbuild
`^0.25.0`，Vite 6.4.4 依赖 `^0.25.0`，bundle-require 的 peer 为 `>=0.18`；统一
override **0.25.12** 均在支持范围内，避免旧 peer 锁继续保留 0.27.7。没有升级到要求
更高 Node 的 tsup 9。此回退会带入父包固定的 **source-map 0.8.0-beta.0** 及四个相关
开发节点；npm 明确给出该 beta 已废弃警告。当前 audit 未报新增漏洞、生产依赖未变，
但这仍是构建链维护风险，应在后续上游支持安全 esbuild 时解除固定，而非永久停留。

相关同系列配套更新包括 @vitest 子包、@humanfs/core、tinyspy、hasown 与 Vite 的嵌套
picomatch；未改变规则、扫描策略、App 生产代码或精度门槛。完整版本差异保存在本轮日志。

本轮修改文件：根 `package.json` / `package-lock.json`；仅约束回环监听的
`app/tests/runtime.test.ts`；`README.md`、`ARCHITECTURE.md`、`CHANGELOG.md`、
`docs/README.md`、`app/README.md`、`docs/design/GITHUB_APP.md`、本验收记录及
`validation/M8-2026-10-19-security.log`。当前架构已补齐库/App 数据流并修正
cache/Action 未实现的旧描述；历史专题通过导航明确标记，不重复新建状态文档。
续验另外修改 `.github/workflows/ci.yml`，新增 `scripts/check-runtime.mjs` 和
`app/tests/runtime-package.test.ts`：容器 CI 使用只读根、tmpfs、回环端口，定义
health 200、无签名 401、依赖/wasm/PHP 实扫与 always 清理。脚本在本机生产包运行
通过，拒绝路径测试通过；Docker/远程 job 仍未运行。

#### 仍未修补，审计不通过

| 包、级别与路径 | 受影响版本 / 安全修复边界 | 实际风险、现有约束与延期原因 |
|---|---|---|
| **生产 high ×3 条目**：`fast-glob 3.3.3 → micromatch 4.0.8 → braces 3.0.3` | `braces <=3.0.3`，[深嵌套 DoS](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)；本次 registry/audit 无已发布兼容修补 | 恶意 glob 可栈耗尽，CLI 的路径/配置匹配存在此输入面。App 显式文件路径转义、忽略 include，exclude 限 100 条/256 字符且禁用 brace/bracket/extglob，减少暴露；不能据此宣称整个依赖已安全。替换 glob 库或维护 fork 超出本轮兼容修补范围，待上游补丁。 |
| **开发 critical ×2 条目**：`vitest 3.2.7 → tinypool 1.1.1`（Vitest 为传播条目） | worker-options 问题 `<=2.1.0`，[公告一](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)；run-options 问题 `<2.1.2`，[公告二](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)；修补为 2.1.2 | 需上游原型污染，继承的 worker/filename 选项可转为代码执行；run 变体还涉及调用者传入 options。开发/CI 进程可受影响，不能标为无风险，也不是已证明的无认证 App RCE。Vitest 3 依赖 `^1.1.1`，无 1.x 修补；2.1.2 越过依赖 major 且要求 Node 20/22+，不能强制 override。需另行规划测试栈/Node 支持升级。 |
| **开发 moderate**：`vitest 3.2.7 → @vitest/mocker 3.2.7` | `>=2.1.0 <4.1.11`，[redirect mock 公告](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)；修补 4.1.11，3.x 无计划回补 | 暴露 standalone mocker/interceptor plugin 的 Vite HMR websocket 时可未认证注册越界文件重定向；browser RPC 有 token 认证。当前仅 run 模式、未启动上述 server，仍保留告警；跨 major 升级需独立兼容验证。 |

生产安装排除测试/构建链并不消除开发机、CI 或构建阶段风险。本机隔离生产包检查仅
证明上述包布局、wasm 和静态 scan 可用，**没有验证运行镜像**。TypeScript 仍由
cosmiconfig 可选 peer 留在生产安装中，未宣称运行包不含编译器。

### 43da997 起点：容器重查与升级评估

日期仍为 2026-10-19（Asia/Shanghai）。工作分支 `codex/m8-github-app-mvp`；开始时无已跟踪
文件修改，仅原有根目录 ROADMAP/SECURITY 未跟踪，两者哈希与上方记录一致。本阶段没有
修改源码、依赖清单/锁、测试、CI、Dockerfile 或系统配置；没有构建/创建容器，没有外部写操作。

#### 本阶段实际结果

| 项目 | 状态与证据 |
|---|---|
| Docker 引擎连接 | **失败**：允许访问本机引擎的执行环境中 `docker version` 仍退出 **1**；客户端 29.8.2 / desktop-linux，`//./pipe/dockerDesktopLinuxEngine` 不存在（The system cannot find the file specified） |
| 镜像构建 | **未验证**：引擎不可用，没有执行 build；没有安装、启动、重置 Docker 或改系统配置 |
| 容器非 root | **未验证**：Dockerfile 的 `USER node` 是配置事实，未取得运行中的 UID |
| 容器只读根 / tmpfs | **未验证**：部署说明与 CI 有 `--read-only`、`/tmp` tmpfs；未执行容器内写入拒绝、tmpfs 写入验证或 inspect |
| 容器 health 200 / 无签名 webhook 401 | **未验证**：此前 Node 回环 HTTP 测试通过，不能代替容器结果 |
| 运行镜像开发依赖裁剪、7 个 wasm、PHP 实扫 | **未验证**：此前隔离本机生产包通过，不能代替镜像结果 |
| 本阶段容器清理 | **不适用**：未创建容器/镜像，不删除用户已有资源 |
| 当前完整 / 生产 audit | 均**失败，退出 1**；仍为 **6**（2 critical / 3 high / 1 moderate）及 **3 high** 包条目，未消除剩余告警 |
| 官方版本/兼容性查询 | **通过**：只读查询 npm manifest、GHSA、Node 发布计划，结果附在现有日志的 `CLOSEOUT FROM 43da997` 段落 |
| 代码回归 | **本阶段未重跑**：只有文档/日志变更，没有验收失败导致的代码修复；上方 574+2 skipped、App 30、95.8%/92.0% 是此前相同代码与依赖组合的实际日志，不冒充本阶段新运行 |
| 升级候选的安装、测试、构建、审计与容器 | **未验证、未执行**；下面只是评估，不能预先承诺升级后 audit 清零 |

Docker 恢复后应沿用现有 Dockerfile、部署命令与 CI 检查，用独立镜像 tag 和本次唯一容器名，
合成凭据、仅 `127.0.0.1` 发布端口；记录镜像 ID、运行 UID、inspect 的只读根/tmpfs 配置，
再实测根目录写入拒绝、`/tmp` 可写、health 200、无签名 401，以及 stdin 运行生产包检查脚本。
最后在 finally/always 中仅清理本次容器并记录退出结果。**容器全通过仍不等于 audit 通过**。

#### 上游事实与约束（本阶段只读核对）

| 对象 | 已核对事实 | 对升级的影响 |
|---|---|---|
| Vitest 3 / Tinypool | 当前 Vitest 3.2.7 依赖 Tinypool `^1.1.1`；查询的 3.2 系列未见更高补丁，1.x 最后为 1.1.1。worker-options [GHSA](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) 首修 2.1.1，run-options [GHSA](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) 首修 2.1.2；综合至少 **2.1.2**，要求 Node `^20.0.0 \|\| >=22.0.0` | 不能向 Vitest 3 强制塞入超出声明范围的 Tinypool 2。告警有上游原型污染前置条件，但开发/CI 代码执行风险仍须登记 |
| Vitest / mocker 4 | [Vitest 4.1.11 manifest](https://registry.npmjs.org/vitest/4.1.11) 要求 Node `^20.0.0 \|\| ^22.0.0 \|\| >=24.0.0`，固定 mocker **4.1.11**，**不再声明 Tinypool 依赖**。[mocker 公告](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) 将 4.1.11 列为修补，3.x 不维护、不计划回补 | 4.1.11 是较小的跨 major 候选；预计从声明依赖树移除 Tinypool 路径，而不是“升级其 Tinypool”。真正的新锁仍须检查是否有其他引入者，并重新 audit |
| Vitest 5 | 只读核对的 5.0.5 要求 Node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | 没有为本轮跳到 5 提供必要性；优先评估已修补的 4.1.11，减少迁移范围。两者均未安装 |
| source-map beta / tsup | 当前 tsup 8.5.0 固定废弃的 source-map 0.8.0-beta.0；这是维护警告，不是本轮新发现的漏洞。8.5.1 改为 source-map `^0.7.6`，但要求 esbuild `^0.27.0`，会回到已登记的 serve low 风险 | 不为去除废弃提示而重新引入已知告警，也不将 tsup 8 的固定 source-map 直接 override 成不支持版本 |
| tsup 9 | [9.0.0 manifest](https://registry.npmjs.org/tsup/9.0.0) 使用 source-map-js `^1.2.2`、esbuild `^0.28.2`，Node 要求 `^22.18.0 \|\| ^24.11.0 \|\| >=26.0.0` | 可评估移除 source-map beta，但必须跨 major。当前全局 esbuild **0.25.12 override 与 tsup 9 冲突**；不能直接保留后宣称升级有效 |
| Node 18 engines | brace-expansion 5.0.12 要求 20/22+；eslint-visitor-keys 5.0.1 要求 `^20.19.0 \|\| ^22.13.0 \|\| >=24`；生产 App 的 toad-cache 3.7.4 要求 `>=20` | 旧实测通过不能覆盖上游声明。后两项为既有依赖；不是靠 `--force`、关闭警告或只改根 engines 就解决 |
| App 的 Node 18 候选 | @octokit/auth-app 7.2.2 声明 Node >=18、依赖 toad-cache `^3.7.0`；官方 3.x 列表中 **3.7.0** 声明 Node >=12，3.7.1/3.7.4 为 >=20，3.7.2/3.7.3 查询不存在 | 3.7.0 在父包允许范围，可作为后续兼容性评估对象；**尚未安装、比较修补差异、审计或验证 token/cache 语义，不是已确认安全的回退方案** |
| Node 生命周期 | [Node 官方计划](https://github.com/nodejs/Release/blob/main/schedule.json)：18 于 **2025-04-30**、20 于 **2026-04-30** 结束维护；22 至 2027-04-30，24 至 2028-04-30 | 保留旧版本包含运行时本身的维护风险；不建议仅把最低版本提到已结束维护的 Node 20 |
| 生产 braces high | [公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) 仍无 first_patched_version；当前 fast-glob → micromatch → braces 3.0.3 | 与测试栈升级分开处理。两方案都不能据此消除生产 3 个传播条目；App 输入限制只是缓解，CLI 仍有 glob DoS 输入面 |

#### 两种方案（均未实施）

| 维度 | A：保留当前 Node 18 产品运行时声明 | B：提高产品最低 Node 支持范围 |
|---|---|---|
| 政策与影响 | CLI >=18、App >=18.14.1 的产品目标先保留，但构建/完整单测工具要求单独改为受支持的较新 Node。**这不是继续承诺 Node 18 能无警告进行完整开发安装**。生产 App 的 toad-cache engine 冲突仍需解决后才能承诺全面支持 | 后续可将根/App 支持范围对齐 `^22.18.0 \|\| ^24.11.0 \|\| >=26.0.0`，明确移除 18/20，不笼统写 >=22 而包含不受工具支持的 22.0/23/25。旧环境用户需升级，有兼容性影响 |
| 工具候选 | 在 Node 22.18+/24.11+ 构建、测试 Vitest **4.1.11** + tsup **9.0.0**；产物仍以 Node 18 为 target。另评估 toad-cache **3.7.0** 或上游兼容修补，必须先查清旧版本遗漏的行为/安全修复 | 可评估同一工具组合，不需要为 Node 18 寻找生产缓存回退；现有 toad-cache/brace-expansion/visitor-keys 的 Node engine 范围与候选受支持分支匹配 |
| override 处理 | 两方案都要检查新锁：Vite **6.4.4** 在 Vitest 4.1.11 允许的 6/7/8 范围，可先保留以减少变化；移除或精确收窄 esbuild **0.25.12** 全局 override，让 Vite 使用其 0.25 范围、tsup 9 使用 0.28.2+。不能盲目把所有调用方统一到一个不兼容版本 | 同左；不因提高 Node 就顺便升级 Vite、SDK、TypeScript 或增加生产依赖 |
| CI / 构建影响 | 全量测试/类型/lint 移到支持工具的 Node；保留独立 Node 18（含 App 最低 18.14.1）**生产安装、CLI/库/HTTP/wasm 产物验收**。新锁下 `--omit=dev` / engine-strict 的实际行为也须验证。若用户要求 Node 18 原样运行完整工具链，则当前无已核对的上游全修补组合，只能暂留原组合及告警、等待回补，不能称风险已关闭 | 将完整 CI 改为候选范围的最低版本及受维护 22/24 分支；部署/Docker Node 22 需核实实际版本满足下限。两份构建 target 可先保留 node18，降低产物变化；支持政策和编译 target 是两个概念，不要求顺便重写源码 |
| 必须验证 | 两方案均先在隔离工作分支定向生成 lock，检查实际依赖树无遗留 Tinypool 引入路径、mocker 命中修补版本、无旧 esbuild 告警、source-map beta 是否真正移除；完整/生产 audit **独立验收**。A 额外验证 Node 18 生产安装和 App token/cache 语义，用本地签名/响应替身验证认证流程，不用真实 GitHub 写操作 | 两方案均运行根五项 + app 四项；原 574 passed/2 opt-in skipped、App 30 不无故减少，23 TP/2 FN/1 FP 与 95.8%/92.0% 不退。核对 vi.mock/provider 替身、异常清理、预算、Check 映射；CLI/库跨 cwd 加载 wasm、声明文件与 source map、真实容器非 root/只读根/tmpfs/200/401/PHP 扫描。Linux/候选 Node/候选容器结果必须重新取得，不能沿用旧工具日志 |
| 回滚 | 两方案都将工具迁移与 Node 政策分别提交；先保留 `43da997` 的清单、锁、配置、CI 和文档快照。失败时用定向 revert 撤销迁移提交，按原锁 `npm ci --ignore-scripts` 并重新构建/跑原门槛，避免重置用户工作区或强推。后续如有容器升级，应事前保存实际已验证旧镜像 ID/环境，切回原组合；本轮不存在“已验证旧镜像”可供声称 | 同左。回滚恢复的是已知本机基线，**也会恢复当前 6 条 audit/engine/beta 风险**，不是回滚到无告警状态；不得把旧 bundle 与新 lock 混用 |

建议后续优先讨论 **B**：减少已结束维护的 Node 与生产依赖 engine 的矛盾，也无需引入
未验证的缓存回退。若下游必须保留 Node 18，则选择 A 的运行时/开发工具分离路径，并明确
其维护成本和退出时间；若必须连开发工具也维持 Node 18，本次评估无法提供无已知告警的
受支持组合。本阶段只交付上述依据与取舍，未改变 Node 政策或依赖，没有执行任一迁移。

### 10-18 历史基线恢复

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

### 完成范围与文件

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

### 剩余风险与未完成验收

1. **Docker DoD 未验证**：本机引擎不可用，没有声称镜像能构建或容器 health 通过。
   CI 已补 build/health/401/runtime job，但远程尚未运行。Linux、Node 20/22 矩阵仍
   只是 CI 定义；本机 Windows/Node 18/24 实测通过，Node 18 上游 engine 警告仍在。
2. **真实联调未做**：权限、fork 可读性、真实 review 锚点、GitHub 限流、Webhook
   端到端需后续在授权测试仓库验证。所有 token/LLM 响应是 mock，不是付费实测。
3. **依赖审计仍未通过**：10-18 的 15 条历史结果在两次修补后降为 6 条，仍含
   Tinypool/Vitest 开发链 critical 和生产 braces high；本记录的审计登记列明路径、
   条件及兼容修补阻塞。App 的输入限制、生产裁剪不能等同于整个依赖树安全。
4. 单副本、有界内存队列不保证崩溃后的任务恢复；需要人工 redelivery。多副本
   不提供全局互斥。标记只防重复评论，重复投递仍可能重复 LLM 消费。
5. 预算是基于内置 pricing 的保守估计，每次处理独立；须在付费前核对定价。
   强杀无法执行 finally，部署应使用 tmpfs；大 PR/不可读文件/预算未分诊为 partial。
   评论存在长度上限，不能把摘要当作完整安全审计报告。

### 最短下一步

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
