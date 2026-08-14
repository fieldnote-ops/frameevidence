# FrameEvidence

**为 Agent 提供有界、只读的设计证据。** FrameEvidence 通过 Figma REST API 读取布局、字体、颜色、组件引用与变量绑定，v0.1 以 DeepSeek Harness 插件形式打包。

v0.1 严格只读，只提供两个工具：

- `figma_inspect`：返回有节点上限、面向实现的紧凑节点树，避免把完整 Figma JSON 塞进上下文。
- `figma_render`：返回单个节点的临时 PNG、JPG、SVG 或 PDF 渲染链接。

## 安装

安装到 Web profile：

```sh
dsh plugin --profile web add github:fieldnote-ops/frameevidence
```

启动 DSH 前，设置带有 `file_content:read` scope 的 Figma Personal Access Token：

```sh
export FIGMA_ACCESS_TOKEN='...'
npx @deepseek-ai/dsh web
```

随后把 Figma 文件或节点链接交给 Agent，并明确要求“先读取设计证据，再实现”。

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

FrameEvidence 是 FIELD NOTE 的 AI 辅助、人工复核互操作实验。单元测试使用合成 Figma API 响应，发布工作流只验证无 Figma 凭证的干净 profile 安装与启动。真实 Figma API 读取与 Marketplace 接受仍未验证；尚无陌生用户采用、购买验证或收入。

MIT License。FrameEvidence 是独立开源项目，与 Figma, Inc.、DeepSeek 无隶属、赞助或背书关系；相关名称只用于说明与相应产品或服务的兼容关系。
