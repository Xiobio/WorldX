/** 游戏时间 */
export interface GameTime {
  day: number;
  tick: number;
}

/** 场景时间配置 */
export interface MultiDayConfig {
  enabled: boolean;
  endOfDayText: string;
  newDayText: string;
  nextDayStartTime: string;
}

export interface SceneConfig {
  sceneType: "closed" | "open";
  startTime: string;
  tickDurationMinutes: number;
  maxTicks: number | null;
  displayFormat: "modern" | "ancient_chinese" | "fantasy";
  description: string;
  multiDay: MultiDayConfig;
}

export interface WorldSizeConfig {
  width: number;
  height: number;
  tileSize?: number;
  gridWidth?: number;
  gridHeight?: number;
}

/** 区域配置（来自 world.json） */
export interface LocationConfig {
  id: string;
  name: string;
  description: string;
  adjacentLocations: string[];
  objects: ObjectConfig[];
}

export interface MainAreaPointConfig {
  id: string;
  name: string;
  x: number;
  y: number;
  adjacentPointIds: string[];
}

/** 可交互物件配置 */
export interface ObjectConfig {
  id: string;
  name: string;
  locationId: string;
  defaultState: string;
  capacity: number;
  interactions: InteractionConfig[];
  /** 若 true，本物件代表场景中可拾取的具体物品。被拾起后转入角色 inventory，物件状态 → "taken"。 */
  pickupable?: boolean;
  /** 拾起后角色 inventory 中显示的简短描述（pickupable=true 时使用，缺省落回 name） */
  pickupDescription?: string;
}

/** 交互定义 */
export interface InteractionConfig {
  id: string;
  name: string;
  description?: string;
  availableWhenState: string[];
  duration: number;
  effects: Effect[];
  repeatable?: boolean;
  /** When true, this interaction requires dialogue with the anchored character instead of standalone object interaction */
  requiresAnchor?: boolean;
  /** 完成此交互后，将物件 state 切到此值（持久化到 world_object_states.state）。可让物件状态在世界中产生涟漪。 */
  stateChange?: string;
  /** 与 stateChange 同时切换的人类可读说明（用于其它角色感知物件已变化） */
  stateChangeDescription?: string;
}

/** 世界级动作定义 */
export interface WorldActionConfig extends InteractionConfig {}

/** 交互效果 */
export interface Effect {
  type:
    | "world_state"
    | "character_need"
    | "character_memory"
    | "character_emotion";
  target: string;
  value: any;
}

/** 物件运行时状态（存 DB） */
export interface ObjectRuntimeState {
  objectId: string;
  locationId: string;
  state: string;
  stateDescription: string;
  currentUsers: string[];
}

/** 世界全局状态键值对 */
export interface WorldGlobalEntry {
  key: string;
  value: string;
}

/** 世界配置根结构 */
export interface WorldConfig {
  worldName?: string;
  worldDescription?: string;
  worldSocialContext?: string;
  contentLanguage?: "zh" | "en";
  originalPrompt?: string;
  scene?: SceneConfig;
  worldActions?: WorldActionConfig[];
  locations: LocationConfig[];
  mainAreaPoints?: MainAreaPointConfig[];
  worldSize?: WorldSizeConfig;
}
