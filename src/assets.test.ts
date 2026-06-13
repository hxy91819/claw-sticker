import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureStickerAssets,
  resolveOpenClawStateDir,
  resolveRuntimeMediaBasePath,
  resolveStickerAssetTargetDir,
} from "./assets.js";

const tempRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function makeTempRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claw-sticker-assets-"));
  tempRoots.push(root);
  return root;
}

describe("sticker assets", () => {
  it("infers state/workspace paths from the managed plugin install root", () => {
    vi.stubEnv("OPENCLAW_STATE_DIR", "");
    expect(resolveOpenClawStateDir("/srv/openclaw/.openclaw/extensions/claw-sticker")).toBe(
      "/srv/openclaw/.openclaw",
    );
    expect(
      resolveRuntimeMediaBasePath("{workspaceDir}/stickers", {
        rootDir: "/srv/openclaw/.openclaw/extensions/claw-sticker",
      }),
    ).toBe("/srv/openclaw/.openclaw/workspace/stickers");
  });

  it("prefers OPENCLAW_STATE_DIR over plugin-root inference", () => {
    vi.stubEnv("OPENCLAW_STATE_DIR", "/custom/openclaw-state");
    expect(
      resolveRuntimeMediaBasePath("{workspaceDir}/stickers", {
        rootDir: "/srv/openclaw/.openclaw/extensions/claw-sticker",
      }),
    ).toBe("/custom/openclaw-state/workspace/stickers");
  });

  it("copies packaged PNG assets to the resolved media directory", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "workspace", "stickers");
    const logger = { info: vi.fn(), warn: vi.fn() };

    await ensureStickerAssets(targetDir, logger);

    await expect(fs.stat(path.join(targetDir, "happy.png"))).resolves.toMatchObject({
      size: 29501,
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(`[claw-sticker] synced`),
    );
  });

  it("does not try to copy assets for remote media base paths", () => {
    expect(resolveStickerAssetTargetDir("https://example.com/stickers")).toBeUndefined();
  });
});
