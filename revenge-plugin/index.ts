/**
 * Main entry point for the Revenge Plugin.
 * Initializes the plugin, overrides Discord message dispatching logic to inject custom emojis,
 * and loads the locally bundled emoji cache natively.
 */
import { plugin } from "@revenge-mod/plugins";
import { instead } from "@revenge-mod/patcher";
import { getModules } from "@revenge-mod/modules/finders";
import type { Metro } from "@revenge-mod/modules/types";

// Basic types to mock the plugin structure internally based on Revenge types
type PluginConfig = { start: () => void; stop: () => void; [key: string]: any };

let unpatchSendMessage: (() => void) | null = null;
let unpatchEditMessage: (() => void) | null = null;
let unpatchStartEditMessage: (() => void) | null = null;
let unpatchGetCustomEmojiById: (() => void) | null = null;
let unpatchGetEmojis: (() => void) | null = null;
let unpatchIsEmojiUsable: (() => void) | null = null;

export interface AppEmoji {
    id: string;
    name: string;
    animated: boolean;
}

/**
 * Global reactive store for the plugin.
 * Holds the cached custom emojis loaded from the bundled JSON.
 */
const pluginStore = {
    loadedEmojis: new Map<string, AppEmoji>(),
    customEmojiObjectsById: new Map<string, any>(),

    buildEmojiObj(emoji: AppEmoji) {
        const ext = emoji.animated ? "gif" : "png";
        return {
            id: emoji.id,
            name: emoji.name,
            originalName: emoji.name,
            animated: emoji.animated,
            allNamesString: `:${emoji.name}:`,
            url: `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=96&quality=lossless`,
            type: 3,
            available: true,
            managed: false,
            require_colons: true,
            roles: [],
            guildId: "UserAppEmojis",
        };
    },

    /**
     * Loads the emojis into the local Map for quick lookups.
     */
    hydrateEmojis(payload: AppEmoji[]) {
        for (const e of payload) {
            this.loadedEmojis.set(e.name, e);
            this.customEmojiObjectsById.set(e.id, this.buildEmojiObj(e));
        }
    }
};

export default plugin({
    name: "UserEmojiPicker-Revenge",
    description: "Injects emojis natively and handles stealing safely for Revenge Mobile.",
    authors: [{ name: "_morganite", id: "405067444764540928" }],

    start() {
        console.log("[UserEmojiPicker] Revenge plugin started");

        // Use require to fetch from a JSON file that users can update themselves
        try {
            const localCache = require("./emojis.json");
            pluginStore.hydrateEmojis(Array.isArray(localCache) ? localCache : []);
        } catch (err) {
            console.warn("Failed to load local emojis.json. Make sure you synced your emojis first!");
        }

        // --- NATIVE AUTOCOMPLETE ---
        // Find EmojiStore to patch autocomplete and custom emoji handling
        const emojiStores = getModules((m: any) => m?.searchWithoutFetchingLatest && m?.getCustomEmojiById);
        if (emojiStores.length > 0) {
            const EmojiStore = emojiStores[0];
            unpatchGetCustomEmojiById = instead(EmojiStore, "getCustomEmojiById", (args: any[], orig: any) => {
                const [id] = args;
                if (pluginStore.customEmojiObjectsById.has(id))
                    return pluginStore.customEmojiObjectsById.get(id);
                return orig(...args);
            });

            unpatchGetEmojis = instead(EmojiStore, "getEmojis", (args: any[], orig: any) => {
                const result = orig(...args);
                if (result && pluginStore.customEmojiObjectsById.size > 0) {
                    const clonedResult = [...result];
                    for (const emoji of pluginStore.customEmojiObjectsById.values()) {
                        if (!clonedResult.find(e => e.id === emoji.id)) {
                             clonedResult.push(emoji);
                        }
                    }
                    return clonedResult;
                }
                return result;
            });

            if (EmojiStore.isEmojiUsable) {
                unpatchIsEmojiUsable = instead(EmojiStore, "isEmojiUsable", (args: any[], orig: any) => {
                    const [emoji] = args;
                    if (emoji && pluginStore.customEmojiObjectsById.has(emoji.id)) return true;
                    return orig(...args);
                });
            }
        }

        // Find the module responsible for dispatching messages.
        const messageActionsModules = getModules((m: any) => typeof m?.sendMessage === "function");
        if (messageActionsModules.length > 0) {
            const MessageActions = messageActionsModules[0];

            // --- MESSAGE DISPATCH INTERCEPTOR ---
            // We intercept `sendMessage` right before it reaches Discord servers.
            // When we use custom emojis in the UI, they get inserted into the chatbox as native tags `<:name:id>`.
            // Sending native tags without Nitro causes Discord API to reject the message (400 Bad Request).
            // So we intercept and convert native emoji tags back to the text placeholders our bot understands (like `;emoji_name;`).
            unpatchSendMessage = instead(
                MessageActions,
                "sendMessage",
                (args: any[], orig: any) => {
                    const [channelId, message] = args;

                    if (message && message.content && pluginStore.loadedEmojis.size > 0) {
                        const nativeRegex = /<a?:([A-Za-z0-9_]+):(\d+)>/g;
                        let newContent = message.content;
                        let match;

                        while ((match = nativeRegex.exec(message.content)) !== null) {
                            const emojiName = match[1];
                            if (pluginStore.loadedEmojis.has(emojiName)) {
                                newContent = newContent.replace(match[0], `;${emojiName};`);
                            }
                        }
                        message.content = newContent;
                    }

                    return orig(...args);
                }
            );

            // Same for editMessage
            if (MessageActions.editMessage) {
                unpatchEditMessage = instead(
                    MessageActions,
                    "editMessage",
                    (args: any[], orig: any) => {
                        const [channelId, messageId, message] = args;

                        if (message && message.content && pluginStore.loadedEmojis.size > 0) {
                            const nativeRegex = /<a?:([A-Za-z0-9_]+):(\d+)>/g;
                            let newContent = message.content;
                            let match;

                            while ((match = nativeRegex.exec(message.content)) !== null) {
                                const emojiName = match[1];
                                if (pluginStore.loadedEmojis.has(emojiName)) {
                                    newContent = newContent.replace(match[0], `;${emojiName};`);
                                }
                            }
                            message.content = newContent;
                        }

                        return orig(...args);
                    }
                );
            }

            // Intercept startEditMessage to convert bot placeholders (like `;emoji_name;`) back into visual emoji tags (`<:name:id>`)
            // so they render natively in the UI when the user is editing a message.
            unpatchStartEditMessage = instead(
                MessageActions,
                "startEditMessage",
                (args: any[], orig: any) => {
                    const [channelId, messageId, content] = args;

                    if (content && pluginStore.loadedEmojis.size > 0) {
                        const emojiRegex = /;([A-Za-z0-9_]+);/g;
                        let newContent = content;
                        let match;

                        while ((match = emojiRegex.exec(content)) !== null) {
                            const emojiName = match[1];
                            const emojiObj = pluginStore.loadedEmojis.get(emojiName);
                            if (emojiObj) {
                                const tag = `<${emojiObj.animated ? "a" : ""}:${emojiObj.name}:${emojiObj.id}>`;
                                newContent = newContent.replace(match[0], tag);
                            }
                        }
                        args[2] = newContent;
                    }

                    return orig(...args);
                }
            );
        }
    },

    stop() {
        console.log("[UserEmojiPicker] Revenge plugin stopped");
        if (unpatchSendMessage) unpatchSendMessage();
        if (unpatchStartEditMessage) unpatchStartEditMessage();
        if (unpatchEditMessage) unpatchEditMessage();
        if (unpatchGetCustomEmojiById) unpatchGetCustomEmojiById();
        if (unpatchGetEmojis) unpatchGetEmojis();
        if (unpatchIsEmojiUsable) unpatchIsEmojiUsable();
    },
});
