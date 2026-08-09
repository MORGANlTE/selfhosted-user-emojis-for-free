/**
 * Represents the specific slash commands the plugin relies on to communicate with the bot.
 * These are restricted to exact string literals to ensure strict type checking across the plugin API.
 */
export type CommandName = "e" | "ed" | "esync" | "deleteemoji" | "stealemoji";

/**
 * Metadata for a discovered slash command.
 * Used when constructing the interaction payload to send to Discord's `/interactions` API.
 */
export interface CommandMeta {
    id: string;
    version: string;
    name: CommandName;
}

/**
 * Represents a Discord Application (Bot) discovered by the plugin that contains the required emoji commands.
 */
export interface DiscoveredApp {
    appId: string;
    appName: string;
    /** A dictionary of commands discovered for this app. Used to execute commands seamlessly. */
    commands: Partial<Record<CommandName, CommandMeta>>;
}

/**
 * Represents a single custom emoji managed by the user's bot.
 */
export interface AppEmoji {
    id: string;
    name: string;
    animated: boolean;
}

/**
 * The structure of the plugin's persistent state cache.
 * We cache this information to avoid constantly fetching from the API and to provide immediate UI rendering.
 */
export interface PluginCache {
    /** The ID of the bot app the user has currently selected to use. */
    selectedAppId: string;
    /** A list of bot applications that have the required commands. */
    apps: DiscoveredApp[];
    /** The cached list of custom emojis fetched from the bot. */
    emojis: AppEmoji[];
    /** Timestamp of the last cache update to determine if a refresh is needed. */
    updatedAt: number;
}
