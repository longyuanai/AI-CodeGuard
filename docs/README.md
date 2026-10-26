# AI-CodeGuard 文档导航

> 当前能力以 [README](../README.md)、[架构](../ARCHITECTURE.md) 和源码为准；实际测试、依赖审计、容器及外部联调状态集中在 [M8 验收记录](./dev/M8-VALIDATION.md)。历史专题保留设计背景，不作为当前验收结果。

## 1. 阅读顺序

1. [预览版快速上手](./QUICKSTART.md)：固定 Release 安装、CG-003 演示/真实终端回放、退出码和试用反馈。
2. [README](../README.md)：CLI、六语言/19 规则、配置、Action 与当前交付边界。
3. [ARCHITECTURE](../ARCHITECTURE.md)：CLI/库/App 入口、扫描管道、cache、数据流和信任边界。
4. [M8 验收记录](./dev/M8-VALIDATION.md)：可复现命令、实际日志、剩余风险与未验证项。
5. 运行 App 时看 [部署说明](../app/README.md) 和 [GitHub App 设计](./design/GITHUB_APP.md)。

**Stage 1** 指 Tree-sitter + 规则静态预筛；**Stage 2** 指可选 LLM 分诊及修复建议。`--dry-run` 停在 Stage 1，App 无 key 时自动降级并标注未经 AI 分诊。旧文档中的 **Phase 1** 是早期本地 CLI 基线阶段名，不表示库、cache、Action 或 App 尚未实现。

## 2. 当前实现与使用入口

| 内容 | 文档 |
|---|---|
| 总览、安装、CLI 和配置示例 | [README](../README.md) |
| 固定预发布安装、危险代码→修复复扫、退出码与反馈 | [QUICKSTART](./QUICKSTART.md) |
| 新预览版真实安装、告警、修复与复扫演示 | [真实安装与修复演示](./blog/02-selfhosted-preview-draft.md) |
| 模块、库入口、wasm、App 数据流 | [ARCHITECTURE](../ARCHITECTURE.md) |
| 实际验证与未验证项 | [M8 验收记录](./dev/M8-VALIDATION.md) |
| App 环境变量、权限、真实联调步骤/证据模板、合成样本、清理与回滚 | [app/README](../app/README.md) |
| 签名、head SHA、评论去重、Check、预算与隐私 | [GITHUB_APP](./design/GITHUB_APP.md) |
| built-in / YAML custom rules 与检测边界 | [RULES](./design/RULES.md) |
| Stage 2 结果缓存、键、TTL 与默认值 | [CACHING](./design/CACHING.md) |
| composite Action 的输入/输出与 SARIF 使用 | [GITHUB-ACTION](./dev/GITHUB-ACTION.md)；规则覆盖以根 README 为准 |
| 已接受的架构决策与当时背景 | [ADR](./adr/decisions.md)；实施状态以当前架构为准 |

库接口由 `src/lib.ts` 导出，构建为 `dist/lib.js`；App 通过 workspace 复用 `scan()`、reporter、diff、baseline、suppression、fingerprint 和成本控制。部署说明与设计文档分别负责“怎么运行”和“怎么工作”，避免重复保存环境变量或动态测试数字。

## 3. 历史规划与专题参考

以下文档保留早期设计、示例或当时验证记录；部分段落中的语言/规则数量、模型、cache/Action 实现状态、测试计数和后续优先级已过时。遇到冲突时，请回到上述当前入口及源码核对。

- [TECHNICAL-SUMMARY](./design/TECHNICAL-SUMMARY.md)：历史技术汇总，正文按历史快照阅读。
- [core-modules](./design/core-modules.md)：早期模块接口与说明；当前库/App、过滤及 cache 接线见架构。
- [CONFIGURATION](./design/CONFIGURATION.md)：配置专题；默认值以 `src/config/schema.ts`、`defaults.ts` 和 CLI `init` 模板为准，App 使用字段白名单。
- [REPORTING](./design/REPORTING.md)：早期 text/JSON/SARIF 说明；当前另有 GitHub review JSON。
- [LLM-INTEGRATION](./design/LLM-INTEGRATION.md)：早期 Stage 2 设计；当前缓存及 App 的固定出口、预算预留见架构/App 设计。
- [CLI-EXAMPLES](./dev/CLI-EXAMPLES.md)：早期命令示例；当前参数、模型与退出码以 README、CLI `--help` 和源码为准。
- [TESTING](./dev/TESTING.md)：测试组织与历史覆盖说明；实际计数、命令和精度以 M8 验收记录为准。
- [GITHUB-CI-INTEGRATION](./dev/GITHUB-CI-INTEGRATION.md)：早期手动集成方案；当前 composite Action 与 SARIF workflow 见上方 GITHUB-ACTION 及架构。
- [docs/dev/ROADMAP](./dev/ROADMAP.md)：历史开发路线图，不作为当前排期或未完成清单。
- [CODEX_PLAN](./design/CODEX_PLAN.md)：M8 T0～T6 原始任务书及执行记录；验收标准与实际验证结果分别阅读。

## 4. 文档维护原则

- 修改当前事实时原地更新 README、架构或对应使用说明；测试和审计证据统一更新验收记录。
- 历史结果保留日期与边界；CI 定义、本地通过、Docker 通过和真实 GitHub/付费 API 联调分别记录。
- 目标仓库代码与配置是不可信输入；CLI 的受信配置加载和 App 的数据白名单不能混用。
- 新增文档前先检查本页现有入口，优先修正已有说明，避免产生多个当前状态来源。
