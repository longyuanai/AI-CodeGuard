# AI-CodeGuard 预览版快速上手

在提交前检查 `eval(input)` 这类可疑安全模式：先用静态规则定位，再由开发者核实和修复。
适合希望在个人项目或 CI 中增加检查的开发者。下面只解析合成代码，不运行其中的函数，
所有扫描使用 `--dry-run`，不需要 API key、不调用 LLM，不产生模型费用。
无告警不代表代码已完成安全审计。

## 固定下载与环境

- [公开预发布 selfhosted-preview-20261021.1](https://github.com/longyuanai/AI-CodeGuard/releases/tag/selfhosted-preview-20261021.1)
- [CLI 安装包 ai-codeguard-0.4.0.tgz](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261021.1/ai-codeguard-0.4.0.tgz)
- [SHA256SUMS](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261021.1/SHA256SUMS) / [发行清单](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261021.1/MANIFEST.json)

CLI 版本是 **0.4.0**，本批源码固定为 **`045d4073ec8dd3a3c347b30bb2c61edfd35e2ae3`**。
这些链接固定到预发布，不使用 `releases/latest`，也不安装 npm 注册表上的同名历史版本。
已发布标签及附件没有因本教程而改变。

**2026-10-22 安全补充：** 旧版 CLI tgz 的生产依赖不含 Vitest/mocker，这两项新告警不构成已发布 CLI 的运行时漏洞；
当前隔离安装生产审计仍为 0。旧版**源码 ZIP** 的完整开发/测试锁文件则包含 `vitest -> @vitest/mocker@4.1.11`，
当前报告 2 moderate，已由 [PR #19](https://github.com/longyuanai/AI-CodeGuard/pull/19) 在 main 更新至 4.1.12。
从源码开发、测试或构建 App 时请使用修补后的 main；不要将旧 ZIP 的 2026-10-21 审计 0 记录理解为当前无告警。
可达的 Vite 公共 mock 注册接口是这些公告的利用前提；标准 Node 测试和普通构建不会自动开启该接口，
但开发依赖风险仍需要修补。旧附件保持不变，新源码预览需另行审阅发布。

运行要求 **Node `^24.22.0`（>=24.22.0、<25）**。本轮实际走通 Windows / PowerShell、
Node 24.22.0 / npm 11.19.1；不是其它 Node 补丁或 macOS/Linux 安装矩阵的验收。
如本机 Node 不符合要求，可自行解压[官方 Node 24.22.0 便携包](https://nodejs.org/download/release/v24.22.0/)，
仅在当前终端把该目录加入 PATH，或使用已有版本管理器；不要用 `--force` 绕过 engines，也无需替换系统 Node。
安装阶段需要联网从 npm 下载生产依赖，tgz 不包含 node_modules。

## 第一个完整示例（Windows PowerShell）

按顺序在同一个终端复制下列代码块。先检查当前终端运行时，再创建独立临时演示目录：

```powershell
$ErrorActionPreference = 'Stop'
# 扫描发现时退出 1 是预期情况，不让 PowerShell 把它当作脚本异常。
$PSNativeCommandUseErrorActionPreference = $false
node -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major!==24||minor<22)throw new Error('Require Node ^24.22.0')"
if ($LASTEXITCODE -ne 0) { throw '请先切换当前终端到 Node ^24.22.0' }
node --version
npm.cmd --version
$demoRoot = Join-Path ([IO.Path]::GetTempPath()) ('codeguard-preview-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $demoRoot | Out-Null
Set-Location -LiteralPath $demoRoot
```

匿名下载、校验后安装。这里 `curl.exe -q` 不读取 curlrc，且不发送登录 Cookie 或 Authorization：

```powershell
$release = 'https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261021.1'
foreach ($name in @('ai-codeguard-0.4.0.tgz', 'SHA256SUMS')) {
  curl.exe -q --no-netrc --header 'Authorization:' --header 'Cookie:' --proto '=https' --proto-redir '=https' --fail --location --silent --show-error --retry 2 --max-time 90 --output $name "$release/$name"
  if ($LASTEXITCODE -ne 0) { throw "下载失败：$name" }
}
$checksumLine = @(Get-Content -LiteralPath './SHA256SUMS' | Where-Object { $_ -match '^[0-9a-f]{64}  ai-codeguard-0\.4\.0\.tgz$' })
if ($checksumLine.Count -ne 1) { throw '缺失或重复的安装包校验项' }
$expectedHash = ($checksumLine[0] -split '  ', 2)[0]
$actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath './ai-codeguard-0.4.0.tgz').Hash.ToLowerInvariant()
if ($actualHash -cne $expectedHash) { throw 'SHA256 不一致，请停止安装' }
"SHA256 OK: $actualHash"
npm.cmd init -y
if ($LASTEXITCODE -ne 0) { throw 'npm init 失败' }
npm.cmd install ./ai-codeguard-0.4.0.tgz --ignore-scripts --omit=dev --engine-strict --registry=https://registry.npmjs.org
if ($LASTEXITCODE -ne 0) { throw '安装失败，请保留脱敏错误信息' }
& .\node_modules\.bin\ai-codeguard.cmd --version
if ($LASTEXITCODE -ne 0) { throw 'CLI 版本检查失败' }
& .\node_modules\.bin\ai-codeguard.cmd --help
if ($LASTEXITCODE -ne 0) { throw 'CLI 帮助检查失败' }
```

版本应为 `0.4.0`。校验文件用于下载一致性检查，不是独立数字签名；
本批安装包 SHA256 是 `74ef827fe8204ab5ab621389f1f116b43bb68b836e2e81c918bf241facfb79d2`。

下面本地生成已有的 [safe](examples/github-app/safe.ts)、[vulnerable](examples/github-app/vulnerable.ts)、
[fixed](examples/github-app/fixed.ts) 三份合成样本。无需克隆项目或额外下载 raw 文件；这些后续文档样本不在原 Release 源码 ZIP 中。

```powershell
$samples = @{
  'safe.ts' = @'
// Synthetic scan-only fixture. Do not invoke this function during rehearsal.
export function parsePayload(input: string): unknown {
  return JSON.parse(input);
}
'@
  'vulnerable.ts' = @'
// Synthetic scan-only fixture. Do not invoke this function during rehearsal.
export function parsePayload(input: string): unknown {
  return eval(input);
}
'@
  'fixed.ts' = @'
// Synthetic scan-only fixture. Do not invoke this function during rehearsal.
export function parsePayload(input: string): unknown {
  const payload: unknown = JSON.parse(input);
  return payload;
}
'@
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($name in $samples.Keys) {
  [IO.File]::WriteAllText((Join-Path $demoRoot $name), $samples[$name] + "`n", $utf8)
}
```

扫描同一个 `probe.ts`：先安全版，再危险版，最后替换成修复版。只覆盖本轮刚创建的合成 `probe.ts`：

```powershell
Copy-Item -LiteralPath ./safe.ts -Destination ./probe.ts
& .\node_modules\.bin\ai-codeguard.cmd scan ./probe.ts --dry-run --output json --output-file ./safe-report.json --fail-on high
"safe exit=$LASTEXITCODE"

Copy-Item -LiteralPath ./vulnerable.ts -Destination ./probe.ts
& .\node_modules\.bin\ai-codeguard.cmd scan ./probe.ts --dry-run --output json --output-file ./vulnerable-report.json --fail-on high
"vulnerable exit=$LASTEXITCODE"

Copy-Item -LiteralPath ./fixed.ts -Destination ./probe.ts
& .\node_modules\.bin\ai-codeguard.cmd scan ./probe.ts --dry-run --output json --output-file ./fixed-report.json --fail-on high
"fixed exit=$LASTEXITCODE"

foreach ($stage in @('safe', 'vulnerable', 'fixed')) {
  $report = Get-Content -LiteralPath "./$stage-report.json" -Raw | ConvertFrom-Json
  "$stage files=$($report.scan.files) findings=$($report.scan.totalFindings) llmCalls=$($report.scan.llmCalls) cost=$($report.scan.estimatedCost)"
  $report.findings | Select-Object ruleId, severity, file, @{Name='line'; Expression={$_.location.start.line}}
}
```

2026-10-22 用公开附件在隔离目录实际得到：

| 版本 | 文件数 | 发现 | 退出码 |
|---|---:|---|---:|
| 安全 | 1 | 0 | 0 |
| 危险 | 1 | **CG-003 / critical / probe.ts:3** | **1（预期）** |
| 修复 | 1 | 0 | 0 |

三次均 `llmCalls=0`、`estimatedCost=0`、`skipped=[]`。完整实际命令与输出见
[试用验证日志](dev/validation/PREVIEW-2026-10-22-onboarding.log)。本例约定输入是 JSON，修复是避免把输入当 JavaScript 执行；
实际项目仍需校验解析后数据结构和权限，不能把“静态无告警”等同于安全保证。

### 退出 1 与运行错误怎么区分

成功完成扫描并生成报告时，退出 **1** 表示有发现达到 `--fail-on` 阈值，默认 high/critical；不是安装失败。
本例故意指定缺失的配置文件，演示扫描执行错误：

```powershell
& .\node_modules\.bin\ai-codeguard.cmd scan ./probe.ts --dry-run --config ./missing-config.yml
"runtime error exit=$LASTEXITCODE"
```

预期退出 **2**，stderr 含 `Scan failed` / `ENOENT`，不能当作“没有发现”。
未知参数等命令解析错误也可能退出 **1**（并显示 usage/error）；因此要同时看报告、stderr 和退出码，不能只凭数字判定有漏洞。
跳过文件或 `files=0` 也不代表完整扫描通过；先核对文件名、扩展名、排除配置与权限。

### 常见问题

| 现象 | 处理 |
|---|---|
| EBADENGINE | 检查 `node --version`；当前终端切换到 ^24.22.0，不用 --force |
| PowerShell 阻止 npm.ps1 | 使用上面的 `npm.cmd` / `ai-codeguard.cmd`，不必修改系统执行策略 |
| 下载/安装连接失败 | 保留 HTTP/错误码，检查 GitHub 与 npm 网络访问，重试固定 URL；不跳过哈希校验 |
| SHA256 不一致 | 停止安装，重新匿名下载包和校验文件，附脱敏哈希/URL反馈 |
| 找不到命令 | 保持在刚创建的目录，使用 `node_modules/.bin` 下的本地命令；不要调用其它全局版本 |
| node-domexception deprecated | 当前依赖的弃用提示，不等同于安装失败；结合最终退出码与 npm audit，不能宣称所有告警都无风险 |
| 扫描自己的陌生仓库 | CLI 可加载受信 JS/TS 配置/自定义规则；先审查配置，不执行陌生仓库脚本或安装钩子 |

示例生成的文件都在 `$demoRoot`，完成后可保留用于反馈；如需清理，先打印并核对该精确路径，再删除本轮目录，避免通配批量删除。
macOS/Linux 使用同一 tgz 和 Node 要求，可用 `sha256sum` / `shasum -a 256` 校验、`npm` 和本地 `node_modules/.bin/ai-codeguard` 扫描；
本页完整可复制配方及本轮安装证据针对 Windows PowerShell，未声称在其它系统重新验收。

## 演示回放与录屏分镜

[真实终端回放 preview-demo.cast](examples/preview-demo.cast) 由已安装 CLI 的真实子进程输出记录，命令提示由脚本生成，
保留实际相对时间并脱敏临时绝对路径。不是桌面视频、模拟截图或真实 App 演示。
如已安装 asciinema，可下载后运行 `asciinema play preview-demo.cast`；无需播放器也可读上面的实际日志。

| 镜头 | 操作 | 应展示内容 |
|---|---|---|
| 1，环境 | 展示固定 Release、Node 和 --version | tag、24.22.0、CLI 0.4.0；不展示环境变量或凭据 |
| 2，危险代码 | 把 vulnerable.ts 复制为 probe.ts，打开第 3 行 | `return eval(input)`，不执行函数 |
| 3，告警 | `scan probe.ts --dry-run --fail-on high` | CG-003 critical，退出 1；说明只是静态候选 |
| 4，修复 | 把 fixed.ts 复制为同一 probe.ts | JSON.parse 替代 eval |
| 5，复扫 | 同一命令再次扫描 | 0 findings、退出 0、零 LLM 调用 |
| 6，收尾 | 展示反馈入口 | 说明限制，邀请提供脱敏复现 |

本轮录制了终端回放，未录制桌面视频。发布介绍及 3～5 人试用邀请文案见
[宣传草稿](blog/02-selfhosted-preview-draft.md)，仅供审阅，没有对外发帖或发送邀请。

## CLI 与 App，及如何反馈

CLI 静态体验到此完成；不需要创建 GitHub App 或部署服务。
App 是另一个需要自部署、HTTPS webhook、仓库白名单和最小权限安装的入口，
见[固定发行部署附件](https://github.com/longyuanai/AI-CodeGuard/releases/download/selfhosted-preview-20261021.1/DEPLOYMENT.md)
及[现有 App 手册](../app/README.md)。它没有在线托管服务，**真实安装、签名投递到真实 PR、评论和 Check Run 联调尚未完成**。
Linux CI 容器通过和 mock API 测试不代表真实 App 联调通过。

请用 [预览版试用反馈表](https://github.com/longyuanai/AI-CodeGuard/issues/new?template=preview-feedback.yml)（提交需要 GitHub 登录），
也可使用[预填普通 Issue](https://github.com/longyuanai/AI-CodeGuard/issues/new?title=%5BPreview%20feedback%5D&body=Release%3A%20selfhosted-preview-20261021.1%0AOS%20%2F%20Node%20%2F%20npm%3A%0AInstall%20success%3A%0AScan%20completed%20%2F%20exit%20code%3A%0AFalse%20positive%20or%20missed%20finding%20%28synthetic%20repro%20only%29%3A%0AImprovements%3A%0A%0ARedact%20keys%2C%20tokens%2C%20private%20source%20and%20customer%20data.)或[查看已有 Issues](https://github.com/longyuanai/AI-CodeGuard/issues)。提供 OS、Node/npm/Release 版本、安装/扫描是否完成、
脱敏命令/退出码、误报或漏报的最小合成复现及希望改进的内容。
**不要上传 API key、Token、私钥、webhook secret、私有源码、客户数据或完整环境变量。**
无法公开的复现可仅描述规则和现象，不要为了填表泄露信息。
