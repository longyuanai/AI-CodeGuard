# AI-CodeGuard · SECURITY

核实日期：2026-10-15。依据本地README、构建清单和实际入口；本文件不把文档计划当成运行时验收。

## 目标与范围

组合TypeScript静态预筛选与可选LLM确认的安全CLI，保持静态证据可独立使用。

GitHub：[longyuanai/AI-CodeGuard](https://github.com/longyuanai/AI-CodeGuard)。知识笔记：Vault内 `03_Projects/AI-CodeGuard/AI-CodeGuard - Git关联.md`。

## 本项目安全边界

用自有合成样本验证静态结果、外部模型禁用和输出契约；旧C盘副本的依赖修改独立保留。

- 仅处理自有、授权、靶场或CTF资产；未知上传内容按数据处理，不作为脚本执行。
- API Key、Token、主密码、私钥、个人资料、客户数据与运行数据库不进入Git、公开Issue或知识备份。
- 真实外部模型、支付、生产数据库、Telegram/飞书操作与硬件烧录需各自明确授权；默认使用本地夹具。

## 报告与修复

维护者账号：[longyuanai](https://github.com/longyuanai)。敏感问题先使用仓库已启用的私下报告渠道；未确认渠道时，不把敏感原件写入公开Issue。没有编造支持版本或联系邮箱。

记录授权范围、根因、影响、脱敏复现、修复与回归证据；修改前保存可恢复版本。文档完善不等于产品通过全面安全审计。

## 现行依据

- [README.md](README.md)
