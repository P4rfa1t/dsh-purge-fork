# 手动安装教程（dsh-purge-fork）

本篇面向不想用 `dsh plugin install` / `pnpm install` 自动流程的用户，用手动步骤把本插件装进本机的 DeepSeek Harness profile。全程只动你自己的本机文件。

> 已经用自动流程装过的用户不需要看本篇。

---

## 0. 前置条件

- 已安装官方 DeepSeek Harness（桌面端 EXE 或 `dsh web`）。
- 一个解压工具（Windows 用资源管理器即可，macOS/Linux 用 `unzip`）。
- 本篇用 `$DSH_HOME/profiles/desktop` 举例。

### 0.1 如何确定 profile 目录

Harness 主目录（`$DSH_HOME`）按以下顺序查找：

1. 环境变量 `$DSH_HOME` 指向的目录；
2. dsh 启动器（`dsh` 命令 / 桌面端）旁边的 `.dsh` 目录；
3. 用户主目录下的 `~/.dsh`。

profile 目录是 `$DSH_HOME/profiles/<profile 名>`：

| 场景 | profile 名 | 典型路径（Windows） |
| --- | --- | --- |
| 桌面端 EXE | `desktop` | `C:\Users\<你>\.dsh\profiles\desktop` |
| `dsh web` | `web` | `C:\Users\<你>\.dsh\profiles\web` |

下面所有命令里的 `<PROFILE>` 就是这个目录。

---

## 1. 下载

到 [Releases](https://github.com/P4rfa1t/dsh-purge-fork/releases) 下载最新资产 `dsh-purge-fork-<版本>.zip`，解压到任意临时目录，例如 `C:\temp\dsh-purge-fork-1.2.1\`。

解压后目录里应该能看到：

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

## 2. 放进 profile 目录

在 profile 目录下建一个 `vendor` 文件夹，把解压出来的 `dsh-purge-fork-<版本>` 整个目录放进去（文件夹名保持原样即可）：

```
<PROFILE>/vendor/dsh-purge-fork-1.2.1/
```

再把同一份文件复制到 profile 的 `node_modules` 下，目录名必须是 `dsh-purge-fork`（宿主按这个名字查找）：

```
<PROFILE>/node_modules/dsh-purge-fork/
```

Windows 资源管理器：复制 → 粘贴 → 重命名。

macOS/Linux：

```sh
mkdir -p "<PROFILE>/vendor" "<PROFILE>/node_modules"
cp -R /path/to/dsh-purge-fork-1.2.1 "<PROFILE>/vendor/"
cp -R /path/to/dsh-purge-fork-1.2.1 "<PROFILE>/node_modules/dsh-purge-fork"
```

> profile 下还没有 `node_modules` 目录时，直接新建即可。

---

## 3. 登记到 profile 的 package.json

编辑 `<PROFILE>/package.json`，做两处改动。

**（1）在 `dependencies` 里加一行**（保持你已有的其他依赖不动）：

```json
{
  "dependencies": {
    "dsh-purge-fork": "file:./vendor/dsh-purge-fork-1.2.1"
  }
}
```

路径要和你第 2 步实际放的目录一致。

**（2）在 `dsh.profile.bundles` 数组里加一项** `"dsh-purge-fork"`：

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

这一步很关键：只有进了 `bundles`，本插件的 `cordis.patch.yml` 与随包的 `presets/unrestricted.patch.yml` 才会被当作 profile 层补丁装进宿主，`unrestricted` 预设也才会出现在预设列表里。

> 如果 `<PROFILE>/package.json` 里还没有 `dsh` 字段，新建一个 `dsh.profile.bundles` 数组、内容只放 `["dsh-purge-fork"]` 也可以。

---

## 4. 重启并应用

1. **完全退出** Harness（桌面端要退到后台进程也结束）。
2. 重新启动 Harness（桌面端 EXE，或 `dsh web`）。
3. 左栏点开「清洗」图标 → 面板 → 点「应用」。
   - 面板应显示补丁与提示词，预设列表里能看到「无限制模式」。
   - 点「应用」后插件会自动重启宿主，以加载被改写的包文件。
4. 新开一轮对话，确认提示词注入生效。

---

## 5. 验证

命令行（可选）：

```sh
node "<PROFILE>/node_modules/dsh-purge-fork/bin/dsh-purge-fork.js" --status
```

- 正常输出应包含已应用补丁数量、待应用补丁数量，以及宿主包路径。
- 桌面端 `--status` 若把宿主路径解析到临时目录，说明没设 `DSH_SURFACE`，用 `DSH_SURFACE=desktop` 再跑一次即可看到真实安装树。

聊天里也可以直接用：

```
/purge status
/purge apply
/purge revert
```

界面侧的成功标志：

- 左栏出现「清洗」图标，点开是完整面板；
- 预设下拉里有「无限制模式」；
- 屏幕**右下角不再有**悬浮球（1.2.0 起已移除该入口）。

---

## 6. 更新

1. 下载新版本 zip 并解压。
2. 用新目录替换 `<PROFILE>/node_modules/dsh-purge-fork`（旧目录可先改名备份为 `dsh-purge-fork.bak`）。
3. 同步改 `<PROFILE>/package.json` 里 `dependencies` 的路径与版本。
4. 回到清洗面板点「应用」。

---

## 7. 卸载

1. 清洗面板 → 「卸载」（等价于 `--uninstall`：先还原补丁，再删注入文件与规则库）。
2. 删除 `<PROFILE>/node_modules/dsh-purge-fork` 与 `<PROFILE>/vendor/dsh-purge-fork-*`。
3. 从 `<PROFILE>/package.json` 的 `dependencies` 与 `dsh.profile.bundles` 中删掉 `dsh-purge-fork`。
4. 重启 Harness。

宿主文件在「卸载」时会被 `.dshpurge.bak` 备份还原；若你删目录前没点卸载，备份仍在宿主文件旁，可手动改回。

---

## 8. 常见问题

**左栏没有「清洗」图标**
检查 `dsh.profile.bundles` 里是否有 `dsh-purge-fork`，以及 `node_modules/dsh-purge-fork/package.json` 是否存在且 JSON 合法；然后完全重启 Harness。

**面板能打开，但预设列表里没有「无限制模式」**
说明 bundle patch 没被加载。确认 `node_modules/dsh-purge-fork/presets/unrestricted.patch.yml` 存在，且 `package.json` 里的 `dsh.bundle.patch` 数组包含 `./presets/unrestricted.patch.yml`。

**改了 package.json 后宿主启动报错**
多半是 JSON 语法错误（例如多了逗号）。用任一 JSON 校验工具或编辑器检查一次。

**补丁应用后行为没变**
宿主进程缓存了旧的包文件：完全退出 Harness → 再「应用」→ 宿主自动重启 → 新开一轮对话。

**提示词没被注入**
确认 `$DSH_HOME/prompt-inject.md` 非空，或在清洗面板里选中一套规则集。

---

## 9. 文件与目录速查

| 位置 | 用途 |
| --- | --- |
| `<PROFILE>/node_modules/dsh-purge-fork/` | 插件本体 |
| `<PROFILE>/node_modules/dsh-purge-fork/cordis.patch.yml` | 宿主补丁入口 |
| `<PROFILE>/node_modules/dsh-purge-fork/presets/unrestricted.patch.yml` | 随包「无限制模式」预设 |
| `<PROFILE>/package.json` | 依赖登记 + `dsh.profile.bundles` |
| `$DSH_HOME/dsh-purge/` | 运行时状态（applied.json、备份、规则库索引） |
| `$DSH_HOME/prompt-inject.md` | 你的注入提示词 |
| 宿主文件旁的 `<文件>.dshpurge.bak` | 还原用备份 |

---

## 10. 致谢与许可

本项目承自 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)（原作者）与 [kingcharleslzy-ai/dsh-purge](https://github.com/kingcharleslzy-ai/dsh-purge)（社区 fork），本仓库以 MIT 发布。引用、改写或再分发本项目的代码与提示词时，请署名并写明来源仓库。
