# 艾欧尼亚 100× Zone 完整规划与实现方案

> **摘要**：本文档基于《英雄联盟》设定中的艾欧尼亚（Ionia / First Lands），给出一个 100× 量级 zone 的完整规划与实现方案。文档涵盖世界观背景、地理骨架设计、子区域（chunk）拼图、过渡区编排、命名地标的视觉与交互细节、生成提示词模板、连通性约束、风格锚定方案与分阶段落地计划。该规划同时作为 WorldX 项目"三层金字塔架构"中 Zone 层的标杆验证案例。
>
> 本文档为 [`scaling-worlds.md`](./scaling-worlds.md)（《大规模 AI 生成世界研究报告》）的配套实现方案，可独立阅读。

---

## 目录

1. [选择艾欧尼亚作为标杆的理由](#1-选择艾欧尼亚作为标杆的理由)
2. [世界观与设定概述](#2-世界观与设定概述)
3. [Zone 层级目标与体感规模](#3-zone-层级目标与体感规模)
4. [地理骨架（Overworld 设计）](#4-地理骨架overworld-设计)
5. [Chunk 拼图：12 个命名地标](#5-chunk-拼图12-个命名地标)
6. [过渡 Chunk 编排](#6-过渡-chunk-编排)
7. [Chunk 网格布局](#7-chunk-网格布局)
8. [生成提示词模板](#8-生成提示词模板)
9. [风格锚定方案](#9-风格锚定方案)
10. [连通性约束与校验](#10-连通性约束与校验)
11. [数据结构与文件组织](#11-数据结构与文件组织)
12. [角色 / NPC 配置](#12-角色--npc-配置)
13. [分阶段落地计划](#13-分阶段落地计划)
14. [验收标准](#14-验收标准)
15. [风险与备选方案](#15-风险与备选方案)

---

## 1. 选择艾欧尼亚作为标杆的理由

艾欧尼亚作为 100× zone 的验证案例具备以下独特优势：

| 维度 | 艾欧尼亚的契合点 |
|---|---|
| 地理多样性 | 群岛、山脉、平原、海岸、森林、灵能裂缝六类生态共存 |
| 视觉识别度 | 拳头官设有大量原画与动画素材，可作为 IP-Adapter 的风格锚定来源 |
| 文化一致性 | 整体东方水墨美学统一，便于检验"风格漂移"是否可控 |
| 叙事张力 | 战后复苏、宗派对立、灵能裂缝等设定天然提供丰富的功能区差异 |
| 角色密度 | 17 位以上《英雄联盟》出身于此或与之深度关联，角色生态丰富 |
| 用户认知度 | 全球数亿玩家熟悉该 IP，demo 传播性强 |

---

## 2. 世界观与设定概述

### 2.1 官方背景

艾欧尼亚是符文之地（Runeterra）东方的群岛国家，亦称"第一之地（First Lands）"。其文化以与精神世界（Spirit Realm）的紧密联系为核心，融合东方水墨美学、武道修行、自然崇拜等元素。两年前刚经历诺克萨斯帝国的全面入侵，目前处于战后复苏阶段。

### 2.2 关键设定锚点

- **灵能渗透**：艾欧尼亚地脉与精神领域接壤，部分地点存在灵能裂缝
- **宗派林立**：均衡教派（锦魁三守护）、影流（劫的暗杀者议会）、Vastayan 部族等并存
- **建筑风格**：以东方木构为主，多重檐、纸门、石灯笼、樱花林、稻田梯田
- **战痕未消**：南部沿海仍有大量焚毁村庄、断垣残壁、纪念碑

### 2.3 美学基调

整体视觉应统一为：**东方水墨工笔风格，淡雅色调（玉绿、樱粉、雾白为主色），柔和水彩边缘，金黄时光照明，无强对比硬轮廓**。

---

## 3. Zone 层级目标与体感规模

### 3.1 量化目标

| 指标 | 数值 |
|---|---|
| Chunk 总数 | 约 42 个 |
| 命名地标数 | 12 个 |
| 过渡 chunk 数 | 30 个 |
| 单 chunk 尺寸 | 1536×1024 像素（继承 1× 标准） |
| 单 chunk 网格 | 96×64 tile |
| Zone 总像素覆盖 | 约 6×7 chunk 网格，整体约 9216×7168 像素（不含跨 chunk 重叠） |
| 总可走 tile | 约 250,000 tile |

### 3.2 体感规模

- 东西穿越：约 6 个 chunk × 1.5 分钟 ≈ **9 分钟**
- 南北穿越：约 7 个 chunk × 1.5 分钟 ≈ **11 分钟**
- 全境探索：包含支线、迂回、地标停留，约 **3-5 小时**

---

## 4. 地理骨架（Overworld 设计）

### 4.1 总体布局

艾欧尼亚采用**南北长、东西窄**的群岛主体结构，长宽比约 7:6。

```
                ╔══════════════════════════════════════╗
                ║          [N] 巴尔山脉                ║
                ║              ╲                       ║
                ║          翁玛梦林                    ║
                ║              ╲                       ║
                ║          修真寺 ─ 影流秘窟           ║
                ║              │                       ║
                ║          灵息渡口 (神域裂缝)         ║
   西海(W) ═════║              │                       ║═════ 东海(E, 面向 Valoran 大陆)
                ║          纳沃利圣坛 (中心 hub)       ║
                ║              │                       ║
                ║          均衡神殿 ─ 羽族秘巢         ║
                ║              │                       ║
                ║          修桑稻田                    ║
                ║              │                       ║
                ║          加林港                      ║
                ║              ╲                       ║
                ║          战痕渔村 ─ 流浪戏团         ║
                ║          [S]                         ║
                ╚══════════════════════════════════════╝
```

### 4.2 必须钉死的地理特征

**Overworld 骨架图**（约 1024×1024 像素的 semantic segmentation）必须明确表达以下内容：

| 特征 | 颜色编码 | 必须满足 |
|---|---|---|
| 海岸线 | 蓝色边界 | 东侧主海岸线连续，西侧群岛点缀 |
| 中央山脊 | 灰色脊线 | 巴尔→修真寺→修桑一线连续 |
| 主干河流 | 浅蓝带 | 3 条主河贯穿森林至海岸（北、中、南各一） |
| 主干道路 | 棕色线 | 命名地标之间有连续的可行走路径，构成"井"字形主干 |
| 灵能裂缝 | 紫色光晕 | 灵息渡口为中心，影响半径约 1 chunk |
| 战痕地带 | 焦黑斑块 | 集中于南部沿海与纳沃利周边 |

### 4.3 Overworld 生成提示词

```
生成一张艾欧尼亚（《英雄联盟》设定）的低分辨率世界总览语义图，
1024×1024，俯视角，semantic segmentation 风格：
- 蓝色：海岸线与河流（东海岸主体连续，3 条主河）
- 灰色：中央南北向山脊
- 棕色：主干道路网络（连接 12 个命名地标，构成井字形）
- 绿色：森林与稻田
- 紫色光晕：灵息渡口处的灵能裂缝
- 焦黑色斑块：南部战痕地带
- 黄色圆点：12 个命名地标位置
不要任何文字标注，颜色块边界清晰，便于后续 ControlNet 使用。
```

---

## 5. Chunk 拼图：12 个命名地标

### 5.1 地标总览表

| 编号 | 地标 | 占用 chunk 数 | 主题 | 关联英雄 | 关键交互元素 |
|---|---|---|---|---|---|
| L01 | 纳沃利圣坛 | 3 | 中心 hub，战后重建中的圣殿 | 卡尔玛、艾瑞莉娅 | 圣殿、市集、祭坛、断墙 |
| L02 | 加林港 | 2 | 商港，繁忙码头与走私酒馆 | 凯隐、瑟提 | 码头、酒馆、货栈、灯塔 |
| L03 | 修桑稻田 | 1 | 田园，亚索故乡 | 亚索、永恩 | 稻田、风车、纪念碑 |
| L04 | 修真寺 | 1 | 山顶御风剑道修行场 | 永恩、亚索 | 道场、风铃、断剑碑 |
| L05 | 影流秘窟 | 1 | 隐秘崖壁的暗杀者议会 | 劫、慎、阿卡丽 | 暗道、训练桩、卷宗室 |
| L06 | 均衡神殿 | 2 | 灵林深处的锦魁三守护本部 | 慎、阿卡丽、凯南 | 主殿、修行洞、灵泉 |
| L07 | 巴尔猴王城 | 2 | 山巅的 Vastayan 树屋部落 | 悟空 | 树屋、晾场、武斗台 |
| L08 | 翁玛梦林 | 2 | 异色森林，梦境领域 | 莉莉娅、佐伊 | 梦境之树、迷雾走廊 |
| L09 | 灵息渡口 | 1 | 神域裂缝，永恒花海与灵会节场 | 妖姬 | 灵息石、花海、香坛 |
| L10 | 羽族秘巢 | 1 | 林冠，Vastayan 反抗军 | 霞、洛 | 树冠平台、羽箭训练场 |
| L11 | 战痕渔村 | 1 | 南海岸，诺战旧伤口 | NPC 主导 | 焚毁屋、纪念碑、晒鱼场 |
| L12 | 流浪戏团 | 1 | 移动式小型集会 | 萨勒芬妮 | 帐篷舞台、行李车、火堆 |

### 5.2 地标详细规格（以纳沃利圣坛为例）

#### L01 纳沃利圣坛（3 chunk）

**位置**：zone 中心，北中部
**主题**：诺克萨斯入侵后受损最严重的精神中心，重建中，象征艾欧尼亚的复兴
**Chunk 编号**：L01-A（圣殿区）、L01-B（市集区）、L01-C（断墙广场）

| Chunk | 视觉重点 | 可交互元素 | 与邻居衔接 |
|---|---|---|---|
| L01-A 圣殿区 | 多重檐主殿，中央祭坛，周围竹林环绕 | 主祭坛（祈愿）、香炉、卷宗台 | 北接 L01-B；南接 L06 均衡神殿 |
| L01-B 市集区 | 修复中的店铺、复兴市集、人潮 | 茶肆、字画铺、灵草摊 | 西接 L01-C；东接主干道至 L02 |
| L01-C 断墙广场 | 战后纪念碑、断墙、烈士石像群 | 纪念碑、献花台、誓言钟 | 北接 L01-A；连接战痕地带 |

**生成提示词模板**：

```
生成艾欧尼亚纳沃利圣坛 [chunk-name] 区域的 4K 俯视地图，1536×1024。
风格：东方水墨工笔，玉绿与樱粉为主色，柔和水彩边缘。
内容：[chunk-specific-content]
参考骨架：[overworld-crop-image]
邻居约束：北边缘 y=0-128 的道路必须从 x=[x1] 到 x=[x2] 连续；
        东边缘 x=1408-1536 的稻田纹理必须与邻居 chunk [neighbor-id] 一致。
风格锚定：[style-anchor-image]
硬性约束：俯视 90°，无文字，无角色，建筑被横切露出内部。
```

### 5.3 其余 11 个地标的简化规格

完整规格将在原型阶段（参见第 13 节）随每个 chunk 单独编写。本文档先给出原则：

- 每个地标至少包含 **1 个核心交互元素**（玩家可触发的剧情/对话/任务起点）
- 每个地标的视觉重心需明显区别于其他地标，避免"看起来都差不多"
- 每个地标与至少 2 个邻居 chunk 共享道路或地形特征，保证可达

---

## 6. 过渡 Chunk 编排

### 6.1 过渡类型分类

30 个过渡 chunk 划分为 6 大类，每类 4-6 个，确保多样性：

| 类型 | 数量 | 视觉主题 | 典型可交互元素 |
|---|---|---|---|
| 森林小径 | 6 | 竹林、樱花林、灵能林 | 路边神龛、流浪商人、灵息植物 |
| 山间栈道 | 5 | 悬崖栈道、瀑布、温泉 | 观景台、温泉池、山神祠 |
| 海边石滩 | 4 | 礁石、灯塔、渔船 | 漂浮物、捡贝壳点、灯塔 |
| 稻田阡陌 | 5 | 梯田、风车、农舍 | 农夫、稻草人、井 |
| 灵能空地 | 5 | 灵息漂浮石、花海、雾境 | 灵息石、香坛、花瓣旋涡 |
| 战火废墟 | 5 | 焚毁屋、断墙、纪念碑 | 纪念碑、遗物、流浪者 |

### 6.2 过渡 chunk 的设计原则

- **必须与至少一个命名地标相邻**，作为通往该地标的"前奏"
- **本身不承载主线剧情**，但提供环境叙事、支线接触点、探索奖励
- **生成成本可压缩**：相同类型的过渡 chunk 可共享提示词模板，仅替换地理位置参数

---

## 7. Chunk 网格布局

### 7.1 网格坐标系

采用 **6 列 × 7 行**网格（部分格子留空表示海洋），共 42 个有效 chunk：

```
        col0  col1  col2  col3  col4  col5
row0    ■SEA  T-森  L07   T-森  T-森  ■SEA       (北部山脉与森林带)
row1    T-海  L08   T-森  L04   L05   ■SEA
row2    T-海  T-森  L01-A T-森  T-森  T-森       (中部 - 纳沃利核心)
row3    T-海  T-灵  L01-B L09   L10   T-森
row4    ■SEA  L11   L01-C L06   T-林  T-森       (中南部 - 均衡与纪念)
row5    ■SEA  T-稻  L03   T-稻  T-稻  L02       (南部 - 田园与商港)
row6    ■SEA  T-海  L12   T-海  T-战  T-战       (南端 - 流浪与战痕)
```

> 图例：L## = 命名地标；T- = 过渡 chunk（类型）；■SEA = 不可达海域

### 7.2 主干道路规划

**主十字路径**：
- 南北主干：col2 自上而下，贯穿 L07 → L01 → L03
- 东西主干：row3 自左至右，贯穿 L11 → L01-B → L09 → L10
- 西海岸支线：col1 自北向南，串联 L08 → L11 → L12

主干道路在生成时**优先确定**，确保任意命名地标可达。

---

## 8. 生成提示词模板

### 8.1 全局风格 token（每个 chunk 提示词的固定头部）

```
[STYLE-LOCK]
Style: Eastern fantasy ink-and-wash painting, soft pastel palette
dominated by jade green, cherry pink, mist white. 90° top-down view.
Soft watercolor edges, no harsh outlines. Ambient golden hour lighting.
Detail level: refined Chinese ink illustration with gentle gradients.
World: Ionia from League of Legends, post-Noxian-invasion era,
spiritually charged, recovering yet melancholic.
[/STYLE-LOCK]
```

该 token 必须**逐字复制**到所有 42 个 chunk 与 overworld 提示词中，置于最前。

### 8.2 命名地标 chunk 提示词模板

```
[STYLE-LOCK ...]

[CHUNK-CONTENT]
This is the {{landmark_name}} of Ionia — {{theme_short}}.
Visual focus: {{visual_focus}}
Key landmarks within this tile: {{key_features}}
Interactive elements: {{interactive_elements}}
[/CHUNK-CONTENT]

[NEIGHBOR-CONSTRAINTS]
North edge (y=0..128): {{north_constraint}}
East edge (x=1408..1536): {{east_constraint}}
South edge (y=896..1024): {{south_constraint}}
West edge (x=0..128): {{west_constraint}}
[/NEIGHBOR-CONSTRAINTS]

[GEOMETRY-ANCHOR]
ControlNet input: overworld_crop_{{chunk_id}}.png
Strength: 0.65
[/GEOMETRY-ANCHOR]

[STYLE-ANCHOR]
IP-Adapter reference: ionia_anchor.png
Strength: 0.45
[/STYLE-ANCHOR]
```

### 8.3 过渡 chunk 提示词模板

```
[STYLE-LOCK ...]

[CHUNK-CONTENT]
A {{transition_type}} area in Ionia, between {{north_landmark}} and {{south_landmark}}.
No major settlement; serves as connective scenery.
Optional interactive element: {{small_interactive}} (max 1 per chunk)
[/CHUNK-CONTENT]

[NEIGHBOR-CONSTRAINTS ...]
[GEOMETRY-ANCHOR ...]
[STYLE-ANCHOR ...]
```

---

## 9. 风格锚定方案

### 9.1 锚定图生成

在所有 chunk 生成之前，先生成一张 **`ionia_anchor.png`** 作为视觉基准：

- 尺寸：1024×1024
- 内容：包含艾欧尼亚最具代表性的元素——樱花、竹林、木构亭台、远山、雾气
- 风格：完全符合第 9 节定义的全局风格 token
- 用途：作为 IP-Adapter 的参考图，强制约束所有 42 个 chunk 的视觉调性

### 9.2 IP-Adapter 配置

| 参数 | 值 | 说明 |
|---|---|---|
| 模型 | FLUX.1 Redux 或 SDXL IP-Adapter Plus | 视主出图模型而定 |
| Reference image | `ionia_anchor.png` | 全局唯一 |
| Strength | 0.45 | 经验值，过强会抹平 chunk 差异 |
| Apply to | 所有 chunk 与过渡 chunk | 包括 overworld 二次细化时 |

### 9.3 调色板对齐（兜底）

生成完成后，将 `ionia_anchor.png` 的 LAB 色彩直方图作为 anchor，对所有 42 chunk 做轻度（约 30% 强度）色彩转移。该步骤为可选兜底，仅在主观评估发现明显漂移时启用。

---

## 10. 连通性约束与校验

### 10.1 chunk_graph 数据结构

```json
{
  "nodes": [
    { "id": "L01-A", "row": 2, "col": 2, "type": "landmark" },
    { "id": "T-forest-04", "row": 2, "col": 3, "type": "transition" },
    ...
  ],
  "edges": [
    {
      "from": "L01-A",
      "to": "L01-B",
      "shared_border": "south-north",
      "walkable_overlap": [{"y": [128, 256]}],
      "verified": false
    },
    ...
  ]
}
```

### 10.2 校验流程

每个 chunk 生成后立即执行：

1. 提取右下两条边缘（16 像素条带）
2. 与已生成的相邻 chunk 的左上边缘对比 SSIM
3. 若 SSIM < 0.85，触发自动重生成（保留固定边缘 mask）
4. 重生成失败 3 次后人工介入

全部生成完成后执行**全局连通性校验**：

- 拼合所有 chunk 的 walkable grid
- 从 L01-A（圣坛中心）做 flood fill
- 要求 12 个命名地标全部位于同一连通分量
- 不连通的地标触发"连通修复"：在其与最近已连通节点之间生成 1-2 个补丁 chunk

### 10.3 接缝可见性校验

- **客观指标**：相邻 chunk 边缘 16 像素条带的 SSIM > 0.85
- **主观指标**：5 位非项目人员盲测拼合图，至少 3 人判定"完整地图"

---

## 11. 数据结构与文件组织

### 11.1 目录结构

```
output/worlds/<world_id>/zones/ionia/
├── overworld.png                 # 1024×1024 总览语义图
├── overworld-detailed.png        # 1024×1024 风格化预览（可选）
├── ionia_anchor.png              # 风格锚定图
├── chunk_graph.json              # 全局连通性图
├── zone-design.json              # zone 元数据
├── chunks/
│   ├── L01-A/
│   │   ├── 01-original-map.png
│   │   ├── 06-background.png
│   │   ├── 06-final.tmj
│   │   ├── 06-regions-scaled.json
│   │   ├── 06-elements-scaled.json
│   │   ├── neighbor-constraints.json
│   │   └── metadata.json
│   ├── L01-B/...
│   ├── T-forest-01/...
│   └── ...
└── logs/
    ├── generation.log
    ├── connectivity.log
    └── style-drift.log
```

### 11.2 zone-design.json 示例

```json
{
  "zoneId": "ionia",
  "zoneName": "艾欧尼亚",
  "lore": "符文之地东方的灵能群岛，第一之地，战后复苏期",
  "gridLayout": { "rows": 7, "cols": 6 },
  "chunkSize": { "width": 1536, "height": 1024 },
  "tileSize": 16,
  "namedLandmarks": [
    { "id": "L01", "name": "纳沃利圣坛", "chunks": ["L01-A","L01-B","L01-C"], "centerOf": "zone" },
    ...
  ],
  "transitions": [
    { "id": "T-forest-01", "type": "forest-path", "row": 0, "col": 1 },
    ...
  ],
  "portalsToOtherZones": [
    { "id": "to-noxus", "atLandmark": "L02", "targetZone": "noxus", "type": "ship" },
    { "id": "to-spirit-realm", "atLandmark": "L09", "targetZone": "spirit-realm", "type": "rift" }
  ],
  "styleAnchor": "ionia_anchor.png",
  "globalStyleToken": "Eastern fantasy ink-and-wash..."
}
```

---

## 12. 角色 / NPC 配置

### 12.1 关联英雄分布

| 地标 | 常驻英雄（自主活动） | 客串英雄（偶现） |
|---|---|---|
| L01 纳沃利圣坛 | 卡尔玛、艾瑞莉娅 | 凯尔 |
| L02 加林港 | 凯隐、瑟提 | 派克（路过） |
| L03 修桑稻田 | 亚索 | 永恩（特定时间） |
| L04 修真寺 | 永恩 | 亚索（极少出现） |
| L05 影流秘窟 | 劫 | — |
| L06 均衡神殿 | 慎、阿卡丽、凯南 | — |
| L07 巴尔猴王城 | 悟空 | — |
| L08 翁玛梦林 | 莉莉娅、佐伊 | — |
| L09 灵息渡口 | 妖姬 | 卡尔玛（节庆） |
| L10 羽族秘巢 | 霞、洛 | — |
| L11 战痕渔村 | NPC 主导 | 瑞雯（隐居者） |
| L12 流浪戏团 | 萨勒芬妮 | 巴德（极偶尔） |

### 12.2 NPC 密度

| Chunk 类型 | NPC 数量 |
|---|---|
| 命名地标（核心） | 4-8 名 |
| 命名地标（外围） | 2-4 名 |
| 过渡 chunk | 0-2 名 |
| 总计 | 约 80-120 名 |

---

## 13. 分阶段落地计划

### 阶段 P1：栈迁移与单 chunk 验证（2-3 周）

- 完成 Gemini 至 Flux 的栈迁移
- 接入 ControlNet 与 IP-Adapter
- 生成 `ionia_anchor.png`
- 用单 chunk（如 L01-A）验证：风格锚定有效、Step 3/3.2/4 改造可工作

**通过标准**：单 chunk 视觉质量不弱于现有 Gemini 输出，风格符合艾欧尼亚基调。

### 阶段 P2：3×3 chunk 原型（2-3 周）

- 选取以 L01-A 为中心的 3×3 网格（L01-A、L01-B、L01-C 加 6 个邻接过渡 chunk）
- 生成 overworld 子区裁切
- 完整跑通生成、校验、重生成闭环
- 实施 4 项硬指标校验（参见 [`scaling-worlds.md` 第 14 节](./scaling-worlds.md#14-验证计划)）

**通过标准**：4 项硬指标全部通过；主观评估 ≥ 3/5。

### 阶段 P3：完整艾欧尼亚（4-6 周）

- 扩展至 42 chunk
- 实现命名地标与过渡 chunk 双类生成模板
- chunk_graph 全局连通性校验
- 后处理流水线 chunk 化改造

**通过标准**：42 chunk 全部生成完成且通过连通性校验；玩家可在艾欧尼亚内连续漫游 ≥ 30 分钟无明显接缝穿帮。

### 阶段 P4：NPC 与运行时（3-4 周）

- 部署 80-120 名 NPC（含 17 名英雄）
- character-manager 适配跨 chunk 寻路
- 实现简单的"远距感知"（角色知道隔壁 chunk 大致是什么）
- 加 2 个 portal（至诺克萨斯、至灵能领域）

**通过标准**：英雄角色能在分配的地标内自主活动；玩家与英雄对话符合人设。

---

## 14. 验收标准

### 14.1 客观指标（量化）

| 指标 | 阈值 | 测量方法 |
|---|---|---|
| 接缝 SSIM | > 0.85 | 相邻 chunk 16 像素边缘条带 |
| 全局连通率 | 100% | flood fill 覆盖 12 个命名地标 |
| 风格方差 | < 单 chunk 内噪声 × 2 | VGG / LAB 直方图 |
| LLM 语义一致性 | ≥ 75% 接缝判定一致 | Gemini Pro Vision 评估 |
| 单 chunk 平均生成时长 | < 8 分钟 | 含重试 |
| 单 zone 总生成时长 | < 6 小时 | 42 chunk 串行 |
| 单 zone 总成本 | < $30 | Flux + Vision 调用 |

### 14.2 主观指标（人评）

| 指标 | 阈值 |
|---|---|
| 拼合图盲测"完整地图"判定率 | ≥ 60% |
| 玩家连续漫游 30 分钟无穿帮报告 | ≥ 80% 测试者 |
| IP 还原度（艾欧尼亚迷盲评） | ≥ 70% 认可 |

### 14.3 demo 标准

最终交付一段 **3 分钟 demo 视频**：

- 玩家从纳沃利圣坛出发
- 经修桑稻田、加林港，至灵息渡口
- 全程无地图加载中断（仅边界微淡入淡出）
- 至少与 3 位英雄发生互动

---

## 15. 风险与备选方案

### 15.1 主要风险

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| Flux 中文 prompt 弱 | 高 | 中 | 加 prompt 翻译层；保留 Gemini 做特定中文场景 |
| ControlNet 几何精度不足 | 中 | 高 | 提高 ControlNet strength，加 canny 多重条件 |
| 风格漂移仍肉眼可见 | 中 | 中 | 启用调色板对齐兜底；缩短 chunk 间最长链 |
| 单 chunk 平均成本超预期 | 低 | 中 | 切换至 Flux.1-dev（自托管），每张约 $0.01 |
| IP 法律风险 | 中 | 高 | demo 阶段使用艾欧尼亚为内部验证；公开版改为原创世界 |
| 内容产能瓶颈 | 高 | 中 | 12 命名地标可分阶段交付；前 3 个最重要 |

### 15.2 缩减版备选（若资源不足）

若全量 42 chunk 无法在预算内交付，按优先级缩减：

- **缩减 1**：仅交付 12 个命名地标 + 12 个过渡（共 24 chunk），约 50× 量级
- **缩减 2**：仅交付 6 个核心地标（L01、L02、L03、L06、L07、L09）+ 6 个过渡，约 25× 量级
- **缩减 3**：仅交付 L01 的 3 个 chunk，作为单地标 demo

---

## 附录 A：关键术语表

| 术语 | 定义 |
|---|---|
| Zone | 一个完整可漫游的地理区域，由多个 chunk 组成（艾欧尼亚 = 1 个 zone） |
| Chunk | zone 内部的最小生成单元，对应 1 张 4K 图（1536×1024 像素） |
| Overworld | zone 的低分辨率语义骨架图，作为 ControlNet 输入 |
| Style Anchor | 风格锚定图，作为 IP-Adapter 参考输入 |
| 命名地标（Named Landmark） | 具备主线剧情或关键交互的 chunk 集合 |
| 过渡 chunk（Transition Chunk） | 不承载主线但提供环境叙事的 chunk |
| Portal | 跨 zone 的传送点（船、传送阵、关隘） |
| chunk_graph | 描述 chunk 间连通性的图数据结构 |

## 附录 B：参考资料

- 《大规模 AI 生成世界研究报告》[`scaling-worlds.md`](./scaling-worlds.md)
- 《英雄联盟》官方艾欧尼亚设定（拳头官网 universe.leagueoflegends.com）
- WorldX 当前流水线代码：`generators/map/src/`

---

*本文档为艾欧尼亚 zone 的完整规划与实现指南，作为 WorldX 三层金字塔架构 Zone 层的标杆验证案例，配合主报告 [`scaling-worlds.md`](./scaling-worlds.md) 阅读。*
