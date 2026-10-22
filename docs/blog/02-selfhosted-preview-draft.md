# 发布介绍草稿：用一次 eval 告警试用 AI-CodeGuard

> 2026-10-22；供审阅的传播草稿，未发布到自媒体或向他人发送。演示全部来自合成代码和实际 CLI 输出。

准备提交一个接收 JSON 字符串的接口时，如果有人把 `JSON.parse(input)` 改成了 `eval(input)`，
代码仍可能在正常输入下运行，却引入把输入当作 JavaScript 执行的风险。AI-CodeGuard 的自部署预览版
提供了一个本机检查入口：先用 Tree-sitter 和静态规则找可疑模式，再由开发者判断和修复。

这次先邀请开发者体验最容易验证的一段：**本地 CLI、合成代码、`--dry-run`，无需 LLM key**。
不是在线托管服务，也不是完整安全审计。

## 实际演示：危险代码 → 告警 → 修复 → 复扫

样本只定义函数，不调用它。危险版的第三行：

```typescript
// Synthetic scan-only fixture. Do not invoke this function during rehearsal.
export function parsePayload(input: string): unknown {
  return eval(input);
}
```

在已安装 CLI 的临时项目中运行：

```sh
node node_modules/ai-codeguard/dist/index.js scan probe.ts --dry-run --output text --fail-on high
```

2026-10-22，Windows / Node 24.22.0 / npm 11.19.1，固定公开附件实际输出片段：

```text
✗ CRITICAL  CG-003 CWE-95  Code Injection (eval)
  probe.ts:3-3
Summary: 1 findings (1 critical)
[exit=1]
```

输出第 3 行对应上述完整样本。
`[exit=1]` 由演示记录器标注真实子进程退出码，不是 CLI 自己打印的文字。
对于这个约定接收 JSON 的例子，移除 eval，改成 JSON.parse，再扫描同一个文件：

```text
✓ No vulnerabilities found.
Summary: No findings
Files scanned: 1
[exit=0]
```

三个版本的实际结果是：安全 **0 发现 / 退出 0**，危险 **1 发现 / 退出 1**，修复 **0 发现 / 退出 0**。
均扫描 1 个文件，零跳过、零 LLM 调用和零模型费用。修复后无告警只代表这次静态检查结果；
生产代码仍需数据结构校验、权限设计和人工审查。
完整复制步骤、原始输出和[真实终端回放](../examples/preview-demo.cast)见[快速上手](../QUICKSTART.md)。

## 下载和安装入口

- [固定公开预发布 selfhosted-preview-20261021.1](https://github.com/longyuanai/AI-CodeGuard/releases/tag/selfhosted-preview-20261021.1)
- [CLI 安装包](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261021.1/ai-codeguard-0.4.0.tgz) / [SHA256SUMS](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261021.1/SHA256SUMS)
- [完整快速上手与故障定位](../QUICKSTART.md)

需要 **Node `^24.22.0`（>=24.22.0、<25）**，实际演示使用 24.22.0。
先按快速上手核对 SHA256，再从本地 tgz 安装：

```sh
npm install ./ai-codeguard-0.4.0.tgz --ignore-scripts --omit=dev --engine-strict --registry=https://registry.npmjs.org
```

不要把 `npm install ai-codeguard@0.4.0` 当作这个固定预发布附件；包内版本虽然同为 0.4.0，来源不同。
安装时需要联网获取运行依赖，扫描演示本身不调用模型或执行样本。

## 当前边界

- 支持 JS/TS、Python、Go、Java、PHP；不同语言的规则覆盖不同，见[项目规则表](../../README.md#supported-languages)。
- 项目标注语料的 Stage 1 历史指标是 precision **95.8%**、recall **92.0%**，不是所有真实项目的准确率保证，
  也不是本次三个演示样本得出的统计结论。
- 真实 GitHub App 注册/安装、签名投递到真实 PR、评论和 Check Run 联调**尚未完成**。
  App 是需要自己的部署环境、HTTPS 地址及仓库安装的独立入口；没有在线托管服务。
- 付费 provider、其它 Node 24 补丁和本轮未实际运行的平台仍未验证。CLI 的可选 LLM 能力不包含在这次静态体验中。
- 无告警不代表无漏洞。`--dry-run` 是静态候选筛选，仍可能误报、漏报，不能代替人工审计。

## 邀请开发者试用

想请首批 **3～5 位开发者**花几分钟跑通上述合成示例，再尝试自己有权检查的代码。
最希望知道：能否顺利安装、退出码是否清楚、报告是否容易理解，以及遇到哪些误报或漏报。
请通过[试用反馈 Issue](https://github.com/longyuanai/AI-CodeGuard/issues/new?template=preview-feedback.yml)记录环境、结果和改进建议。
只提供脱敏命令或最小合成复现，**不要上传密钥、Token、私钥、私有源码或客户数据**。
提交 Issue 需要 GitHub 登录，没有收集用户信息的额外表单或后台。

可单独使用的邀请文案（草稿，未发送）：

> 我在做 AI-CodeGuard 的自部署预览版，想邀请 3～5 位开发者试用本地静态 CLI。
> 用 Node ^24.22.0 跑一遍“eval 告警→修复→复扫”，不需要 LLM key。
> 上手：https://github.com/longyuanai/AI-CodeGuard/blob/main/docs/QUICKSTART.md 。
> 如果安装卡住、报告看不懂，或发现误报/漏报，欢迎提交脱敏反馈；不要上传私有源码或凭据。
> 这是预览工具，真实 GitHub App 联调还未完成，也不替代人工安全审计。
