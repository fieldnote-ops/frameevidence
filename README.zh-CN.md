# FrameEvidence

[![Self-test](https://github.com/fieldnote-ops/frameevidence/actions/workflows/self-test.yml/badge.svg?branch=main)](https://github.com/fieldnote-ops/frameevidence/actions/workflows/self-test.yml)

**为 Agent 提供有界、只读的设计证据。** FrameEvidence 通过 Figma REST API 读取布局、字体、颜色、组件引用与变量绑定，v0.1 以 DeepSeek Harness 插件形式打包。

v0.1 严格只读，只提供两个工具：

- `figma_inspect`：返回有节点上限、面向实现的紧凑节点树，避免把完整 Figma JSON 塞进上下文。
- `figma_render`：返回单个节点的临时 PNG、JPG、SVG 或 PDF 渲染链接。

## 首屏证据

| 维度 | 当前边界 |
| --- | --- |
| Figma 访问 | 只向 `https://api.figma.com/v1` 发出只读 REST 请求；拒绝重定向，没有工具写回 Figma。 |
| 凭证处理 | PAT 只从指定宿主环境变量读取，不作为模型工具参数，也不进入工具或探针输出。 |
| 上下文控制 | 原始响应有字节上限；设计证据进入模型前，深度和返回节点数量均受限。 |
| 维护者基础设施 | 不经过维护者服务器、分析、遥测、OAuth broker 或凭证存储。 |
| 当前验证 | 15 项无凭证测试以及干净 profile 的 DSH rc.6/`latest`/`next` consumer 已通过；真实 Figma 文件仍**未**完成显式探针。 |

## 安装

安装到 Web profile：

```sh
dsh plugin --profile web add github:fieldnote-ops/frameevidence#97f67c9a049a26c9e8b38e7e764d2572897a6429
```

上述完整 commit 是上一份已公开验证的运行时版本。可以查看 `main` 的持续开发，但真实设计 token 进入范围时应固定到已审阅 commit。

进入 Figma 的 **Settings → Security → Personal access tokens**，创建只带 `file_content:read` scope 的 PAT。Figma PAT 最长只能设置 90 天有效期；请选择满足测试所需的最短期限，不再使用时立即撤销。通过交互读取，避免 token 进入 shell 历史：

```sh
printf 'Figma PAT: '
IFS= read -r -s FIGMA_ACCESS_TOKEN
printf '\n'
export FIGMA_ACCESS_TOKEN
npx @deepseek-ai/dsh web
```

随后把 token 所属账号有权访问的 Figma 文件或节点链接交给 Agent，并明确要求“先读取设计证据，再实现”。详见 Figma 官方的 [PAT 创建说明](https://developers.figma.com/docs/rest-api/personal-access-tokens/)与[权限范围说明](https://developers.figma.com/docs/rest-api/scopes/)。

## 显式启用的真实 API 探针

要在不向维护者发送数据的情况下补齐真实 API 证据，请克隆仓库并运行 `npm ci --ignore-scripts --registry=https://registry.npmjs.org`。通过进程环境注入 PAT 与调用者自行选择的节点 URL，不要把任何一个值写进命令或已提交文件：

```sh
printf 'Figma PAT: '
IFS= read -r -s FIGMA_ACCESS_TOKEN
printf '\nFigma 节点 URL: '
IFS= read -r FRAMEEVIDENCE_URL
export FIGMA_ACCESS_TOKEN FRAMEEVIDENCE_URL
npm run live:smoke
unset FIGMA_ACCESS_TOKEN FRAMEEVIDENCE_URL
```

探针绝不会自动执行。它会依次调用 `figma_inspect` 与 `figma_render`，随后新建权限为 `0600` 的 `frameevidence-live-smoke.json`；若文件已经存在则拒绝覆盖。报告不记录 token、设计 URL、file key、node id、节点名称、原始 API 响应或临时渲染 URL。

## 安全边界

- Token 只从宿主环境变量读取，不作为模型工具参数，也不会出现在输出里。
- 请求只发往 `https://api.figma.com/v1`，并拒绝重定向。
- 插件只读取节点 JSON 或请求渲染，不写回 Figma。
- 原始响应、返回节点数与请求时间都有硬上限；成功读取会在内存中短暂缓存，以降低限流压力。
- 项目没有维护者运营的服务器、分析或遥测；详见 [PRIVACY.md](./PRIVACY.md) 与 [SECURITY.md](./SECURITY.md)。

## 已知限制

Figma Tier 1 REST API 的限额取决于席位和套餐，Viewer/Collab 席位的额度可能非常低。Variables REST API 仅对 Enterprise 开放，因此 v0.1 只保留变量绑定 id，不获取变量值。

## v0.1 不做

- 写入 Figma
- OAuth 与多用户凭证托管
- 一键生成完整产品页面
- 在没有浏览器对照时声称像素级还原
- 获取 Enterprise Variables 值

## 当前证据

FrameEvidence 是 FIELD NOTE 的 AI 辅助、人工复核互操作实验。单元测试使用合成 Figma API 响应；发布工作流通过 HarnessProof 在隔离副本中安装插件锁定依赖，再对 DSH rc.6、`latest` 与实验性 `next` 验证无 Figma 凭证的干净 profile 配置组合与 Web 启动。项目已提供显式启用、凭据安全的真实 API 探针，但尚未对真实 Figma 文件执行；Marketplace 接受也仍未验证。尚无陌生用户采用、购买验证或收入。

MIT License。FrameEvidence 是独立开源项目，与 Figma, Inc.、DeepSeek 无隶属、赞助或背书关系；相关名称只用于说明与相应产品或服务的兼容关系。
