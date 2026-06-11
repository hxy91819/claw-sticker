import { renderSticker, type StickerName } from "./stickers.js";

export type AutoAppendConfig = {
  enabled: boolean;
  dryRun: boolean;
  maxTextLength: number;
  cooldownMs: number;
  minAssistantMessagesBetweenStickers: number;
  probabilities: Record<AutoAppendReason, number>;
};

export type AutoAppendReason = "task_success" | "minor_failure" | "uncertain";

export type AutoAppendDecision =
  | { append: true; sticker: StickerName; reason: AutoAppendReason }
  | { append: false; reason: "disabled" | "dry_run" | "blocked" | "no_signal" | "cooldown" | "probability"; sticker?: StickerName; signal?: AutoAppendReason };

export type AutoAppendState = {
  lastStickerAt: number;
  messagesSinceSticker: number;
};

export const DEFAULT_AUTO_APPEND_CONFIG: AutoAppendConfig = {
  enabled: true,
  dryRun: false,
  maxTextLength: 500,
  cooldownMs: 15 * 60 * 1000,
  minAssistantMessagesBetweenStickers: 4,
  probabilities: {
    task_success: 0.25,
    minor_failure: 0.12,
    uncertain: 0.1,
  },
};

const BLOCK_PATTERNS = [
  /```|~~~|^\s{4,}\S/m,
  /\|\s*[-:]{3,}\s*\|/,
  /\b(diff --git|stack trace|traceback|exception|error:|select\s+.+\s+from|insert\s+into)\b/i,
  /事故|故障|报警|宕机|数据丢失|泄露|资损|客户投诉|合规|法律|医疗|隐私|安全漏洞|攻击|诈骗|裁员|绩效|投诉|严重|紧急|不可用|道歉|抱歉|对不起|别发表情|不要发表情|严肃点/,
  /MEDIA:\s*|!\[[^\]]*]\(|\[sticker:/i,
];

const SUCCESS_PATTERNS = [
  /搞定了|完成了|已完成|已经处理好|处理好了|修好了|配置更新好了|构建通过|测试通过|部署成功|可以正常用|问题解决了|已修复/,
  /done|fixed|resolved|passed|success(?:ful)?/i,
];

const MINOR_FAILURE_PATTERNS = [
  /报错了|没通过|翻车了|出错了|卡住了|不太顺|这里失败了|失败了|没成功/,
  /failed|blocked|stuck/i,
];

const UNCERTAIN_PATTERNS = [
  /有点奇怪|不太确定|需要再确认|我再核对|不符合预期|看起来不太一致|再确认一下|再检查一下/,
  /not sure|unclear|unexpected/i,
];

const SUCCESS_NEGATIONS = [/还没完成|没有通过|修复失败|暂时无法完成|无法完成|但还有问题|没有成功/];

function matchesAny(content: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(content));
}

export function isAutoAppendBlocked(content: string, maxTextLength = DEFAULT_AUTO_APPEND_CONFIG.maxTextLength): boolean {
  return content.length > maxTextLength || matchesAny(content, BLOCK_PATTERNS);
}

export function classifyStickerSignal(
  content: string,
  random: () => number = Math.random,
): { sticker: StickerName; reason: AutoAppendReason } | undefined {
  if (matchesAny(content, SUCCESS_PATTERNS) && !matchesAny(content, SUCCESS_NEGATIONS)) {
    return { sticker: random() < 0.65 ? "happy" : "love", reason: "task_success" };
  }
  if (matchesAny(content, MINOR_FAILURE_PATTERNS)) {
    return { sticker: random() < 0.55 ? "sigh" : "awkward", reason: "minor_failure" };
  }
  if (matchesAny(content, UNCERTAIN_PATTERNS)) {
    return { sticker: "confused", reason: "uncertain" };
  }
  return undefined;
}

export function decideAutoAppend(params: {
  content: string;
  config?: Partial<AutoAppendConfig>;
  state: AutoAppendState;
  now?: number;
  random?: () => number;
}): AutoAppendDecision {
  const config: AutoAppendConfig = {
    ...DEFAULT_AUTO_APPEND_CONFIG,
    ...params.config,
    probabilities: {
      ...DEFAULT_AUTO_APPEND_CONFIG.probabilities,
      ...params.config?.probabilities,
    },
  };
  if (!config.enabled) {
    return { append: false, reason: "disabled" };
  }
  if (isAutoAppendBlocked(params.content, config.maxTextLength)) {
    return { append: false, reason: "blocked" };
  }
  const random = params.random ?? Math.random;
  const signal = classifyStickerSignal(params.content, random);
  if (!signal) {
    return { append: false, reason: "no_signal" };
  }
  const now = params.now ?? Date.now();
  if (
    now - params.state.lastStickerAt < config.cooldownMs ||
    params.state.messagesSinceSticker < config.minAssistantMessagesBetweenStickers
  ) {
    return { append: false, reason: "cooldown", sticker: signal.sticker, signal: signal.reason };
  }
  if (random() >= config.probabilities[signal.reason]) {
    return { append: false, reason: "probability", sticker: signal.sticker, signal: signal.reason };
  }
  if (config.dryRun) {
    return { append: false, reason: "dry_run", sticker: signal.sticker, signal: signal.reason };
  }
  return { append: true, sticker: signal.sticker, reason: signal.reason };
}

export function appendSticker(content: string, sticker: StickerName): string {
  return `${content.trimEnd()}\n\n${renderSticker(sticker)}`;
}
