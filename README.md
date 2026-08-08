# 💎 Selfhosted User Emojis

An ultimate self-hosted solution for custom emojis in Discord, combining a **Discord.py Backend** and a **Vencord Frontend Plugin** to give you limitless, free, native-feeling custom emojis globally.

> **GitHub Repository:** [https://github.com/MORGANITE/selfhosted-user-emojis-for-free](https://github.com/MORGANITE/selfhosted-user-emojis-for-free)

---

## ✨ Features
- **Native Custom Emoji Store**: Browse, search, and insert your custom emojis natively from your Discord chat bar via an official Vencord Plugin interface.
- **Emoji Packs Market**: Browse community emoji packs natively inside your client. Click "Install" to seamlessly import them to your bot via a fully automated pipeline.
- **Bulk Zip Uploads**: Got hundreds of emojis? Just upload a `.zip` file into the `/addemoji` command and the bot will cleanly parse and install them to your database, automatically preventing naming conflicts!
- **Edit Support & Chat Sync**: Emojis are perfectly re-hydrated back into visual icons when you edit a message.
- **Right-Click Steal**: Find an emoji you like in chat? Right-click it and hit "Steal Emoji" to directly copy it to your custom inventory.

---

## 🚀 1-Click Installation Guide

### 1. Set Up Your Discord Bot
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. Give it the exact same Name and Avatar as your actual Discord account.
3. Under **Installation**, make sure **User Install** is checked. Uncheck **Guild Install**.
4. Go to **Bot**, reset the token, and copy it.

### 2. Configure the Backend
1. Clone this repository to your local machine or server.
2. Run `pip install -r requirements.txt` (or install `discord.py` and `python-dotenv`).
3. Rename `.default.env` to `.env`.
4. Open the `.env` file:
   - Paste your Bot Token next to `TOKEN=`
   - Paste your Application ID next to `APP_ID=`
   - Paste your Discord User ID next to `OWNER_IDs=`
5. Start the bot! Run `python bot.py` and your backend is online.

### 3. Install the Vencord Plugin
1. Open your Vencord installation directory.
2. Locate the `src/userplugins/` folder.
3. Copy the entire `vencord_plugin` folder from this repository into `src/userplugins/UserEmojiPicker`.
4. Run `pnpm build` on Vencord.
5. Restart Discord! You will now see the beautiful 💎 icon sitting next to your GIF and Sticker buttons in the chat bar.

---

## 📜 License & Usage
This software is provided free of charge to use and modify. Please ensure you do not violate Discord's Terms of Service or moral guidelines while using this system.
