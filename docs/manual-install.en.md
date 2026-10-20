# Manual installation guide (dsh-purge-fork)

This guide is for users who prefer to install the plugin by hand instead of running `dsh plugin install` / `pnpm install`. Every step only touches files on your own machine.

> If you already installed the plugin with the automatic flow, you do not need this guide.

---

## 0. Prerequisites

- The official DeepSeek Harness (desktop app or `dsh web`) is installed.
- An archive tool (File Explorer on Windows, `unzip` on macOS/Linux).
- This guide uses `$DSH_HOME/profiles/desktop` as the example.

### 0.1 Locating the profile directory

The Harness home (`$DSH_HOME`) is resolved in this order:

1. the directory pointed to by the `$DSH_HOME` environment variable;
2. a `.dsh` directory next to the dsh launcher (the `dsh` command or the desktop app);
3. `~/.dsh` in your home directory.

The profile directory is `$DSH_HOME/profiles/<profile name>`:

| Surface | Profile name | Typical path (Windows) |
| --- | --- | --- |
| Desktop app | `desktop` | `C:\Users\<you>\.dsh\profiles\desktop` |
| `dsh web` | `web` | `C:\Users\<you>\.dsh\profiles\web` |

`<PROFILE>` below stands for that directory.

---

## 1. Download

Grab the latest `dsh-purge-fork-<version>.zip` asset from [Releases](https://github.com/P4rfa1t/dsh-purge-fork/releases) and unpack it anywhere, for example `C:\temp\dsh-purge-fork-1.2.1\`.

The unpacked directory should contain:

```
dsh-purge-fork-1.2.1/
├─ bin/dsh-purge-fork.js
├─ lib/
├─ presets/unrestricted.patch.yml
├─ cordis.patch.yml
├─ client.js
└─ package.json
```

---

## 2. Put the files into the profile

Create a `vendor` folder inside the profile and move the unpacked directory there:

```
<PROFILE>/vendor/dsh-purge-fork-1.2.1/
```

Then copy the same files into the profile's `node_modules` under the exact name `dsh-purge-fork` — the host looks the plugin up by that name:

```
<PROFILE>/node_modules/dsh-purge-fork/
```

On Windows: copy, paste, rename. On macOS/Linux:

```sh
mkdir -p "<PROFILE>/vendor" "<PROFILE>/node_modules"
cp -R /path/to/dsh-purge-fork-1.2.1 "<PROFILE>/vendor/"
cp -R /path/to/dsh-purge-fork-1.2.1 "<PROFILE>/node_modules/dsh-purge-fork"
```

> If the profile has no `node_modules` directory yet, just create it.

---

## 3. Register it in the profile manifest

Edit `<PROFILE>/package.json` and make two changes.

**(1) Add a dependency** (leave your existing dependencies untouched):

```json
{
  "dependencies": {
    "dsh-purge-fork": "file:./vendor/dsh-purge-fork-1.2.1"
  }
}
```

The path must match the directory you used in step 2.

**(2) Add `"dsh-purge-fork"` to the `dsh.profile.bundles` array**:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-purge-fork"
      ]
    }
  }
}
```

This step matters: only bundles listed here have their `cordis.patch.yml` and the bundled `presets/unrestricted.patch.yml` loaded as profile-layer patches, which is also what makes the `unrestricted` preset appear in the preset list.

> If `<PROFILE>/package.json` has no `dsh` field yet, create one with a `dsh.profile.bundles` array containing only `["dsh-purge-fork"]`.

---

## 4. Restart and apply

1. **Fully quit** Harness (on desktop, make sure no background process is left).
2. Start Harness again (the desktop app, or `dsh web`).
3. Open the sidebar **Clean** icon → panel → click **Apply**.
   - The panel lists the patches and prompts, and the preset list shows the unrestricted preset.
   - After a successful apply the plugin restarts the host so the rewritten package files are reloaded.
4. Start a new conversation and confirm that the prompt injection takes effect.

---

## 5. Verify

Command line (optional):

```sh
node "<PROFILE>/node_modules/dsh-purge-fork/bin/dsh-purge-fork.js" --status
```

- A healthy run prints the number of applied and pending patches plus the host package path.
- If the desktop run resolves the host path to a temp directory, `DSH_SURFACE` is unset; run it again with `DSH_SURFACE=desktop` to see the real installation tree.

In chat you can also use:

```
/purge status
/purge apply
/purge revert
```

Success signs in the UI:

- the sidebar shows the **Clean** icon and the panel opens;
- the preset list contains the unrestricted preset;
- there is **no floating ball in the bottom-right corner** (that entry point was removed in 1.2.0).

---

## 6. Update

1. Download and unpack the new release zip.
2. Replace `<PROFILE>/node_modules/dsh-purge-fork` with the new directory (rename the old one to `dsh-purge-fork.bak` first if you want a fallback).
3. Update the path/version in `dependencies` inside `<PROFILE>/package.json`.
4. Open the panel and click **Apply** again.

---

## 7. Uninstall

1. Panel → **Uninstall** (same as `--uninstall`: restores the patched host files, then removes the injected prompt and rule sets).
2. Delete `<PROFILE>/node_modules/dsh-purge-fork` and `<PROFILE>/vendor/dsh-purge-fork-*`.
3. Remove `dsh-purge-fork` from `dependencies` and from `dsh.profile.bundles` in `<PROFILE>/package.json`.
4. Restart Harness.

Host files are restored from their `.dshpurge.bak` backups during uninstall. If you deleted the plugin folder before uninstalling, the backups still sit next to the host files and can be restored by hand.

---

## 8. Troubleshooting

**No Clean icon in the sidebar**
Check that `dsh.profile.bundles` contains `dsh-purge-fork` and that `node_modules/dsh-purge-fork/package.json` exists and is valid JSON, then fully restart Harness.

**The panel opens but the unrestricted preset is missing**
The bundle patch was not loaded. Make sure `node_modules/dsh-purge-fork/presets/unrestricted.patch.yml` exists and that the `dsh.bundle.patch` array in `package.json` contains `./presets/unrestricted.patch.yml`.

**Harness fails to start after editing package.json**
Most likely a JSON syntax error (a stray comma). Validate the file with any JSON tool or editor.

**Nothing changes after applying**
The host process cached the old package files: fully quit Harness → apply again → let the host restart → open a new conversation.

**The prompt is not injected**
Check that `$DSH_HOME/prompt-inject.md` is not empty, or pick a rule set in the panel.

---

## 9. File map

| Location | Purpose |
| --- | --- |
| `<PROFILE>/node_modules/dsh-purge-fork/` | the plugin itself |
| `<PROFILE>/node_modules/dsh-purge-fork/cordis.patch.yml` | host patch entry |
| `<PROFILE>/node_modules/dsh-purge-fork/presets/unrestricted.patch.yml` | bundled unrestricted preset |
| `<PROFILE>/package.json` | dependency entry + `dsh.profile.bundles` |
| `$DSH_HOME/dsh-purge/` | runtime state (applied.json, backups, rule index) |
| `$DSH_HOME/prompt-inject.md` | your injected prompt |
| `<file>.dshpurge.bak` next to host files | restore backups |

---

## 10. Credits and license

This project builds on [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) (original author) and [kingcharleslzy-ai/dsh-purge](https://github.com/kingcharleslzy-ai/dsh-purge) (community fork); this repository is published under the MIT license. If you reuse, adapt or redistribute the code or prompts, please credit the source repositories.
