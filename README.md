<p align="center">
  <h1 align="center">WorldX</h1>
  <p align="center"><strong>一句话，一个世界。</strong></p>
  <p align="center">
    输入一句话，看一整个 AI 世界在你眼前诞生 —— 独一无二的地图、自主行动的角色、涌现的故事。
  </p>
</p>

<p align="center">
  <a href="./README_EN.md">English</a> | 中文
</p>

<!-- TODO: 在这里添加截图/视频 -->
<!-- <p align="center"><img src="docs/hero.png" width="720" /></p> -->

---

**WorldX** 可以将一句话变成一个完全自主运行的 AI 世界。系统会自动设计世界观、生成原创地图与角色立绘，然后运行一个活的模拟 —— AI 角色自主决策、建立关系、展开对话、创造涌现叙事，全程无需人工干预。

> "北宋汴京的夜市街，有卖炊饼的、算命的、当铺掌柜，还有一个穿越来的现代人"

只需要这一句话，剩下的交给 WorldX。

## 特性

- **一句话创造世界** —— 描述任何场景，看着它变为现实
- **AI 生成地图与角色** —— 原创美术，不是模板拼接
- **自主 Agent 模拟** —— 角色自主决策、建立关系、展开对话
- **记忆与人格** —— 角色记住过去的经历，并据此形成独特的行为模式
- **多日演化** —— 世界跨越昼夜循环持续演进
- **上帝模式** —— 广播事件、给角色植入记忆、实时编辑角色档案
- **时间线系统** —— 分支、回放、对比不同的模拟走向
- **中英双语界面** —— 一键切换

## 架构

```
 "一座隐藏着铁匠秘密的雪山小镇"
                         │
                         ▼
              ┌─────────────────────┐
              │     编排引擎        │  LLM 设计世界观、角色、规则
              └──────────┬──────────┘
                    ┌────┴────┐
                    ▼         ▼
              地图生成    角色生成       AI 美术生成管线
                    │         │
                    └────┬────┘
                         ▼
              ┌─────────────────────┐
              │     模拟服务器      │  决策、对话、记忆、关系
              └──────────┬──────────┘
                         ▼
              ┌─────────────────────┐
              │     游戏客户端      │  Phaser + React —— 观看 AI 角色的生活
              └─────────────────────┘
```

## 快速开始

### 前置条件

- **Node.js 18+**
- **API Key** —— 详见下方 [模型配置](#模型配置)

### 方式 A：预览模式（最快上手）

想先看看效果？项目内置了两个预生成的世界，只需要配置 **世界驱动** 模型的 Key 即可运行。

```bash
git clone https://github.com/YGYOOO/WorldX.git
cd WorldX
cp .env.example .env
# 编辑 .env —— 只填 SIMULATION_* 三行即可
npm install && cd client && npm install && cd ../server && npm install && cd ..
npm run dev
```

打开 `http://localhost:3200`，选择一个内置世界，点击播放。

### 方式 B：完整创建

从零生成你自己的世界，需要配齐全部 4 组 Key。

```bash
# 编辑 .env —— 填写全部 4 组模型配置
npm run dev
```

打开 `http://localhost:3200/create`，输入一句话，看着你的世界诞生。

也可以用命令行：

```bash
npm run create -- "赛博朋克风格的深夜拉面馆，黑客和仿生人在这里交换情报"
```

## 模型配置

WorldX 使用 **4 个模型角色**，各自独立配置。全部采用 OpenAI 兼容的 `chat/completions` 协议 —— 任何兼容平台均可使用。

| 角色 | 环境变量前缀 | 用途 | 推荐模型 |
|------|-------------|------|---------|
| **编排引擎** | `ORCHESTRATOR_` | 设计世界结构、角色、规则 | 较强推理模型（如 `gemini-2.5-pro`） |
| **绘图模型** | `IMAGE_GEN_` | 生成地图美术和角色立绘 | 文生图模型（如 `gemini-3.1-flash-image-preview`） |
| **绘图审查** | `VISION_` | 审查地图质量、定位区域/元素 | 多模态模型（如 `gemini-3.1-pro-preview`） |
| **世界驱动** | `SIMULATION_` | 驱动运行时角色行为 | 任意模型，便宜的就行（如 `gemini-2.5-flash`） |

每个角色需要 3 个环境变量：

```env
{ROLE}_BASE_URL=https://openrouter.ai/api/v1    # API 地址
{ROLE}_API_KEY=sk-or-v1-xxxx                     # API Key
{ROLE}_MODEL=google/gemini-2.5-pro-preview       # 模型标识
```

### 平台配置示例

<details>
<summary><strong>OpenRouter</strong>（推荐 —— 一个 Key 搞定全部模型）</summary>

在 [openrouter.ai](https://openrouter.ai) 获取 Key：

```env
ORCHESTRATOR_BASE_URL=https://openrouter.ai/api/v1
ORCHESTRATOR_API_KEY=sk-or-v1-xxxx
ORCHESTRATOR_MODEL=google/gemini-2.5-pro-preview

IMAGE_GEN_BASE_URL=https://openrouter.ai/api/v1
IMAGE_GEN_API_KEY=sk-or-v1-xxxx
IMAGE_GEN_MODEL=google/gemini-3.1-flash-image-preview

VISION_BASE_URL=https://openrouter.ai/api/v1
VISION_API_KEY=sk-or-v1-xxxx
VISION_MODEL=google/gemini-3.1-pro-preview

SIMULATION_BASE_URL=https://openrouter.ai/api/v1
SIMULATION_API_KEY=sk-or-v1-xxxx
SIMULATION_MODEL=google/gemini-2.5-flash-preview
```

</details>

<details>
<summary><strong>Google AI Studio</strong>（有免费额度）</summary>

在 [aistudio.google.com](https://aistudio.google.com/apikey) 获取 Key：

```env
ORCHESTRATOR_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
ORCHESTRATOR_API_KEY=AIzaSy...
ORCHESTRATOR_MODEL=gemini-2.5-pro-preview

IMAGE_GEN_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
IMAGE_GEN_API_KEY=AIzaSy...
IMAGE_GEN_MODEL=gemini-3.1-flash-image-preview

VISION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
VISION_API_KEY=AIzaSy...
VISION_MODEL=gemini-3.1-pro-preview

SIMULATION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
SIMULATION_API_KEY=AIzaSy...
SIMULATION_MODEL=gemini-2.5-flash-preview
```

</details>

<details>
<summary><strong>混合搭配</strong>（不同角色使用不同平台）</summary>

你可以为每个角色使用不同的平台。例如用 Google AI Studio 免费额度来生成，用更便宜的供应商来驱动模拟：

```env
# 世界设计 — Google AI Studio
ORCHESTRATOR_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
ORCHESTRATOR_API_KEY=AIzaSy...
ORCHESTRATOR_MODEL=gemini-2.5-pro-preview

# 美术生成 — Google AI Studio
IMAGE_GEN_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
IMAGE_GEN_API_KEY=AIzaSy...
IMAGE_GEN_MODEL=gemini-3.1-flash-image-preview

# 视觉审查 — Google AI Studio
VISION_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
VISION_API_KEY=AIzaSy...
VISION_MODEL=gemini-3.1-pro-preview

# 模拟运行 — DeepSeek（高频调用更划算）
SIMULATION_BASE_URL=https://api.deepseek.com/v1
SIMULATION_API_KEY=sk-...
SIMULATION_MODEL=deepseek-chat
```

</details>

## 操控

世界运行后，你可以：

| 操控 | 说明 |
|------|------|
| **运行 / 回放** | 在实时模拟和录像回放之间切换 |
| **播放 / 暂停** | 开始或暂停模拟 |
| **关系图谱** | 查看角色之间的关系网络 |
| **事件日志** | 浏览所有事件的时间线 |
| **上帝面板** | 广播事件、给角色注入记忆、编辑角色档案 |
| **沙盒对话** | 与任意角色进行私密对话 |
| **新时间线** | 从同一个世界分支出全新的模拟 |

## 项目结构

```
WorldX/
├── orchestrator/         # LLM 驱动的世界设计与配置生成
│   ├── src/
│   │   ├── index.mjs           # 管线入口：一句话 → 世界
│   │   ├── world-designer.mjs  # LLM 世界设计
│   │   └── config-generator.mjs
│   └── prompts/
│       └── design-world.md     # 世界设计 prompt 模板
├── generators/           # 美术生成管线
│   ├── map/              # 地图生成（多步骤 + 审查循环）
│   └── character/        # 角色立绘生成（含抠图）
├── server/               # 模拟引擎（Express + SQLite + LLM）
│   └── src/
│       ├── core/         # WorldManager, CharacterManager
│       ├── simulation/   # SimulationEngine, DecisionMaker, DialogueGenerator
│       ├── llm/          # LLMClient, PromptBuilder
│       └── store/        # SQLite 持久化（每时间线独立）
├── client/               # 游戏客户端（Phaser 3 + React 19）
│   └── src/
│       ├── scenes/       # BootScene, WorldScene
│       ├── ui/           # React 覆盖层面板
│       └── systems/      # 相机、寻路、回放
├── shared/               # 共享工具（结构化输出解析）
├── library/worlds/       # 内置示例世界
├── output/worlds/        # 你生成的世界
└── .env.example          # 配置模板
```

## 工作原理

### 世界生成

1. **设计** —— 编排引擎 LLM 设计世界：区域、角色、社交关系、时间规则
2. **地图** —— AI 生成俯视角地图，再通过多步审查管线定位可行走区域、功能区域和交互元素
3. **角色** —— AI 为每个角色生成精灵图，自动完成绿幕抠图
4. **配置** —— 所有资产桥接为运行时配置（world.json、scene.json、角色 JSON、TMJ 地图）

### 模拟运行

每个 tick，每个角色会：
1. **感知** —— 看到附近的角色、地点、近期事件
2. **决策** —— 根据性格和上下文选择行动（移动、对话、观察、互动）
3. **执行** —— 执行决策，可能触发对话、记忆形成或关系变化
4. **记忆** —— 将重要事件存为记忆，影响未来行为

### 时间线系统

每次模拟运行都会记录为一条 **时间线** —— 独立的事件流，拥有自己的数据库。你可以：
- 为同一个世界运行多条时间线
- 逐帧回放任意时间线
- 对比同一个世界的不同演化轨迹

## 开发

```bash
npm run dev          # 同时启动客户端和服务器（开发模式）
npm run create       # 通过命令行生成新世界
```

- 客户端：`http://localhost:3200`
- 服务器：`http://localhost:3100`
- 开发覆盖层：在客户端 URL 后加 `?dev=1`

## License

MIT
