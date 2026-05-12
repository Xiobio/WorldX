# Zone Walker — Game-Producer 化路线图

> 这份 roadmap 用来让 `/loop` 每 30 分钟触发的迭代有**跨次的连续性**：每次 cron 醒来都读这份文档→挑下一项 highest-ROI 任务→ship→打勾。

## 评估基线

**当前**：Yasuo 在 42 chunk 艾欧尼亚中可走 + 边界淡入淡出切换 + 粒子引导。

**美术分**：⭐⭐⭐⭐⭐ 单图、风格一致、命名地标皆有特色。
**玩家分**：⭐ 没有游戏循环、没有目标、没有互动反馈、没有声音、没有持久化。

**结论**：是"插画动画 demo"，不是"可玩游戏"。要专业可玩，按下表的优先级补全玩家分。

## 任务优先级（高 → 低）

| # | 任务 | 价值 | 状态 |
|---|---|---|---|
| 1 | **互动 POI 系统**（祭坛/茶肆/战痕碑可点 + 描述卡 + 进度计数 + localStorage 持久化） | 把"看"变"玩"——最大单项 ROI | ✅ 2026-05-11 |
| 2 | **运动手感**（速度 lerp、撞墙抖屏 + 尘埃喷溅、idle bobbing、跑步动画加速） | 让控制感觉"真"而不是工程师写的 | ✅ 2026-05-11 |
| 3 | **环境音 + 互动音**（程序化 Web Audio：8 种 ambient 预设 + 脚步/铃/钟/撞墙 SFX + M 静音） | 立刻让世界活起来 | ✅ 2026-05-11 |
| 4 | **场景生命感**（萤火 / 樱花 / 战痕灰烬 / 雾丝 / 灵息蓝萤，按场景类型自动路由） | 静帧→动帧，沉浸大跳 | ✅ 2026-05-11 |
| 5 | **开场仪式**（标题 + 装饰 + 简介 + "按任意键启程"，配 110Hz 三谐波 swell） | 仪式感 = 专业感 | ✅ 2026-05-11 |
| 6 | **任务/目标层**（双线 52 秘境 + 14 地标 · 9 个里程碑 toast + 升调铃声 + 集萃/览境庆祝爆发） | 给玩家"为什么继续走"的答案 | ✅ 2026-05-11 |
| 7 | **角色对话气泡**（14 个 landmark 各一句 Yasuo 风格独白 · 头顶气泡 6 秒 · 转场前自动隐藏） | 把空旷的世界注入 IP 个性 | ✅ 2026-05-11 |
| 8 | **过场仪式升级**（letterbox 上下黑条 + chapter card 章节卡：场景名 + 类型副标题 + 装饰金线） | 切换=电影感时刻 | ✅ 2026-05-11 |
| 9 | **碰撞反馈**（撞墙时屏幕轻微抖动 + 灰尘粒子飞溅 + 一声轻闷响） | 让墙变"实体" | ✅ 2026-05-11（在 iter #2 已完成） |
| 10 | **NPC 雏形**（命名地标各放一个不动的剪影 + 走近触发 placeholder 对话） | 世界开始有人 | ⏸️ 跳过：placeholder 剪影会破坏 V1 美术 |
| 11 | **Yasuo idle anim**（站立时呼吸 + 偶尔风衣摆动 frame） | 角色不死气沉沉 | ⏸️ 已有 iter #2 的 idle bobbing，扩展需要新 sprite frame，跳过 |
| 12 | **手机/触屏支持**（虚拟摇杆 + 触屏点击 POI + 横屏强制 + 小屏 CSS 适配） | 受众扩 10 倍 | ✅ 2026-05-11 |
| 13 | **小地图升级**（POI 进度 heatmap + 命名地标 visited 状态钻石 + 当前 chunk 呼吸边框 + 全收集 ✦ 闪光 + hover tooltip） | 探索导航更专业 | ✅ 2026-05-11 |
| 14 | **存档存盘**（chunk + Yasuo 位置 + 引导/静音 + 总游玩时长 + 「继续旅程」 onboarding + `?reset=1`） | 长尾留存的命脉 | ✅ 2026-05-11 |
| 15 | **设置面板**（右滑面板 · 音量滑条 · 速度三档 · 字幕开关 · 引导开关 · 重置按钮 · 游玩统计 · T 键开关 · ⚙ 入口） | 专业产品都要有 | ✅ 2026-05-11 |
| 16 | **多 zone 串接**（艾欧尼亚 → 诺克萨斯）+ zone selector | 路线图扩到 1000× 量级 | ⏸️ 阻塞：需要先生成第二个 zone（80+ 分钟），属内容生产而非系统建设 |
| QA | **首次系统化 QA pass + audit 文档**：修了 3 个真实 UX bug，写了完整审计报告 `zone-walker-qa-audit.md` | 8 轮盲飞后的必要复盘 | ✅ 2026-05-11 |
| 17 | **音乐升级**（低频恐怖 drone → 五声音阶大调 + 高音区慢律动旋律 + 配合 ambient） | 用户反馈"诡异" → 沉浸感重做 | ✅ 2026-05-11 |
| 18 | **风之疾驰**（F 键 · 280ms 高速冲刺 · 风粒子尾迹 · 1.1s 冷却 · 双层 whoosh 音效） | 给 Yasuo 注入签名动作交互 | ✅ 2026-05-11 |
| 19 | **风之羽毛**（每过渡 chunk 1-3 个散落收集物 · 走过即拾 · 4 音 ding · ✦ 火花爆 · 全 zone 总数 ~56） | 给探索注入"走也想走"的动机 | ✅ 2026-05-11 |

## 下次 cron 触发时读什么

- 看上表第一个 ⏳ 的任务
- 看是否 unblock 了更高优先级（如新发现 bug 等）
- 如果上一轮 ship 出了问题需要修，优先修

## 每次 cron 迭代的产出标准

1. **必须**：实际改了代码、跑过语法检查、写入 roadmap 状态
2. **应该**：给出本次迭代的"专业制作人 verdict"（一段话讲清楚现在距离"专业可玩"还差什么）
3. **不应**：堆砌新概念却不 ship 代码

## Bug 修复历史（iter 5 顺手）
- ✅ `velocity` 在 chunk 切换时归零（之前会带动量进新 chunk 反向撞墙）
- ✅ `bumpCooldown` / `cameraShake.intensity` / `footstepCooldown` 同步归零
- ✅ 模态打开时 `[` / `]` / 上一/下一按钮 / 自动巡演 全部禁用

## 当前已实现细节（给后续迭代参考）

### 互动 POI 系统（iter #1）
- POI 位置确定方式：用 chunk.id 做种子的 mulberry32 伪随机洗牌候选 walkable 格子，挑互相距离 ≥ 14 格的点
- POI 视觉：地面金色 halo + 浮空 ✦ 符号 + 14px 阴影发光 + bob 上下浮动
- 走近 96px 内显示 "E 探查" pill；按 E 弹模态卡片
- 模态结构：kind label / 标题 / 金色分割线 / 描述 / 底部 progress + 关闭提示
- 已访问的 POI 视觉变化：✦ → ◆，金色变灰，halo 减弱
- 进度：顶部居中半透胶囊 `✦ X / N 处秘境`，跨 chunk 跨刷新累计（localStorage `worldx.visited`）
- 模态打开时禁用 Yasuo 移动 / 边界切换
- 总 POI 数 = 所有 chunk.interactiveElements 累加（艾欧尼亚: 52）

### 设置面板（iter #15）
- 右滑面板 380px，cubic-bezier 380ms 入场
- 4 个核心设置 + 1 个危险区：
  - **主音量**滑条 0-100（拖动时同步 readout 数字 + 实时调 masterGain）
  - **移动速度**三档 pill（慢 0.7×、标准 1.0×、快 1.3×），通过 speedMultiplier 应用到 getInputVector
  - **字幕开关** switch（关闭时立刻 hideMonologueImmediate）
  - **引导粒子开关** switch（与控制条上的 ✦ 按钮双向同步）
  - **重置全部存档**红色按钮，confirm 二次确认后 wipeSave + reload
- 游玩统计 meta 文字：实时显示已发现秘境/地标 + 累计游玩分钟
- 拖音量到 0 时自动取消静音（合理的 UX 修正）
- 入口三处：底部控制条 ⚙ 按钮、T 键、Esc 关闭
- 全部设置持久化：worldx.volume / worldx.speed / worldx.subtitles
- 滑条用 webkit/moz 双前缀 thumb 自定义金色圆球，深色 track

### 完整存档（iter #14）
- 10 个 localStorage keys：visited / landmarks / achievements / muted / lastChunk / lastPos / overlay / firstPlayed / lastPlayed / totalPlaySec
- 位置每 1.8s 节流保存 + chunk transition 末段 force save
- totalPlaySec：每 5s 累加（document.hidden 时暂停，避免后台标签计时）
- firstPlayed 首次访问写入，lastPlayed 每次启动覆写
- 重启后流程：
  - 若有 lastChunk → 用它作为初始 chunk（覆盖默认 landmark）
  - 用 lastPos 通过 findWalkableNear 精确恢复 Yasuo（防止保存位置变成障碍物）
  - URL `?chunk=X` 仍然优先于存档
- Intro 双分支：
  - 首玩者：原默认文案
  - 回归者：副标识改"继续旅程"，lore 显示"X/52 秘境 · Y/14 地标 · 总计 N 分钟"，hint 显示"按 任意键 · 回到「上次场景名」"
- `?reset=1` URL 参数：清空所有 10 个 keys + replaceState 干净 URL
- walkableOverlayOn 也持久化（之前漏了，本轮补上）

### 触屏支持（iter #12）
- 左下虚拟摇杆（140px base + 60px thumb）：径向辐射底纹 + 金色描边
- 摇杆响应：touchstart 锁定 touchId，touchmove 跟随，touchend 复位
- 推杆 > 0.85 magnitude 自动切换到 PLAYER_SPEED_SHIFT（冲刺）
- 触屏检测惰性：`body.has-touch` 只在第一次真实 touchstart 事件后才加（避免 hybrid 设备误显示）
- Canvas 点击 → 查找 160px chunk-space 内最近 POI → tryInteract（替代 E 键）
- 摇杆区域内的 touch 优先识别为摇杆，不会误触发 POI 交互
- 横屏强制：`@media (max-width: 768px) and (orientation: portrait)` 全屏盖一层 emoji-rotation 提示
- 小屏适配：< 768px 时 HUD/控制条/小地图/chapter card/intro/speech bubble 全部按比例缩小
- touch-action: none 避免摇杆触发系统滚动手势

### 小地图升级（iter #9）
- 主动跳过原 #10 NPC、#11 idle anim 扩展（理由记录在表格里）
- POI 进度作为 chunk 单元格颜色 heatmap：base 暗 → 暖金，按 visited/total 比例 lerp（0.65 上限）
- Landmark 加旋转 45° 钻石标记：已踏足填充金色，未至空心金色描边
- 当前 chunk 加呼吸式金色描边（sin(t/380)）
- 全收集 chunk（visited === total）右上角加 ✦ 小金字闪光
- 玩家位置 6px 径向金色 glow + 2.2px 白点 + 黑描边
- 鼠标悬停 chunk 显示 DOM tooltip：场景名 + 「命名之地 · 已踏」/「过渡之地」+ "X/N 秘境"
- 图例栏（图标 + 文字）：已踏 / 未至 / 暖 = 已探
- minimapStatsCache 按 visitedPois.size 缓存，避免每帧重算 prefix map

### 过场仪式升级（iter #8）
- 切场景从单层黑屏升级为四阶段电影感序列（总时长 ~1.78s）
- Phase 1（0-360ms）：上下 18vh letterbox 黑条从屏外滑入 + 全屏黑场淡入（并行）
- Phase 2（360ms）：黑屏顶峰时 swap chunk + chapter card 滑入（带 20px 上浮 + opacity ease）
- Phase 3（360-1360ms）：黑屏淡出，新场景在 card 之下浮现
- Phase 4（1360-1780ms）：card 滑出 → letterbox 滑回屏外 → 解锁
- Chapter card 结构：「命名之地 / 过渡之地」副标识 + 36px 16-letter-spacing 金色场景名 + ✦ 装饰金线
- 删除旧的 32% 顶部 showToast（与 chapter card 冗余）
- 监督节拍：Yasuo monologue 改为 1500ms 延迟（之前 900ms），避免和 chapter card 视觉撞车
- letterbox 使用 cubic-bezier(0.65,0,0.35,1) 的"快出慢入"曲线，电影感更对

### 角色独白（iter #7）
- 14 个 landmark 每个一句 Yasuo 内心独白（短、诗意、风/剑/悔意主题）
- 关键文案锚定 IP 记忆：修桑稻田"风停了，永恩"、修真寺"风曾在这里教我，剑曾在这里弃我"、纳沃利圣坛"我重建不了的，是那张脸"、影流秘窟"影流的旗仍是黑的"、断墙广场"墙塌时没人问名字，石上却刻下了"
- DOM 气泡（不是 canvas），便于多行 / 中文渲染 / fade 动画
- 视觉：金色左侧 accent 条 + "亚索" 小标识 + 斜体正文 + 深底半透 + 下方三角尾巴指向脚下
- 落地动画：900ms cubic-bezier 上浮 12px（rise-in）+ 700ms opacity 渐入
- 显示 6 秒后 800ms 渐出
- chunk 切换前自动 `hideMonologueImmediate()`，避免气泡跟着 Yasuo 瞬移
- 进入 landmark 后 900ms 才触发，与黑屏淡入对齐
- updateSpeechPosition 每帧把气泡 DOM 同步到 Yasuo 头顶屏幕坐标（含 cameraShake 偏移，含 canvas CSS 缩放比例）
- 关键的 PLAYER_DISPLAY_H 抬升让气泡贴 Yasuo 头部，不挡身体

### 任务 / 目标层（iter #6）
- 双线计数：✦ 52 秘境（POI 发现） + ◈ 14 地标（landmark 类 chunk 踏足）
- 顶部居中 progress HUD 改双 seg + 中间 · 分隔
- 9 个里程碑：
  - POI：1 初次探查 / 5 探者 / 15 知行 / 30 深行者 / 52 集萃 ★
  - Landmark：1 履足 / 4 巡境 / 8 通行 / 14 览境 ★
- ★ 标记的两个最终里程碑触发 celebrate：升调五音 arpeggio + 36 粒子从中心爆开 + 镜头微震
- 普通里程碑触发：双音叮 + 金色 toast 从顶部滑入悬停 3.4s 滑出
- 队列机制：同时触发多个会依次排队播放（700ms 间隔）
- 状态持久化：`worldx.landmarks` + `worldx.achievements`（两个 Set 各自序列化）
- visitLandmarkIfApplicable 在 switchToChunk 末段调用，避免漏触发
- 进入 chunk 即标记（不需要走到哪个点），符合"踏足即算"的设计
- celebration burst 复用 atmoParticles 的 firefly 类型，1/4 概率出蓝色灵萤混色

### 开场仪式（iter #5）
- 黑底全屏 intro 层（z-index 28），加载即覆盖在主画面之上
- 三段式入场动画：
  - sub label "符文之地 · 第一之地"（10px letter-spacing-14 大写）
  - title "艾欧尼亚"（56px letter-spacing-22 金色）淡入上浮 2.2s cubic-bezier
  - 装饰水平线 + 中央 ✦ 切角
  - lore（来自 zoneCfg.zoneIdentity 首句，回退到默认）淡入 1.8s 延迟 0.7s
  - "按 任意键 启程" 提示在 1.8s 后浮现，3.4s 后开始呼吸 pulse 循环
- 首次手势同时触发：进入全屏 + 启动 audio + 启动 ambient + 1.4s 淡出 intro + 110Hz 三谐波 swell（800ms 起音，3.5s 衰减）
- fs-prompt 在 intro 显示期间被 `body:not(.intro-done)` 隐藏，避免双重提示
- intro 文案从 zone config 取（zoneName 首段 + zoneIdentity 首句）

### 场景生命感（iter #4）
- 4 种大气粒子：firefly / petal / ember / mist
- ATMO_BY_PRESET 表按 ambient 预设路由（forest/spirit/ruins/market/field/mountain/water/default 各自分配）
- 内容关键词覆盖：包含"樱花"→ 加 18 个 petal；包含"灯笼"→ 加 8 个 firefly
- spirit 类粒子色温偏蓝（200,230,255）—— 灵息渡口的氛围
- firefly：在全 chunk 区域随机产生（不限 walkable），随机游走 + 微下沉，5-9s 寿命，呼吸式发光（sin 频率 5）
- petal：从顶部 -10 落下，sin 摆动 + 旋转，6-11s 寿命，柔粉椭圆 + 高光
- ember：从 chunk 下 30% 区域升起，0.5s 寿命跳跃，添加随机扰动，黄→橙→暗红径向渐变
- mist：水平慢飘（14-32 px/s），宽椭圆软渐变（半径 90-170px），8-14s 寿命
- 随机化用粒子自身的 seed 让每个粒子的相位独立（不会同步抽搐）
- 渲染顺序：背景图 → atmo → walkable overlay → glow particles → edge exits → POIs → player
- 全部用 Canvas 程序化绘制，零素材文件

### 环境音 + 互动音（iter #3）
- 零外部音频文件，全部 Web Audio API 程序化合成
- 8 种 ambient 预设：water / spirit / ruins / market / field / forest / mountain / default
- 关键词路由：海港河溪→water，灵神坛→spirit，战痕废墟→ruins，市集茶酒→market，稻田→field，山岭崖→mountain，竹林→forest
- Ambient 结构：低音 sine/triangle 谐波堆 + LFO 呼吸调制 + 滤波粉噪
- 切 chunk 时 1.6s 交叉淡入淡出（旧 ambient 平滑消失，新 ambient 平滑升起）
- SFX 全部即时合成：
  - 脚步：滤波白噪短爆，~3 步/秒（与 animSpeedFactor 同步），按 footstepCooldown 控制
  - POI 互动：880/1320/1760Hz sine 钟声（1.5-1.8s 衰减）
  - chunk 切换：76Hz 基频 × [1, 1.51, 2.42, 3.66] 谐波堆（古钟）+ 低通脉冲（2.6s）
  - 撞墙：低通 180Hz 白噪短爆（闷响）
- 首次用户手势同时触发：全屏 + 音频 Context 初始化 + 启动当前 chunk 的 ambient
- 静音状态持久化（localStorage `worldx.muted`），M 键 + 控制条 🔊 按钮可切
- 静音状态下 SFX 直接 return，不浪费 CPU

### 运动手感（iter #2）
- 速度状态 `velocity = {vx, vy}`，每帧 lerp 到目标（exp 衰减、帧率无关）
- ACCEL_TIME = 0.14s（启动），DECEL_TIME = 0.11s（松键减速）
- 速度低于 3 px/s 且无输入时 snap 为 0，避免抖动
- 撞墙检测：tryMove 返回 `{moved, blocked}`；当玩家有输入但 moved=false → 触发 bump
- Bump 反馈：cameraShake.intensity = 1，0.22s 衰减；屏幕随机偏移 ±5 * intensity px
- 撞墙尘埃：5-8 个 kind="dust" 粒子向后弹（重力 160，水平阻尼 0.4），灰褐色，0.5-0.9s 寿命
- bumpCooldown = 0.18s 避免持按时反复触发
- idle bobbing：currentAnim.startsWith("idle") 时 sprite 加 sin(performance.now/520)*1.4 像素垂直位移
- 跑步动画加速：animSpeedFactor = clamp(speed / PLAYER_SPEED, 0.65, 1.8)；只作用于 walk-* anims
- pickAnimFromMovement 阈值 30 px/s，velocity-decay 尾巴自然过渡到 idle
- 滑墙时被阻挡轴的 velocity 归零，物理感更对
- 粒子系统增加 kind 字段：`glow`（沿用，仅在引导开启时绘制）/ `dust`（新，碰撞反馈，source-over 灰色实体）
