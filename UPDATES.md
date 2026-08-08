# 📝 Recent Updates Changelog

### Vencord Plugin Enhancements
- **React Stability:** Completely resolved `React Error 300` and `Error 321` regarding invalid React scopes, separating Webpack bindings cleanly.
- **Packs Market Revamp:** Integrated a brand-new visually striking Pack Marketplace. Browsable tabs, inline hover actions, and install state handlers are now perfectly baked in.
- **Local JSON Support:** Ditched the CSP-blocked remote Github Gist requests. Pack manifests are securely loaded via standard Webpack `require()` logic against a local `packs_index.json`.
- **Plugin Customization:** You can now rename your Store title and replace the background image URL straight from standard Vencord Settings!
- **Dynamic Random Emojis:** You can now roll the dice with the `?` icon. It cycles through your loaded library rapidly and drops a mystery box icon directly into your chatbox natively.
- **Steal Integrations:** Improved context menu actions to safely construct `/stealemoji` draft commands into the Discord textbox without interrupting visual states.

### Bot Enhancements
- **Zip Archive Support:** `/addemoji` will now accept `.zip` files containing emojis. Processed safely in-memory without polluting host file structures.
- **Conflict Resolver:** All emoji imports auto-append numbers sequentially (`name1`, `name2`) preventing database collisions.
- **Streamlined Security:** Cleared out unnecessary Github Token/Gist environment checks since syncing handles itself natively through standard Application Command routing.
- **Pack Installations:** Handled efficiently through `/installpack` or `/uninstallpack`, seamlessly hooking UI actions to backend actions.
