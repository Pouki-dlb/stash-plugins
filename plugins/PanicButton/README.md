# Panic Button! 2

### Hide everything with one key press
Someone walks into the room. One key, and Stash is gone: the video stops, the screen goes black, and the browser tab looks like an ordinary empty tab. Press the same key again and you're back exactly where you left off.
### What it does

- **Everything playing stops**
- **Fullscreen player closes**, if you were in it.
- **The screen goes opaque.** A plain colour, or an image of your choosing. Clicks don't go through it.
- **The tab changes its name and icon.** By default it reads "New Tab" with a blank icon — nothing to catch the eye in a row of tabs.

### Your key
Backquote — the key left of `1` — is set up for you at install, and works out of the box. On a French PC that's the `²` key in the same spot; on a French Mac, the `< >` key beside the left Shift.

Prefer something else? Tick  `Insert`, `Pause`, `Scroll Lock` or any of `F1` to `F10` in the settings — each one comes with a note telling you what it might clash with in your browser. Tick as many as you like.

If you'd rather have a combination, a free-form field takes anything, for example `ctrl+shift+h`, `shift+p`, `ctrl+g`, but also special keys like `Home` or `End`, etc.

### Settings
|Setting | Default | What it does |
|--- | --- | --- |
|Overlay colour | Black | The colour of the hiding screen. Accept any css color like #FFFFFF, red, rgb(123,123,123), etc | |
|Overlay image URL | blank | Show an image instead of a plain colour — a desktop wallpaper, a blank page screenshot, whatever looks innocuous.  Any URL your browser can load works. Scaled to cover the screen. | |
|Tab title while hidden | New Tab | The text shown in the browser tab while hidden. | |
|Tab icon while hidden | blank | The favicon shown while hidden. Any URL your browser can load works. | |
|Trigger keys | ` (backquote) | The checkbox list described above. | |
|Additional trigger keys |  blank | Free-form field for anything else, including combinations. | |

### Installation instructions
**Plugin manager (recommanded):**
1. In Stash: :fa-cog: **Settings** → **Plugins** → **Available Plugins** → **Add Source**
2. Paste this as the source URL:
`https://pouki-dlb.github.io/stash-plugins/main/index.yml`
3. Name the source anything; set Local Path to pouki-dlb
4. Expand it, tick PanicButton!, and click Install

Manual installation:
1. Download this [zip archive](https://pouki-dlb.github.io/stash-plugins/main/PanicButton.zip "zip archive")
2. Extract it to your stash plugin folder
