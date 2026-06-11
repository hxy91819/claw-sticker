import { renderSticker, stickerNameFromPath, type StickerName } from "./stickers.js";

export type FormatGuardResult = {
  content: string;
  changed: boolean;
  hasSticker: boolean;
  reasons: string[];
};

type CodeFenceState = {
  inFence: boolean;
};

const STICKER_PATH_PATTERN = String.raw`(?:\/[^\s)]*)?stickers\/[^\s)]*?\.png`;

function isFenceToggle(line: string): boolean {
  return /^\s*(```|~~~)/.test(line);
}

function normalizeStickerPath(rawPath: string): { name: StickerName; mediaLine: string } | undefined {
  const normalized = rawPath.trim().replace(/\\/g, "/");
  const name = stickerNameFromPath(normalized);
  return name ? { name, mediaLine: renderSticker(name) } : undefined;
}

function lineContainsStickerIntent(line: string): boolean {
  return (
    /\[sticker:[a-z0-9_-]+\]/i.test(line) ||
    /(?:^|\s)MEDIA:\s*(?:\/[^\s)]*)?stickers\/[^\s)]*?\.png/i.test(line) ||
    /!\[[^\]]*]\((?:\/[^\s)]*)?stickers\/[^\s)]*?\.png\)/i.test(line) ||
    /^\s*📎\s*(?:\/[^\s)]*)?stickers\/[^\s)]*?\.png/i.test(line)
  );
}

function stripInlineCodeSegments(line: string): string {
  return line.replace(/`[^`]*`/g, "");
}

function fixLine(line: string, state: CodeFenceState): { lines: string[]; changed: boolean; hasSticker: boolean; reasons: string[] } {
  if (isFenceToggle(line)) {
    state.inFence = !state.inFence;
    return { lines: [line], changed: false, hasSticker: false, reasons: [] };
  }
  if (state.inFence || !lineContainsStickerIntent(stripInlineCodeSegments(line))) {
    return { lines: [line], changed: false, hasSticker: false, reasons: [] };
  }

  const stripped = line.trim();
  const reasons: string[] = [];

  const markerMatch = stripped.match(/^\[sticker:([a-z0-9_-]+)\]$/i);
  if (markerMatch) {
    const name = markerMatch[1]?.toLowerCase();
    if (name && stickerNameFromPath(`${name}.png`)) {
      reasons.push("marker");
      return {
        lines: [renderSticker(name as StickerName)],
        changed: true,
        hasSticker: true,
        reasons,
      };
    }
    reasons.push("unknown_marker_removed");
    return { lines: [], changed: true, hasSticker: false, reasons };
  }

  const paperclipMatch = stripped.match(new RegExp(`^📎\\s*(${STICKER_PATH_PATTERN})$`, "i"));
  if (paperclipMatch?.[1]) {
    const normalized = normalizeStickerPath(paperclipMatch[1]);
    if (normalized) {
      reasons.push("paperclip");
      return { lines: [normalized.mediaLine], changed: true, hasSticker: true, reasons };
    }
  }

  const markdownMatch = stripped.match(new RegExp(`^!\\[[^\\]]*\\]\\((${STICKER_PATH_PATTERN})\\)$`, "i"));
  if (markdownMatch?.[1]) {
    const normalized = normalizeStickerPath(markdownMatch[1]);
    if (normalized) {
      reasons.push("markdown");
      return { lines: [normalized.mediaLine], changed: true, hasSticker: true, reasons };
    }
  }

  const inlineMatch = line.match(new RegExp(`^(.*?)\\s*MEDIA:\\s*(${STICKER_PATH_PATTERN})\\s*$`, "i"));
  if (inlineMatch?.[2]) {
    const normalized = normalizeStickerPath(inlineMatch[2]);
    if (normalized) {
      const prefix = inlineMatch[1]?.trim();
      if (prefix) {
        reasons.push("inline_media");
        return {
          lines: [prefix, normalized.mediaLine],
          changed: true,
          hasSticker: true,
          reasons,
        };
      }
      if (line !== normalized.mediaLine) {
        reasons.push(line.startsWith("MEDIA: ") ? "absolute_path" : "leading_space");
        return { lines: [normalized.mediaLine], changed: true, hasSticker: true, reasons };
      }
      return { lines: [line], changed: false, hasSticker: true, reasons };
    }
    reasons.push("unknown_media_removed");
    return { lines: [], changed: true, hasSticker: false, reasons };
  }

  return { lines: [line], changed: false, hasSticker: false, reasons };
}

export function fixStickerFormat(content: string): FormatGuardResult {
  const state: CodeFenceState = { inFence: false };
  const out: string[] = [];
  const reasons: string[] = [];
  let changed = false;
  let hasSticker = false;

  for (const line of content.split("\n")) {
    const result = fixLine(line, state);
    out.push(...result.lines);
    changed ||= result.changed;
    hasSticker ||= result.hasSticker;
    reasons.push(...result.reasons);
  }

  const fixed = out.join("\n");
  return {
    content: changed ? fixed : content,
    changed,
    hasSticker,
    reasons,
  };
}

export function contentHasSticker(content: string): boolean {
  return content.split("\n").some((line) => /^MEDIA:\s*stickers\/[a-z0-9_-]+\.png\s*$/i.test(line.trim()));
}
