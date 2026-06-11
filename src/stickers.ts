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

const STICKER_MEDIA_PATH_RE = /(?:^|\/)stickers\/(?:v2\/)?([a-z0-9_-]+)\.png$/i;

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

function stickerNameFromMediaUrl(mediaUrl: string): StickerName | undefined {
  const normalized = mediaUrl.trim().replace(/\\/g, "/");
  const name = normalized.match(STICKER_MEDIA_PATH_RE)?.[1]?.toLowerCase();
  return name && isStickerName(name) ? name : undefined;
}

export function resolveStickerDeliveryUrl(stickerPath: string, mediaBasePath: string): string {
  const name = stickerNameFromMediaUrl(stickerPath);
  if (!name) {
    return stickerPath;
  }
  const basePath = mediaBasePath.trim().replace(/\/+$/, "");
  return basePath ? `${basePath}/${name}.png` : STICKERS[name];
}

export function resolveHostedStickerMediaUrl(mediaUrl: string, mediaBasePath: string): string | null {
  const name = stickerNameFromMediaUrl(mediaUrl);
  if (!name) {
    return null;
  }
  return resolveStickerDeliveryUrl(STICKERS[name], mediaBasePath);
}
