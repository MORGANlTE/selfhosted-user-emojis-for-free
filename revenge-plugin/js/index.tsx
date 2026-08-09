import React from "react";
import { AppRegistry, View, TouchableOpacity, Text } from "react-native";
import { CustomEmojiStoreModal } from "./emojiStore";
/**
 * Main entry point for the Revenge Plugin.
 * Initializes the plugin, overrides Discord message dispatching logic to inject custom emojis,
 * and loads the locally bundled emoji cache natively.
 */
import { plugin } from "@revenge-mod/plugins";
import { instead, after } from "@revenge-mod/patcher";
import { getModules } from "@revenge-mod/modules/finders";
import type { Metro } from "@revenge-mod/modules/types";
import localEmojisCache from "../emojis.json";

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
export const pluginStore = {
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


let unpatchRoot: (() => void) | null = null;
let RootAppWrapper: any = null;

// Global event emitter to open the modal
export const EventBus = {
  listeners: [] as Function[],
  subscribe(fn: Function) { this.listeners.push(fn); },
  unsubscribe(fn: Function) { this.listeners = this.listeners.filter(l => l !== fn); },
  emit() { this.listeners.forEach(fn => fn()); }
};

const EmojiStoreRoot = () => {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const toggle = () => setVisible(v => !v);
    EventBus.subscribe(toggle);
    return () => EventBus.unsubscribe(toggle);
  }, []);

  return <CustomEmojiStoreModal visible={visible} onClose={() => setVisible(false)} pluginStore={pluginStore} />;
};

const patchRootComponent = () => {
  const OriginalApp = AppRegistry.registerComponent;
  unpatchRoot = instead(AppRegistry, "registerComponent", (args, orig) => {
    const [appKey, componentProvider] = args;
    if (appKey === "Discord") {
      const OriginalRoot = componentProvider();
      const Wrapped = (props: any) => {
        return (
          <>
            <OriginalRoot {...props} />
            {/* Floating Action Button */}
            <React.Fragment>
              <View style={{position: 'absolute', bottom: 100, right: 20, zIndex: 9999}}>
                <TouchableOpacity
                  onPress={() => EventBus.emit()}
                  style={{backgroundColor: '#5865F2', padding: 15, borderRadius: 50, alignItems: 'center', justifyContent: 'center'}}>
                  <Text style={{fontSize: 24, color: 'white', fontWeight: 'bold'}}>💎</Text>
                </TouchableOpacity>
              </View>
            </React.Fragment>
            <EmojiStoreRoot />
          </>
        );
      };
      return orig(appKey, () => Wrapped);
    }
    return orig(...args);
  });
};


export default plugin({
    name: "UserEmojiPicker-Revenge",
    description: "Injects emojis natively and handles stealing safely for Revenge Mobile.",
    authors: [{ name: "_morganite", id: "405067444764540928" }],

    start() {
        console.log("[UserEmojiPicker] Revenge plugin started");
        patchRootComponent();

        // Use require to fetch from a JSON file that users can update themselves
        try {
            const localCache = localEmojisCache;
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

        // --- CHAT INPUT INJECTION ---
        // We inject a Floating Action Button globally to open the modal instead since ChatInput is highly obfuscated in RN.

        // Find the module responsible for dispatching messages.
        // We use string.replace with a replacer function instead of a while loop. This is more efficient and handles multiple identical emojis properly.
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
                        message.content = message.content.replace(nativeRegex, (match, emojiName) => {
                                return pluginStore.loadedEmojis.has(emojiName) ? `;${emojiName};` : match;
                            });
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
                            message.content = message.content.replace(nativeRegex, (match, emojiName) => {
                                return pluginStore.loadedEmojis.has(emojiName) ? `;${emojiName};` : match;
                            });
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
                        args[2] = content.replace(emojiRegex, (match, emojiName) => {
                            const emojiObj = pluginStore.loadedEmojis.get(emojiName);
                            return emojiObj ? `<${emojiObj.animated ? "a" : ""}:${emojiObj.name}:${emojiObj.id}>` : match;
                        });
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
        if (unpatchRoot) unpatchRoot();
    },
});
