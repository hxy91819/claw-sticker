# Claw Sticker

OpenClaw plugin for conservative, self-contained WeCom sticker delivery.

The primary path is agentic: the assistant may call the `send_sticker` tool to queue one sticker for the current reply. The plugin then runs in `reply_payload_sending`, syncs packaged PNG assets, and resolves the queued sticker into payload `mediaUrls` for WeCom.

Format guard support for `[sticker:name]` and `MEDIA:` remains as a compatibility fallback, not the preferred model-facing interface.

## Behavior

- WeCom only by default: `channels: ["wecom"]`
- Registers `send_sticker` for the assistant to queue `happy`, `love`, `confused`, `sigh`, `awkward`, `nervous`, or `cool`
- Syncs packaged assets from `resources/` into `{workspaceDir}/stickers` unless `assetSync.enabled` is disabled
- Format guard still fixes `📎`, Markdown image syntax, inline `MEDIA:`, leading spaces, absolute sticker paths, and `[sticker:name]`
- Auto append is disabled by default; when enabled it supports:
  - success: `happy` / `love`
  - minor failure: `sigh` / `awkward`
  - uncertainty: `confused`
- serious, long, code-heavy, apology, incident, complaint, legal, medical, HR, and security contexts are blocked

## Local Verification

Run unit tests:

```bash
pnpm test
```

Run typecheck:

```bash
pnpm typecheck
```

Build the plugin runtime:

```bash
pnpm build
```

Smoke test the built tool-to-hook path without starting Gateway:

```bash
node -e "import('./dist/index.js').then(async ({default: entry}) => { let h, f; const api={rootDir:'/tmp/openclaw-state/extensions/claw-sticker',pluginConfig:{},logger:{info(){},warn(){},error(){},debug(){}},registerHostedMediaResolver(){},registerTool(factory){f=factory},on(name,handler){ if(name==='reply_payload_sending') h=handler; }}; entry.register(api); await f({sessionKey:'room',messageChannel:'wecom'}).execute('tool-1',{name:'happy'}); console.log(await h({payload:{text:'已完成。'},channel:'wecom',sessionKey:'room'}, {channelId:'wecom',conversationId:'room'})); })"
```

Expected output contains:

```text
mediaUrls: [ '<resolved OpenClaw state dir>/workspace/stickers/happy.png' ]
```

## OpenClaw Validation

1. Build this package with `pnpm build`.
2. Install or copy the plugin so OpenClaw can load `openclaw.plugin.json` and `dist/index.js`.
3. Enable the plugin:

```json
{
  "plugins": {
    "entries": {
      "claw-sticker": {
        "enabled": true,
        "config": {
          "channels": ["wecom"],
          "mediaBasePath": "{workspaceDir}/stickers",
          "assetSync": { "enabled": true },
          "tool": { "enabled": true },
          "formatGuard": { "enabled": true },
          "autoAppend": { "enabled": false }
        }
      }
    },
    "allow": ["claw-sticker"]
  }
}
```

If your `plugins.allow` is absent or empty, no allowlist change is needed. If it is restrictive, add `claw-sticker`.

4. Restart Gateway or reload plugins according to your OpenClaw runtime.
5. The normal path is tool-driven. The assistant should call:

```json
{
  "name": "happy",
  "reason": "task_success"
}
```

with the `send_sticker` tool when a small sticker fits the final reply.

For manual smoke testing, send this through a WeCom-bound session:

```text
请只回复下面内容，不要解释：

[sticker:happy]
```

Expected outbound content:

```text
搞定了
mediaUrls: ["<resolved OpenClaw state dir>/workspace/stickers/happy.png"]
```

`mediaBasePath` is optional. By default, the plugin resolves `{workspaceDir}` from the active OpenClaw state directory, copies packaged PNG assets from `resources/` into `{workspaceDir}/stickers`, then sends those absolute local files through WeCom.

## Custom Stickers

The tool currently exposes fixed semantic sticker names:

```text
happy, love, confused, sigh, awkward, nervous, cool
```

To customize the images without changing code, keep those file names and replace the PNG files in a directory you control.

Recommended setup:

1. Create a custom sticker directory under the OpenClaw state directory:

```bash
mkdir -p ~/.openclaw/custom-stickers
```

2. Put PNG files with these exact names in that directory:

```text
happy.png
love.png
confused.png
sigh.png
awkward.png
nervous.png
cool.png
```

3. Point the plugin to that directory and disable packaged asset sync:

```json
{
  "plugins": {
    "entries": {
      "claw-sticker": {
        "enabled": true,
        "config": {
          "mediaBasePath": "{stateDir}/custom-stickers",
          "assetSync": { "enabled": false }
        }
      }
    }
  }
}
```

Do not manually edit `{workspaceDir}/stickers` while `assetSync.enabled` is `true`; the plugin may copy packaged assets there again on startup. For WeCom, use normal PNG files, preferably square, transparent, and reasonably small.

Adding new sticker names beyond the seven listed above requires a code change because the tool schema intentionally restricts the model to known names.

For the optional auto-append fallback, explicitly enable it and use a simple completion reply such as:

```text
已完成，测试通过了。
```

Because auto append is probabilistic and cooled down, it may not append every time. To validate decision logic without sending stickers, set:

```json
{
  "autoAppend": {
    "enabled": true,
    "dryRun": true
  }
}
```

Then check Gateway logs for `claw-sticker` dry-run decisions.
