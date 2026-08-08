# User Emoji Picker

A comprehensive system connecting a Discord Bot and Vencord Plugin, granting you absolute control over custom emojis.

## Features Added in this Update

- **Zip Uploads:** The `/addemoji` command now supports `.zip` uploads. You can upload entire folders of `.png` and `.gif` emojis natively through Discord. If names conflict, the bot automatically resolves them by appending numbers (e.g., `wavey1`, `wavey2`).
- **Emoji Packs Store:** Added a dedicated store interface in the Vencord UI. You can browse, preview, and natively import emoji packs.
- **Improved Hover Effects:** Adjusted CSS logic so that when you hover over an emoji in the picker, the icon scales dynamically with a beautiful nametag overlay without causing any layout jitter.
- **Grayscaled Chatbar Icon:** The picker diamond icon is integrated beautifully into the Discord chatbar with a grayscale effect that colors upon hover.
- **Right-Click Context Menu Actions:** Natively execute "Rename" and "Delete" commands by right-clicking on any emoji inside the custom picker.
- **Direct UI Syncing:** Whenever you send a `/renameemoji` or `/deleteemoji` command, your custom UI is instantly updated without needing to manually resync.
- **Plugin Customization:** You can customize the name of the Emoji Store and provide a custom URL for its background inside your standard Vencord Settings tab!
- **Fixed Animated Renderings:** Enforced proper native Discord URLs to fix broken emoji fallback scenarios.
- **Improved `/elist`:** Redesigned `/elist` to fit significantly more emojis on a single, scroll-less embed with improved readability.

## Setup Instructions

Make sure you run `python bot.py` and reinstall/restart the plugin via Vencord Settings to see all the new features.
