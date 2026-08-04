# Quick Folders

### One-click shortcuts to your recent and pinned folders
Every time I wanted to scan a single folder, I had to click my way down the same five levels of the directory browser. Quick Folders adds two rows of shortcuts right above that browser, so the folders you actually use are always one click away.

### What it does

**Recent folders (up to 20).** Whenever you launch a task on a folder selection, Quick Folders remembers the paths. They show up as shortcuts the next time you open the folder browser, most recent first.

**Pinned favorites (unlimited).** Click the pin on any shortcut and the folder moves to the Favorites row, where it stays for good — it is never pushed out by new entries. Unpinning sends it back to the top of the history.

Both lists are stored server-side in the plugin configuration, so they are shared by every folder dialog, every browser and every device, and they survive a restart.

The shortcuts appear in every selective task dialog: **Scan**, **Auto Tag**, **Generate** and **Clean**. Tasks launched from anywhere in the UI are recorded — and only if the task actually started, so a canceled dialog leaves no trace. A full-library scan sends no paths, so it never pollutes the history either.

### Two ways to use it

- **Add to selection (default)** — clicking a shortcut adds that folder to the dialog's selection. You can stack several shortcuts, mix them with folders picked by hand, and launch the task when you're ready.
- **Run immediately** — clicking a shortcut confirms the dialog and starts the task on that folder right away.

### Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Run task immediately | off | Switches between the two modes above. |
| Number of recent folders | 8 | How many recent folders to keep, up to 20. Favorites are a separate list and are never capped. |
| Show full paths | off | Show the complete path on each shortcut instead of just the folder name. Either way, hovering a shortcut shows the full path. |

There's also a **Clear history** link on the Recent folders row. It leaves your favorites untouched.

### Installation instructions
**Plugin manager (recommanded):**
1. In Stash: :fa-cog: **Settings** → **Plugins** → **Available Plugins** → **Add Source**
2. Paste this as the source URL:
`https://pouki-dlb.github.io/stash-plugins/main/index.yml`
3. Name the source anything; set Local Path to pouki-dlb
4. Expand it, tick Quick Folders, and click Install

Manual installation:
1. Download this [zip archive](https://pouki-dlb.github.io/stash-plugins/main/QuickFolders.zip "zip archive")
2. Extract it to your stash plugin folder
