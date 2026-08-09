# 💎 Selfhosted User Emojis
<p>
    <a href="https://github.com/MORGANlTE/selfhosted-user-emojis-for-free/stargazers">
      <img src="https://img.shields.io/github/stars/MORGANlTE/selfhosted-user-emojis-for-free?style=for-the-badge&color=ffd700" alt="Stars" />
    </a>
    <a href="https://github.com/MORGANlTE/selfhosted-user-emojis-for-free/issues">
      <img src="https://img.shields.io/github/issues/MORGANlTE/selfhosted-user-emojis-for-free?style=for-the-badge&color=ff69b4" alt="Issues" />
    </a>
    <a href="https://github.com/MORGANlTE/selfhosted-user-emojis-for-free/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/MORGANlTE/selfhosted-user-emojis-for-free?style=for-the-badge&color=4caf50" alt="License" />
    </a>
  </p>
  
A self-hosted solution for custom emojis in Discord (for free! No Nitro required). Combines a **Discord.py Backend** & **Vencord Frontend Plugin** to give you free custom emojis globally. <br/><br/>
Note: current Readme file is AI generated. Will fix this in (one of the) next update(s). For now mostly vibe coded due to time constraints.

## Star History

<a href="https://www.star-history.com/?repos=MORGANlTE%2Fselfhosted-user-emojis-for-free&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=MORGANlTE/selfhosted-user-emojis-for-free&type=date&theme=dark&legend=top-left&sealed_token=QfC58ukansZs3JmA15Rns8KSPg05mnfenvpLZqLTbTqPZUh9cd5YH24n3qdwNV7Xgcs9s3eh9aQ-Fsc8StYo8CLoFhh3Nbg0b4-CRnVfrfS5-ckY2X4TbkkRhl0TyBIhIhgD7_zdwM8dCClemjJPjLivIgp978U3fMgbzg6mNroliokanu2J8gqjLwhP" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=MORGANlTE/selfhosted-user-emojis-for-free&type=date&legend=top-left&sealed_token=QfC58ukansZs3JmA15Rns8KSPg05mnfenvpLZqLTbTqPZUh9cd5YH24n3qdwNV7Xgcs9s3eh9aQ-Fsc8StYo8CLoFhh3Nbg0b4-CRnVfrfS5-ckY2X4TbkkRhl0TyBIhIhgD7_zdwM8dCClemjJPjLivIgp978U3fMgbzg6mNroliokanu2J8gqjLwhP" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=MORGANlTE/selfhosted-user-emojis-for-free&type=date&legend=top-left&sealed_token=QfC58ukansZs3JmA15Rns8KSPg05mnfenvpLZqLTbTqPZUh9cd5YH24n3qdwNV7Xgcs9s3eh9aQ-Fsc8StYo8CLoFhh3Nbg0b4-CRnVfrfS5-ckY2X4TbkkRhl0TyBIhIhgD7_zdwM8dCClemjJPjLivIgp978U3fMgbzg6mNroliokanu2J8gqjLwhP" />
 </picture>
</a>

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

---

## 📱 Revenge (Android/Mobile)
The `revenge-plugin` directory contains a mobile port of the UserEmojiPicker using the [Revenge Android Mod](https://github.com/revenge-mod/revenge-bundle-next) architecture. It patches `MessageActions` to intercept and inject your custom emojis seamlessly on the go.

### Installation (Revenge)
1. Ensure your Revenge client has Developer Settings enabled.
2. Build the plugin using the `Revenge Plugin CLI` and deploy `revenge-plugin/index.js` to your device, or manually drop it into your local Revenge plugins directory.
