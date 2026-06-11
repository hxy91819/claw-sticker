# Claw Sticker

OpenClaw plugin for conservative WeCom sticker delivery.

V1 keeps the model focused on normal replies. The plugin runs in `message_sending`, fixes known sticker syntax mistakes, then optionally appends one low-frequency sticker for obvious lightweight signals.

## Behavior

- WeCom only by default: `channels: ["wecom"]`
- Format guard fixes `📎`, Markdown image syntax, inline `MEDIA:`, leading spaces, absolute sticker paths, and `[sticker:name]`
- Auto append supports:
  - success: `happy` / `love`
  - minor failure: `sigh` / `awkward`
  - uncertainty: `confused`
- `cool` and `nervous` are packaged but not auto-triggered
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

Smoke test the built hook without starting Gateway:

```bash
node -e "Math.random=()=>0; import('./dist/index.js').then(async ({default: entry}) => { let h; const api={pluginConfig:{},logger:{info(){},warn(){},error(){},debug(){}},on(name,handler){ if(name==='message_sending') h=handler; }}; entry.register(api); console.log(await h({content:'已完成，测试通过了。',to:'room'}, {channelId:'wecom',conversationId:'room'})); })"
```

Expected output contains:

```text
MEDIA: stickers/v2/happy.png
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
          "formatGuard": { "enabled": true },
          "autoAppend": { "enabled": true }
        }
      }
    },
    "allow": ["claw-sticker"]
  }
}
```

If your `plugins.allow` is absent or empty, no allowlist change is needed. If it is restrictive, add `claw-sticker`.

4. Restart Gateway or reload plugins according to your OpenClaw runtime.
5. Send test replies through a WeCom-bound session:

```text
搞定了 MEDIA: stickers/v2/happy.png
```

Expected outbound content:

```text
搞定了
MEDIA: stickers/v2/happy.png
```

For auto append, use a simple completion reply such as:

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
