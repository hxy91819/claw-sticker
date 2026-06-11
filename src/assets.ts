import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STICKERS } from "./stickers.js";

type LoggerLike = {
  info(message: string): void;
  warn(message: string): void;
};

const resourcesDir = fileURLToPath(new URL("../resources/", import.meta.url));
const ensurePromises = new Map<string, Promise<void>>();

function expandUserPath(value: string): string {
  const effectiveHome = process.env.OPENCLAW_HOME?.trim() || os.homedir();
  if (value === "~") {
    return effectiveHome;
  }
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(effectiveHome, value.slice(2));
  }
  return value;
}

function isRemoteMediaBasePath(value: string): boolean {
  return /^(?:https?:|data:|file:)/i.test(value);
}

export function resolveStickerAssetTargetDir(mediaBasePath: string): string | undefined {
  const trimmed = mediaBasePath.trim();
  if (!trimmed || isRemoteMediaBasePath(trimmed)) {
    return undefined;
  }
  return path.resolve(expandUserPath(trimmed));
}

function inferStateDirFromPluginRoot(rootDir?: string): string | undefined {
  if (!rootDir) {
    return undefined;
  }
  const resolved = path.resolve(rootDir);
  const parts = resolved.split(path.sep);
  const extensionIndex = parts.lastIndexOf("extensions");
  if (extensionIndex <= 0) {
    return undefined;
  }
  return parts.slice(0, extensionIndex).join(path.sep) || path.sep;
}

export function resolveOpenClawStateDir(rootDir?: string): string {
  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim();
  if (stateDir) {
    return path.resolve(expandUserPath(stateDir));
  }
  const inferred = inferStateDirFromPluginRoot(rootDir);
  if (inferred) {
    return inferred;
  }
  return path.join(expandUserPath("~"), ".openclaw");
}

export function resolveRuntimeMediaBasePath(mediaBasePath: string, options: { rootDir?: string } = {}): string {
  const stateDir = resolveOpenClawStateDir(options.rootDir);
  const pluginDir = options.rootDir ? path.resolve(options.rootDir) : path.dirname(resourcesDir);
  return mediaBasePath
    .replaceAll("{stateDir}", stateDir)
    .replaceAll("{workspaceDir}", path.join(stateDir, "workspace"))
    .replaceAll("{pluginDir}", pluginDir)
    .replaceAll("{resourcesDir}", resourcesDir)
    .trim();
}

async function copyIfMissingOrChanged(source: string, target: string): Promise<boolean> {
  const [sourceStat, targetStat] = await Promise.all([
    fs.stat(source),
    fs.stat(target).catch(() => undefined),
  ]);
  if (targetStat?.isFile() && targetStat.size === sourceStat.size) {
    return false;
  }
  await fs.copyFile(source, target);
  return true;
}

async function syncStickerAssets(mediaBasePath: string, logger: LoggerLike): Promise<void> {
  const targetDir = resolveStickerAssetTargetDir(mediaBasePath);
  if (!targetDir) {
    logger.warn(`[claw-sticker] sticker assets not synced for non-local mediaBasePath: ${mediaBasePath}`);
    return;
  }

  await fs.mkdir(targetDir, { recursive: true });
  let copied = 0;
  for (const stickerPath of Object.values(STICKERS)) {
    const fileName = path.basename(stickerPath);
    const source = path.join(resourcesDir, fileName);
    const target = path.join(targetDir, fileName);
    if (await copyIfMissingOrChanged(source, target)) {
      copied += 1;
    }
  }
  if (copied > 0) {
    logger.info(`[claw-sticker] synced ${copied} sticker assets to ${targetDir}`);
  }
}

export async function ensureStickerAssets(mediaBasePath: string, logger: LoggerLike): Promise<void> {
  const key = mediaBasePath.trim();
  let promise = ensurePromises.get(key);
  if (!promise) {
    promise = syncStickerAssets(key, logger).catch((err: unknown) => {
      ensurePromises.delete(key);
      throw err;
    });
    ensurePromises.set(key, promise);
  }
  await promise;
}
