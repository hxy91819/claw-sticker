export const STICKERS = {
  happy: "stickers/happy.png",
  love: "stickers/love.png",
  confused: "stickers/confused.png",
  sigh: "stickers/sigh.png",
  awkward: "stickers/awkward.png",
  nervous: "stickers/nervous.png",
  cool: "stickers/cool.png",
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
