import React from "react";
import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { Popout, useRef, useState } from "@webpack/common";
import { CustomEmojiStorePopout } from "./emojiStore";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findStore } from "@webpack";
import {
    AuthenticationStore,
    GuildStore,
    MessageActions,
    RestAPI,
    SelectedGuildStore,
    SnowflakeUtils
} from "@webpack/common";
import {
    createExpressionPickerPatch,
    createMessageContextPatch,
} from "./contextMenu";

import type {
    AppEmoji,
    CommandMeta,
    CommandName,
    DiscoveredApp,
    PluginCache,
} from "./types";

const CACHE_KEY = "userEmojiPicker.cache.v10";
const USER_PICKER_CATEGORY = "User App Emojis";

const REQUIRED_COMMANDS: CommandName[] = [
    "e",
    "ed",
    "esync",
    "deleteemoji",
    "stealemoji",
];

const settings = definePluginSettings({
    selectedAppId: {
        type: OptionType.STRING,
        description: "Selected installed user app ID (auto-discovered)",
        default: "",
    },
});

let EmojiStore: any = null;
let ReplyStore: any = null;
let PendingReplyActions: any = null;

const patcherManager = {
    patches: [] as any[],

    instead(
        obj: any,
        prop: string,
        replacement: (args: any[], orig: any, thisObj: any) => any,
    ) {
        if (!obj || typeof obj[prop] !== "function") return;
        const orig = obj[prop];
        const newFunc = function (this: any, ...args: any[]) {
            return replacement(args, orig, this);
        };
        const desc = Object.getOwnPropertyDescriptor(obj, prop);

        try {
            obj[prop] = newFunc;
            if (obj[prop] !== newFunc) throw new Error("Assignment failed.");
            this.patches.push({ obj, prop, type: "assign", orig });
        } catch (e1) {
            if (desc) {
                try {
                    Object.defineProperty(obj, prop, {
                        value: newFunc,
                        configurable: true,
                        writable: true,
                    });
                    this.patches.push({ obj, prop, type: "define", desc });
                } catch (e2) {}
            }
        }
    },

    unpatchAll() {
        for (const p of this.patches) {
            try {
                if (p.type === "assign") p.obj[p.prop] = p.orig;
                else if (p.type === "define" && p.desc)
                    Object.defineProperty(p.obj, p.prop, p.desc);
            } catch (e) {}
        }
        this.patches = [];
    },
};

const storage = {
    get(): PluginCache | null {
        try {
            const ls =
                (globalThis as any)?.window?.localStorage ??
                (globalThis as any)?.localStorage;
            if (!ls?.getItem) return null;
            const raw = ls.getItem(CACHE_KEY);
            return raw ? (JSON.parse(raw) as PluginCache) : null;
        } catch {
            return null;
        }
    },
    set(value: PluginCache) {
        try {
            const ls =
                (globalThis as any)?.window?.localStorage ??
                (globalThis as any)?.localStorage;
            if (ls?.setItem) ls.setItem(CACHE_KEY, JSON.stringify(value));
        } catch (err) {}
    },
};

const pluginStore = {
    loadedEmojis: new Map<string, AppEmoji>(),
    customEmojiObjectsById: new Map<string, any>(),
    apps: [] as DiscoveredApp[],
    selectedAppId: "",
    isSyncing: false,

    get cache(): PluginCache {
        return {
            selectedAppId: this.selectedAppId,
            apps: this.apps,
            emojis: Array.from(this.loadedEmojis.values()),
            updatedAt: Date.now(),
        };
    },

    saveCache() {
        storage.set(this.cache);
    },

    loadCache() {
        try {
            const parsed = storage.get();
            if (!parsed) return;
            this.apps = Array.isArray(parsed.apps) ? parsed.apps : [];
            this.selectedAppId =
                parsed.selectedAppId || settings.store.selectedAppId || "";
            this.hydrateEmojis(
                Array.isArray(parsed.emojis) ? parsed.emojis : [],
            );
        } catch (err) {}
    },

    buildEmojiObj(emoji: AppEmoji) {
        const ext = emoji.animated ? "gif" : "png";
        return {
            id: emoji.id,
            name: emoji.name,
            originalName: emoji.name,
            animated: emoji.animated,
            available: true,
            managed: false,
            require_colons: true,
            roles: [],
            url: `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=48&quality=lossless`,
            allNamesString: `:${emoji.name}:`,
            type: 3,
            category: USER_PICKER_CATEGORY,
            categoryName: USER_PICKER_CATEGORY,
            source: "discord",
            score: 2147483647,
            isLocked: false,
            locked: false,
            disabled: false,
            guildId: "UserAppEmojis",
        };
    },

    hydrateEmojis(items: AppEmoji[]) {
        this.loadedEmojis.clear();
        this.customEmojiObjectsById.clear();
        for (const emoji of items) {
            this.loadedEmojis.set(emoji.name.toLowerCase(), emoji);
            this.customEmojiObjectsById.set(
                emoji.id,
                this.buildEmojiObj(emoji),
            );
        }
    },

    async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("timeout")), ms);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    },

    async delay(ms: number) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    },

    async discoverInstalledApps() {
        const data = await this.withTimeout(
            RestAPI.get({ url: "/users/@me/application-command-index" }),
            10_000,
        );
        const body = (data as any)?.body ?? data;
        const commands = Array.isArray(body?.application_commands)
            ? body.application_commands
            : [];
        if (!commands.length) throw new Error("application_commands empty");

        const appMap = new Map<string, DiscoveredApp>();

        for (const cmd of commands) {
            const appId = String(cmd?.application_id ?? "");
            if (!appId) continue;
            const appName = String(cmd?.application?.name ?? `App ${appId}`);
            const name = String(cmd?.name ?? "")
                .replace(/^\//, "")
                .toLowerCase();
            const id = String(cmd?.id ?? "");
            const version = String(cmd?.version ?? "");

            const app =
                appMap.get(appId) ??
                ({ appId, appName, commands: {} } as DiscoveredApp);

            if (
                REQUIRED_COMMANDS.includes(name as CommandName) &&
                id &&
                version
            ) {
                app.commands[name as CommandName] = {
                    id,
                    version,
                    name: name as CommandName,
                };
            }
            appMap.set(appId, app);
        }

        this.apps = Array.from(appMap.values()).filter((app) =>
            REQUIRED_COMMANDS.every((required) =>
                Boolean(app.commands[required]),
            ),
        );

        if (!this.apps.length)
            throw new Error("No installed app found with required commands");

        if (
            !this.selectedAppId ||
            !this.apps.some((a) => a.appId === this.selectedAppId)
        ) {
            this.selectedAppId = this.apps[0].appId;
            settings.store.selectedAppId = this.selectedAppId;
        }
    },

    getSelectedApp(): DiscoveredApp | undefined {
        return this.apps.find((a) => a.appId === this.selectedAppId);
    },
    getCommand(name: CommandName): CommandMeta | undefined {
        return this.getSelectedApp()?.commands[name];
    },

    async ensureDmChannelForApp(appId: string): Promise<string> {
        const resp = await this.withTimeout(
            RestAPI.post({
                url: "/users/@me/channels",
                body: { recipients: [appId] },
            }),
            10_000,
        );
        const body = (resp as any)?.body ?? resp;
        const channelId = String(body?.id ?? "");
        if (!channelId) throw new Error("Could not resolve DM channel");
        return channelId;
    },

    async dispatchInteraction(input: {
        appId: string;
        command: CommandMeta;
        channelId: string;
        guildId?: string;
        options?: any[];
    }) {
        const { appId, command, channelId, guildId, options = [] } = input;
        return RestAPI.post({
            url: "/interactions",
            body: {
                type: 2,
                application_id: appId,
                guild_id: guildId,
                channel_id: channelId,
                session_id: AuthenticationStore.getSessionId(),
                data: {
                    id: command.id,
                    version: command.version,
                    name: command.name,
                    type: 1,
                    options,
                },
                nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                analytics_location: "slash_ui",
                attachments: [],
            },
        });
    },

    async waitForEsyncAttachmentUrl(
        channelId: string,
        appId: string,
        timeoutMs = 20_000,
    ): Promise<{ url: string; messageId: string }> {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const res = await RestAPI.get({
                url: `/channels/${channelId}/messages?limit=25`,
            });
            const messages = ((res as any)?.body ?? res) as any[];
            if (Array.isArray(messages)) {
                for (const msg of messages) {
                    if (String(msg?.author?.id ?? "") !== appId) continue;
                    const atts = Array.isArray(msg?.attachments)
                        ? msg.attachments
                        : [];
                    const file = atts.find(
                        (a: any) =>
                            String(a?.filename ?? "").toLowerCase() ===
                            "emojis.json",
                    );
                    if (file?.url || file?.proxy_url)
                        return {
                            url: String(file.url ?? file.proxy_url),
                            messageId: String(msg.id ?? ""),
                        };
                }
            }
            await this.delay(700);
        }
        throw new Error("Timed out waiting for /esync emojis.json");
    },

    async fetchJsonWithRetry(
        url: string,
        timeoutMs = 12_000,
    ): Promise<AppEmoji[]> {
        const start = Date.now();
        let lastErr: any = null;
        while (Date.now() - start < timeoutMs) {
            try {
                const res = await this.withTimeout(fetch(url), 8_000);
                if (!res.ok) {
                    lastErr = new Error(`HTTP ${res.status}`);
                    await this.delay(500);
                    continue;
                }
                const text = await res.text();
                return JSON.parse(text) as AppEmoji[];
            } catch (err) {
                lastErr = err;
                await this.delay(500);
            }
        }
        throw lastErr ?? new Error("Failed to fetch emojis.json");
    },

    async deleteSyncMessage(channelId: string, messageId: string) {
        if (!messageId) return;
        try {
            await RestAPI.del({
                url: `/channels/${channelId}/messages/${messageId}`,
            });
        } catch {}
    },

    async connectAndSync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        try {
            await this.discoverInstalledApps();
            const app = this.getSelectedApp();
            if (!app) throw new Error("No selected app");
            const esync = app.commands.esync;
            if (!esync) throw new Error("Missing /esync metadata");

            const dmChannelId = await this.ensureDmChannelForApp(app.appId);
            await this.withTimeout(
                this.dispatchInteraction({
                    appId: app.appId,
                    command: esync,
                    channelId: dmChannelId,
                }),
                10_000,
            );

            const attachment = await this.waitForEsyncAttachmentUrl(
                dmChannelId,
                app.appId,
                20_000,
            );
            const payload = await this.fetchJsonWithRetry(
                attachment.url,
                12_000,
            );

            this.hydrateEmojis(payload);
            this.saveCache();
            await this.deleteSyncMessage(dmChannelId, attachment.messageId);
        } catch (err) {
        } finally {
            this.isSyncing = false;
        }
    },
};

function silentlyFindPendingReplyActions() {
    try {
        const wp = (window as any).webpackChunkdiscord_app;
        if (!wp) return null;
        const req = wp.push([[Symbol()], {}, (e: any) => e]);
        for (const key in req.c) {
            const mod = req.c[key]?.exports;
            if (
                mod &&
                (typeof mod.clearPendingReply === "function" ||
                    typeof mod.deletePendingReply === "function")
            )
                return mod;
            if (
                mod?.default &&
                (typeof mod.default.clearPendingReply === "function" ||
                    typeof mod.default.deletePendingReply === "function")
            )
                return mod.default;
        }
    } catch (e) {}
    return null;
}

const emojiRegex =
    /<a?:([A-Za-z0-9_]+):(\d+)>|:([A-Za-z0-9_]+):|;([A-Za-z0-9_]+);/g;

const CustomEmojiStoreIcon = ({ isHovered }: { isHovered?: boolean }) => (
    <div
        style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            lineHeight: "22px",
            height: "100%",
            filter: isHovered ? "grayscale(0%)" : "grayscale(100%)",
            transition: "filter 0.2s ease"
        }}
    >
        💎
    </div>
);

function CustomEmojiStoreButtonWrapper(props: any) {
    const buttonRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Popout
            shouldShow={isOpen}
            position="top"
            align="right"
            onRequestClose={() => setIsOpen(false)}
            targetElementRef={buttonRef}
            renderPopout={({ closePopout }) => (
                <CustomEmojiStorePopout onClose={() => {
                    closePopout();
                    setIsOpen(false);
                }} pluginStore={pluginStore} />
            )}
        >
            {popoutProps => (
                <div
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <ChatBarButton
                        tooltip="Open Custom Emoji Store"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }}
                        {...popoutProps}
                    >
                        <CustomEmojiStoreIcon isHovered={isHovered} />
                    </ChatBarButton>
                </div>
            )}
        </Popout>
    );
}

const CustomEmojiStoreButton: ChatBarButtonFactory = ({ isAnyChat }) => {
    if (!isAnyChat) return null;
    return <CustomEmojiStoreButtonWrapper />;
};

export default definePlugin({
    name: "UserEmojiPicker",
    description:
        "Injects emojis natively, provides a custom Emoji Store button in the chat bar, and handles stealing safely.",
    authors: [{ name: "_morganite", id: 405067444764540928n }],
    settings,

    chatBarButton: {
        icon: CustomEmojiStoreIcon,
        render: CustomEmojiStoreButton
    },

    contextMenus: {
        "expression-picker": createExpressionPickerPatch(() => ({
            selectedApp: pluginStore.getSelectedApp(),
        })),
        message: createMessageContextPatch(() => ({
            selectedApp: pluginStore.getSelectedApp(),
        })),
    },

    async start() {
        EmojiStore = findStore("EmojiStore");
        patcherManager.instead(
            GuildStore,
            "getGuild",
            (args, orig, thisObj) => {
                const [id] = args;
                if (id === "UserAppEmojis") {
                    return { id: "UserAppEmojis", name: "User App Plugin", getIconURL: () => null };
                }
                return orig.apply(thisObj, args);
            }
        );

        ReplyStore = findStore("PendingReplyStore");
        PendingReplyActions = silentlyFindPendingReplyActions();

        pluginStore.selectedAppId = settings.store.selectedAppId || "";
        pluginStore.loadCache();
        pluginStore.connectAndSync().catch(() => void 0);

        // --- NATIVE AUTOCOMPLETE ---
        patcherManager.instead(
            EmojiStore,
            "searchWithoutFetchingLatest",
            (args, orig, thisObj) => {
                const [opts] = args;
                const result = orig.apply(thisObj, args);
                const query = String(opts?.query ?? "").toLowerCase();
                if (!query || !result || !Array.isArray(result.unlocked))
                    return result;

                const existingUnlocked = Array.isArray(result.unlocked)
                    ? result.unlocked
                    : [];
                const existingIds = new Set(
                    existingUnlocked.map((e: any) => String(e?.id ?? "")),
                );
                const customMatches: any[] = [];

                for (const [
                    name,
                    emoji,
                ] of pluginStore.loadedEmojis.entries()) {
                    if (!name.includes(query)) continue;
                    const base = pluginStore.customEmojiObjectsById.get(
                        emoji.id,
                    );
                    if (base && !existingIds.has(String(base.id)))
                        customMatches.push(base);
                }

                if (customMatches.length)
                    result.unlocked = [...customMatches, ...existingUnlocked];
                return result;
            },
        );

        patcherManager.instead(
            EmojiStore,
            "getCustomEmojiById",
            (args, orig, thisObj) => {
                const [id] = args;
                if (pluginStore.customEmojiObjectsById.has(id))
                    return pluginStore.customEmojiObjectsById.get(id);
                return orig.apply(thisObj, args);
            },
        );
        patcherManager.instead(
            EmojiStore,
            "getEmojis",
            (args, orig, thisObj) => {
                const result = orig.apply(thisObj, args);
                if (result && pluginStore.customEmojiObjectsById.size > 0) {
                    for (const emoji of pluginStore.customEmojiObjectsById.values()) {
                        result.push(emoji);
                    }
                }
                return result;
            },
        );

        if (EmojiStore.isEmojiUsable) {
            patcherManager.instead(
                EmojiStore,
                "isEmojiUsable",
                (args, orig, thisObj) => {
                    const [emoji] = args;
                    if (emoji && pluginStore.customEmojiObjectsById.has(emoji.id)) return true;
                    return orig.apply(thisObj, args);
                }
            );
        }

        // --- MESSAGE DISPATCH INTERCEPTOR ---
        patcherManager.instead(
            MessageActions,
            "sendMessage",
            async (args, orig, thisObj) => {
                const [channelId, message, promise, extra] = args;

                if (message?.content && pluginStore.loadedEmojis.size > 0) {
                    let hasAppEmoji = false;
                    const transformed = String(message.content).replace(
                        emojiRegex,
                        (
                            match: string,
                            tagName: string,
                            _tagId: string,
                            colonName: string,
                            semiName: string,
                        ) => {
                            const rawName = (
                                tagName ||
                                colonName ||
                                semiName ||
                                ""
                            ).toLowerCase();
                            const found = pluginStore.loadedEmojis.get(rawName);
                            if (!found) return match;
                            hasAppEmoji = true;
                            return `;${found.name};`;
                        },
                    );

                    if (hasAppEmoji) {
                        const app = pluginStore.getSelectedApp();
                        const eCmd = pluginStore.getCommand("e");
                        if (!app || !eCmd) return orig.apply(thisObj, args);

                        const options: any[] = [
                            { type: 3, name: "text", value: transformed },
                        ];

                        const pendingReply =
                            ReplyStore?.getPendingReply?.(channelId);
                        if (pendingReply) {
                            options.push({
                                type: 6,
                                name: "reply",
                                value: pendingReply.message.author.id,
                            });
                        }

                        const guildId =
                            SelectedGuildStore?.getGuildId?.() || undefined;

                        try {
                            await pluginStore.dispatchInteraction({
                                appId: app.appId,
                                command: eCmd,
                                channelId,
                                guildId,
                                options,
                            });

                            if (pendingReply && PendingReplyActions) {
                                if (
                                    typeof PendingReplyActions.clearPendingReply ===
                                    "function"
                                )
                                    PendingReplyActions.clearPendingReply(
                                        channelId,
                                    );
                                else if (
                                    typeof PendingReplyActions.deletePendingReply ===
                                    "function"
                                )
                                    PendingReplyActions.deletePendingReply(
                                        channelId,
                                    );
                            }
                            return Promise.resolve({ code: 0 });
                        } catch (err) {
                            return orig.apply(thisObj, args);
                        }
                    }
                }
                return orig.apply(thisObj, args);
            },
        );
    },

    stop() {
        patcherManager.unpatchAll();
    },
});
