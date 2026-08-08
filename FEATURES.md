# 💡 Customization & Extra Features

Want to take this bot even further? Here's an overview of ways you can customize the UserEmojiPicker ecosystem.

## How to Customize Packs

If you want to create your own packs to share with your friends or load up inside your Vencord Plugin marketplace:

1. Look inside the `helpers/` folder and find `pack_maker.py`.
2. Run this python script. It will interactively ask you to name your pack and paste native emoji strings into your terminal.
3. Once done, it will compile a JSON array.
4. Add the JSON structure into your `vencord_plugin/packs_index.json` array!
5. **Pro-tip:** Use `iconUrl` in the JSON to link a custom image banner to display for that pack in the store UI. (You can paste a Discord CDN `<a:emoji:id>` directly into the `icon` variable!)

## Plugin Customization
You can tweak the Plugin interface easily!
Open Discord Settings -> Vencord Plugins -> search "UserEmojiPicker" -> Click the Gear icon.
- Swap out `storeName` to rename the modal!
- Swap out `storeBackground` with a custom direct image URL to personalize your aesthetic.

## Recommended Media for Repository Documentation
When updating your public GitHub repository, we highly recommend adding the following images/GIFs inside your `/images` folder to show off the project:

- [ ] **M Store UI:** A screenshot showing the new custom emoji store popup overlay.
- [ ] **Pack Market:** A screenshot demonstrating the new UI store and grid components for community packs.
- [ ] **Chat Autocomplete:** A GIF demonstrating the seamless translation from `:emoji:` typing to `<a:name:id>` inline formatting while editing or typing.
- [ ] **Random Emoji:** A quick GIF highlighting the new flashing cycle animation on the `?` icon inside the store tab.
