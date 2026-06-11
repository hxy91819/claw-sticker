export const STICKERS = {
  happy: "stickers/v2/happy.png",
  love: "stickers/v2/love.png",
  confused: "stickers/v2/confused.png",
  sigh: "stickers/v2/sigh.png",
  awkward: "stickers/v2/awkward.png",
  nervous: "stickers/v2/nervous.png",
  cool: "stickers/v2/cool.png",
} as const;

export type StickerName = keyof typeof STICKERS;

export const AUTO_APPEND_STICKERS = new Set<StickerName>([
  "happy",
  "love",
  "confused",
  "sigh",
  "awkward",
]);

export function isStickerName(value: string): value is StickerName {
  return Object.hasOwn(STICKERS, value);
}

export function renderSticker(name: StickerName): string {
  return `MEDIA: ${STICKERS[name]}`;
}

export function stickerNameFromPath(path: string): StickerName | undefined {
  const file = path.split(/[\\/]/).pop() ?? "";
  const name = file.replace(/\.png$/i, "");
  return isStickerName(name) ? name : undefined;
}
