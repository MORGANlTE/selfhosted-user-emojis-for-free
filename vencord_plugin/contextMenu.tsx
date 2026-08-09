import {
    React,
    RestAPI,
    AuthenticationStore,
    SnowflakeUtils,
    Toasts,
    showToast,
    SelectedChannelStore,
    SelectedGuildStore,
    Menu,
} from "@webpack/common";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { ComponentDispatch, ContextMenuApi } from "@webpack/common";

/**
 * Dispatches a slash command directly to Discord's interaction API.
 * This function artificially creates a command payload in the background, circumventing the need
 * for the user to manually type and submit the command in the chat box, enabling seamless UI interactions.
 *
 * @param app The bot application containing the command details.
 * @param commandName The name of the command to execute (e.g., 'stealemoji').
 * @param options The argument payload required by the command.
 */
async function dispatchCommand(
    app: any,
    commandName: string,
    options: any[] = [],
) {
    const cmd = app.commands[commandName];
    if (!cmd) {
        showToast(
            `Command /${commandName} not found on your bot!`,
            Toasts.Type.FAILURE,
        );
        return;
    }

    try {
        const guildId = SelectedGuildStore?.getGuildId?.() || undefined;

        await RestAPI.post({
            url: "/interactions",
            body: {
                type: 2,
                application_id: app.appId,
                guild_id: guildId,
                channel_id: SelectedChannelStore.getChannelId() || "0",
                session_id: AuthenticationStore.getSessionId(),
                data: {
                    id: cmd.id,
                    version: cmd.version,
                    name: cmd.name,
                    type: 1,
                    options,
                    application_command: {
                        id: cmd.id,
                        version: cmd.version,
                        type: 1,
                        name: cmd.name,
                        application_id: app.appId,
                    }
                },
                nonce: SnowflakeUtils.fromTimestamp(Date.now()),
            },
        });

        if (commandName === "stealemoji") {
            showToast(
                "Emoji Stolen! Run /esync to update your picker.",
                Toasts.Type.SUCCESS,
            );
        }
    } catch (err) {
        showToast(`Failed to run /${commandName}`, Toasts.Type.FAILURE);
        console.error(`[UserEmojiPicker] ${commandName} Error:`, err);
    }
}

/**
 * Injects a context menu item into Discord's native Expression (Emoji) Picker.
 * This allows users to right-click an emoji in the native picker and execute the `/stealemoji` command.
 *
 * @param getAppState Function to retrieve the current state of the selected bot application.
 * @returns A patcher callback to manipulate the context menu's children.
 */
export function createExpressionPickerPatch(getAppState: () => any) {
    return (children: any[], props: any) => {
        if (!Menu || !Menu.MenuItem || !Menu.MenuGroup) return;

        const emoji = props?.emoji;
        if (!emoji || !emoji.id) return;

        // Skip our own bot emojis so we don't try to steal what we already own
        if (emoji.type === 3 && emoji.category === "User App Emojis") return;

        children.push(
            <Menu.MenuGroup id="morganite-picker-actions">
                <Menu.MenuItem
                    id="steal-emoji-picker"
                    label="Steal to Morganite"
                    action={(event: any) => {
                        // Close context menu first to allow inputs to be drafted natively
                        if (ContextMenuApi && ContextMenuApi.closeContextMenu) {
                            ContextMenuApi.closeContextMenu();
                        }

                        const app = getAppState().selectedApp;
                        if (app) {
                            const isAnimated = emoji.animated ? "a" : "";
                            const cleanName = (emoji.name || "emoji").replace(/[^A-Za-z0-9_]/g, "");
                            const formattedTag = `<${isAnimated}:${cleanName}:${emoji.id}>`;

                            // The expression picker can intercept INSERT_TEXT. To ensure it goes to the chat, we use the raw insert method.
                            // We also must close the expression picker first.
                            if (ComponentDispatch && ComponentDispatch.dispatch) {
                                ComponentDispatch.dispatch("EXPRESSION_PICKER_CLOSE");
                            }

                            setTimeout(() => {
                                insertTextIntoChatInputBox(`/stealemoji emoji:${formattedTag} new_name:`);
                            }, 100);
                        } else {
                            showToast("No bot selected in Vencord Settings!", Toasts.Type.FAILURE);
                        }
                    }}
                />
            </Menu.MenuGroup>,
        );
    };
}

/**
 * Injects context menu items when right-clicking a message in chat.
 * Adds options to Edit Bot Messages (via `/ed`) and to steal custom emojis found within the message's content.
 *
 * @param getAppState Function to retrieve the current state of the selected bot application.
 * @returns A patcher callback to manipulate the context menu's children.
 */
export function createMessageContextPatch(getAppState: () => any) {
    return (children: any[], props: any) => {
        if (!Menu || !Menu.MenuItem || !Menu.MenuGroup) return;

        const message = props?.message;
        if (!message) return;

        const groupItems: any[] = [];

        // A. Edit Bot Message Button
        if (message.author?.bot) {
            groupItems.push(
                <Menu.MenuItem
                    id="edit-bot-message"
                    label="Edit Bot Message"
                    action={() => {
                        const app = getAppState().selectedApp;
                        if (app && message.author.id === app.appId) {
                            // Fire /ed with no arguments to trigger your Python Modal
                            dispatchCommand(app, "ed", []);
                        } else {
                            showToast(
                                "This message was not sent by your active bot!",
                                Toasts.Type.FAILURE,
                            );
                        }
                    }}
                />,
            );
        }

        // B. Steal Emojis Button
        const emojiRegex = /<a?:([A-Za-z0-9_]+):(\d+)>/g;
        // THE FIX: Store the raw string (match[0]) so we can send the full <a:name:id> tag
        const foundEmojis: { name: string; id: string; raw: string }[] = [];
        let match;

        if (message.content) {
            while ((match = emojiRegex.exec(message.content)) !== null) {
                if (!foundEmojis.find((e) => e.id === match![2])) {
                    foundEmojis.push({
                        name: match[1],
                        id: match[2],
                        raw: match[0],
                    });
                }
            }
        }

        if (foundEmojis.length > 0) {
            const stealItems = foundEmojis.map((e) => (
                <Menu.MenuItem
                    id={`steal-${e.id}`}
                    label={`Steal :${e.name}:`}
                    action={(event: any) => {
                        if (ContextMenuApi && ContextMenuApi.closeContextMenu) {
                            ContextMenuApi.closeContextMenu();
                        }

                        const app = getAppState().selectedApp;
                        if (app) {
                            setTimeout(() => {
                                insertTextIntoChatInputBox(`/stealemoji emoji:${e.raw} new_name:`);
                            }, 100);
                        } else {
                            showToast("No bot selected in Vencord Settings!", Toasts.Type.FAILURE);
                        }
                    }}
                />
            ));

            if (stealItems.length === 1) {
                groupItems.push(stealItems[0]);
            } else {
                groupItems.push(
                    <Menu.MenuItem
                        id="steal-emojis-group"
                        label="Steal Emojis..."
                    >
                        {stealItems}
                    </Menu.MenuItem>,
                );
            }
        }

        // Inject all our buttons into the context menu
        if (groupItems.length > 0) {
            children.push(
                <Menu.MenuGroup id="morganite-actions">
                    {groupItems}
                </Menu.MenuGroup>,
            );
        }
    };
}
