import { React, ComponentDispatch, Toasts, showToast, openModal, Modal, ContextMenuApi, Menu, Button } from "@webpack/common";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { findByProps } from "@webpack";


export function CustomEmojiStorePopout({
    onClose,
    pluginStore,
}: any) {
    const [search, setSearch] = React.useState("");
    const [selectedPack, setSelectedPack] = React.useState("All");

    const allEmojis = Array.from(pluginStore.loadedEmojis.values());

    // Extract unique packs by checking for the `packname_` prefix convention
    const packs = Array.from(new Set(allEmojis.map((e: any) => {
        const parts = e.name.split("_");
        return parts.length > 1 ? parts[0] : "Other";
    }))).sort();
    packs.unshift("All");

    const filtered = allEmojis.filter((e: any) => {
        const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;

        if (selectedPack === "All") return true;

        const parts = e.name.split("_");
        const packName = parts.length > 1 ? parts[0] : "Other";
        return packName === selectedPack;
    });

    const handleSelect = (emoji: any, event: any) => {
        try {
            // insertTextIntoChatInputBox naturally parses the text if it corresponds to an ID in EmojiStore
            const textToInsert = `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}> `;
            insertTextIntoChatInputBox(textToInsert);
        } catch (e) {
            const textToInsert = `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
            navigator.clipboard.writeText(textToInsert);
            showToast("Copied to clipboard!", Toasts.Type.SUCCESS);
        }

        if (!event.shiftKey) {
            onClose();
        }
    };

    return (
        <div style={{
            width: "350px",
            height: "400px",
            backgroundImage: "url(https://i.pinimg.com/236x/2c/cd/9d/2ccd9d9501e6ecbcca340a868ddd1184.jpg)", backgroundSize: "cover",
            border: "1px solid var(--background-tertiary)",
            borderRadius: "8px",
            boxShadow: "0 8px 16px rgba(0,0,0,0.24)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 1000
        }}>
            <div style={{
                padding: "12px",
                borderBottom: "1px solid rgba(0,0,0,0.3)",
                backgroundColor: "rgba(0,0,0,0.5)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h3 style={{ color: "#fff", margin: 0, fontSize: "16px", fontWeight: 600 }}>💎 Custom Emojis</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {pluginStore.isSyncing && <div style={{ color: "#aaa", fontSize: "12px" }}>Loading...</div>}
                        <Button
                            size={Button.Sizes.MIN}
                            color={Button.Colors.BRAND}
                            onClick={() => pluginStore.connectAndSync()}
                            disabled={pluginStore.isSyncing}
                        >
                            Resync
                        </Button>
                        <Button
                            size={Button.Sizes.MIN}
                            color={Button.Colors.GREEN}
                            onClick={() => {
                                onClose();
                                // Instruct user how to add or implement Add logic directly if command exists
                                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: "/addemoji " });
                            }}
                        >
                            + Add
                        </Button>
                    </div>
                </div>                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <select
                        value={selectedPack}
                        onChange={(e: any) => setSelectedPack(e.target.value)}
                        style={{
                            padding: "8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--background-tertiary)",
                            color: "var(--text-normal)",
                            border: "none",
                            outline: "none",
                            fontSize: "12px",
                            cursor: "pointer",
                            maxWidth: "100px"
                        }}
                    >
                        {packs.map(pack => <option key={pack} value={pack}>{pack}</option>)}
                    </select>
                    <input
                        type="text"
                        placeholder={pluginStore.isSyncing ? "Syncing emojis..." : "Search custom emojis..."}
                        value={search}
                        onChange={(e: any) => setSearch(e.target.value)}
                        style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: "4px",
                            backgroundColor: "var(--background-tertiary)",
                            color: "var(--text-normal)",
                            border: "none",
                            outline: "none",
                            fontSize: "14px",
                            boxSizing: "border-box",
                        }}
                        autoFocus
                    />
                </div>
            </div>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
                    gap: "8px",
                    overflowY: "auto",
                    padding: "12px",
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.6)"
                }}
            >
                {filtered.map((emoji: any) => {
                    // Try webp first, with fallback to png/gif logic handled dynamically or via onError
                    const url = `https://cdn.discordapp.com/emojis/${emoji.id}?size=48&quality=lossless`;
                    return (
                        <div
                            key={emoji.id}
                            onClick={(e: any) => handleSelect(emoji, e)}
                            onContextMenu={(e: any) => {
                                e.preventDefault();
                                ContextMenuApi.openContextMenu(e, () => (
                                    <Menu.Menu navId="custom-emoji-context" onClose={ContextMenuApi.closeContextMenu}>
                                        <Menu.MenuItem
                                            id="rename-emoji"
                                            label="Rename Emoji"
                                            action={() => {
                                                onClose();
                                                // Using insertTextIntoChatInputBox will automatically trigger Discord's draft parser.
                                                // By typing the text naturally it will often trigger slash command completion.
                                                insertTextIntoChatInputBox(`/renameemoji old_name:${emoji.name} new_name:`);
                                            }}
                                        />
                                        <Menu.MenuItem
                                            id="delete-emoji"
                                            label="Delete Emoji"
                                            color="danger"
                                            action={() => {
                                                onClose();
                                                insertTextIntoChatInputBox(`/deleteemoji name:${emoji.name}`);
                                            }}
                                        />
                                    </Menu.Menu>
                                ));
                            }}
                            style={{
                                cursor: "pointer",
                                borderRadius: "4px",
                                padding: "0", // Removed default padding so it stays static
                                width: "40px",
                                height: "40px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                backgroundColor: "transparent",
                                transition: "background-color 0.1s ease",
                                position: "relative"
                            }}
                            onMouseEnter={(e: any) => {
                                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
                                const img = e.currentTarget.querySelector("img");
                                if (img) img.style.transform = "scale(1.15)";
                                const text = e.currentTarget.querySelector("span");
                                if (text) text.style.opacity = "1";
                            }}
                            onMouseLeave={(e: any) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                const img = e.currentTarget.querySelector("img");
                                if (img) img.style.transform = "scale(1)";
                                const text = e.currentTarget.querySelector("span");
                                if (text) text.style.opacity = "0";
                            }}
                            title={`:${emoji.name}:`}
                        >
                            <img
                                src={url}
                                alt={emoji.name}
                                draggable={false}
                                style={{
                                    width: "32px",
                                    height: "32px",
                                    objectFit: "contain",
                                    transition: "transform 0.1s ease",
                                }}
                            />
                            <span style={{
                                opacity: 0,
                                position: "absolute",
                                bottom: "-20px",
                                fontSize: "10px",
                                color: "#fff",
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                                transition: "opacity 0.1s ease",
                                background: "rgba(0,0,0,0.8)",
                                padding: "2px 4px",
                                borderRadius: "4px",
                                zIndex: 9999
                            }}>
                                {emoji.name.includes("_") ? emoji.name.split("_").slice(1).join("_") : emoji.name}
                            </span>
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div
                        style={{
                            color: "var(--text-muted)",
                            gridColumn: "1 / -1",
                            textAlign: "center",
                            padding: "20px",
                            fontSize: "14px",
                        }}
                    >
                        No emojis found matching "{search}".
                    </div>
                )}
            </div>
        </div>
    );
}
