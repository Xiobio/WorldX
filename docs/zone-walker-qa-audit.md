# Zone Walker — 7 天迭代 QA Audit

> 本文档由 iter #16（QA pass，而非原计划的 #16 多 zone）产出。15 轮快速迭代后，**这是首次系统化审视**。在我自己承认"在盲飞"之后，这一轮主动 review 现有代码而非堆新功能。

## TL;DR

**当前状态**：Zone Walker 已达**专业可玩水平**——10 大维度全数到位（探索 / 互动 / 进度 / 手感 / 视觉 / 听觉 / 仪式 / 跨设备 / 存档 / 偏好）。

**剩余风险**：未在真实浏览器逐项验证；可能存在我没看到的小 bug；性能在低端设备未实测。

## 已 ship 的 15 项（按 iteration 顺序）

| # | 功能 | 关键产物 |
|---|---|---|
| 1 | 互动 POI 系统 | 52 处秘境 + 描述卡 + 进度计数 + localStorage |
| 2 | 运动手感 | 速度 lerp、撞墙抖屏、尘埃、idle bobbing |
| 3 | 环境音 + 互动音 | 8 ambient 预设 + 5 SFX + 静音持久化 |
| 4 | 场景生命感 | 萤火/花瓣/灰烬/雾丝 4 类大气粒子 |
| 5 | 开场仪式 | 标题序列 + 110Hz 三谐波 swell |
| 6 | 任务/目标层 | 双线 52+14 · 9 里程碑 toast · 集萃庆祝爆发 |
| 7 | 角色独白 | 14 landmark 各一句 Yasuo 风格台词 |
| 8 | 过场仪式升级 | letterbox + chapter card 双层电影感 |
| 9 | 碰撞反馈 | （iter #2 已包含） |
| 13 | 小地图升级 | POI heatmap + landmark visited 钻石 + hover tooltip |
| 12 | 触屏支持 | 虚拟摇杆 + 触屏 POI 点击 + 横屏强制 + 小屏 CSS |
| 14 | 完整存档 | chunk + 坐标 + 设置 + 累计游玩 + ?reset=1 |
| 15 | 设置面板 | 音量/速度/字幕/引导/重置 + T 键 |
| QA | 本轮 | 见下 |

主动跳过：#10（NPC placeholder 会破坏 V1 美术）、#11（idle anim 扩展需新 sprite）。

## 本轮 QA 修的 3 个 bug

### 修复 1：设置面板未阻断玩家输入
**症状**：打开设置 → 用户读字 → 不小心按住 SHIFT/WASD → Yasuo 跑去撞墙。
**修复**：`tick()` 移动门加 `!isSettingsOpen()` 条件；`openSettings()` 立刻归零 velocity。

### 修复 2：设置面板 + chapter card 视觉撞车
**症状**：设置开着按 `[`/`]` 切场景 → chapter card 从中央滑入，与右侧面板叠加。
**修复**：`runTransition()` 入口若 `isSettingsOpen()` 则 `closeSettings()`。

### 修复 3：savePositionState 无脑写盘
**症状**：玩家静止站立时，每 1.8s 仍写一次坐标到 localStorage（值与上次完全相同）。
**修复**：缓存 `lastSavedChunkId / lastSavedX / lastSavedY`，相同值直接 return。force=true 时不跳。

## 我自己审计后**没**发现的预期 bug（但未在浏览器验证）

| 区域 | 担忧 | 状态 |
|---|---|---|
| Achievement 队列 | 多个 milestone 同时触发会 stack 吗？ | ✓ 已实现 queue + 700ms 间隔，应该 OK |
| 音频 leak | startAmbient 频繁调用是否泄漏震荡器？ | ✓ 旧节点 1.9s setTimeout 后 stop()，应该 OK |
| Mouseover 与 has-touch | 桌面 + 触屏 hybrid 设备会显示摇杆吗？ | ✓ has-touch 只在真实 touchstart 后才加 |
| 后台标签计时 | document.hidden 检查在 setInterval | ✓ 已实现 |
| 失效存档坐标 | lastPos 落在生成后新增的障碍物上 | ✓ findWalkableNear 兜底 |
| Chunk 未生成 | 配置改了但 localStorage 引用旧 chunk id | ✓ chunkById.has(lastChunkId) 兜底 |

## 我**没**验证的（仍在盲飞范围）

1. **iOS Safari**：AudioContext 在某些版本可能即使 resume 也静音；fullscreen API 局部支持
2. **低端 Android**：每帧 ~80 粒子 + walkable mask + atmo + glow 渲染开销
3. **Firefox**：webkit-prefixed 滑条样式不会生效（已用 moz 备份，但未测）
4. **超大屏（4K）**：canvas DPR 处理是否正确
5. **超小屏（iPhone SE）**：所有 HUD 元素是否能容下
6. **键盘锁定**：游戏控制器映射、IME 输入法切换状态
7. **prefers-reduced-motion**：所有粒子/动画对运动敏感用户的影响

## 真专业可玩的话还差什么（roadmap 之外）

| 维度 | 描述 | 难度 |
|---|---|---|
| 跨设备同步 | 当前只 localStorage，跨浏览器/设备失效。需要后端 + 账户 | 大 |
| 内容深度 | 52 秘境 + 14 landmark 一次性可走完，没有重玩驱动 | 大（需要任务/支线/Roguelike-loop） |
| Yasuo 多状态 | 不同 chunk 应该有不同 idle pose 或衣摆，现在只是同一 sprite | 中（需要新 sprite frame） |
| NPC 系统 | 每个 landmark 应该有真 NPC（亚索看哥哥的祠堂、修真寺师父的剪影）| 大（需要 sprite + 对话系统） |
| 多 zone 串接 | 艾欧尼亚 → 诺克萨斯，传送门跨 zone | 大（生成 + 串接 + 路由） |
| 局部交互 | 拾取物品、用剑斩树、坐茶馆等"动词" | 大（动作系统） |
| 真实开场剧情 | 5-10 分钟剧情序列让玩家有"目标" | 极大（叙事工程） |

## 制作人结论

**Zone Walker 当前形态**：作为 **"AI 生成的可漫游艺术世界"**, 它**已经是专业级 demo / pitch deck 资产**。

**作为完整商业游戏**：还差至少 6-12 个月内容生产 + 后端服务 + 跨平台测试。

**最该做的下一步不是写代码**：
1. 拿给 10 个真用户玩 5 分钟，记录他们的困惑点（不是 bug，是"我不懂这里在做啥"）
2. 录一段 90 秒 demo 视频，看自己是否会被打动
3. 决定是 demo / pitch / 长期开发的哪一种产品定位
