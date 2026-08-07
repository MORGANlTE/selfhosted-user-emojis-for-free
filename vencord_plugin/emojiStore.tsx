import { React, ComponentDispatch, Toasts, showToast, openModal, Modal } from "@webpack/common";
import { findByProps } from "@webpack";


export function CustomEmojiStorePopout({
    onClose,
    pluginStore,
}: any) {
    const [search, setSearch] = React.useState("");

    const allEmojis = Array.from(pluginStore.loadedEmojis.values());
    const filtered = allEmojis.filter((e: any) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
    );

    const handleSelect = (emoji: any) => {
        // We use the exact tag your bot expects!
        const textToInsert = `:${emoji.name}: `;

        try {
            if (
                ComponentDispatch &&
                ComponentDispatch.dispatchToLastSubscribed
            ) {
                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
                    plainText: textToInsert,
                });
            } else if (ComponentDispatch && ComponentDispatch.dispatch) {
                ComponentDispatch.dispatch("INSERT_TEXT", {
                    plainText: textToInsert,
                });
            } else {
                throw new Error("No Dispatcher found");
            }
        } catch (e) {
            navigator.clipboard.writeText(textToInsert);
            showToast("Copied to clipboard!", Toasts.Type.SUCCESS);
        }

        onClose();
    };

    return (
        <div style={{
            width: "320px",
            maxHeight: "400px",
            backgroundColor: "var(--background-secondary)",
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
                borderBottom: "1px solid var(--background-modifier-accent)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <h3 style={{ color: "var(--header-primary)", margin: 0, fontSize: "16px", fontWeight: 600 }}>💎 Custom Emojis</h3>
                </div>
                <input
                    type="text"
                    placeholder="Search custom emojis..."
                    value={search}
                    onChange={(e: any) => setSearch(e.target.value)}
                    style={{
                        width: "100%",
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
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
                    gap: "8px",
                    overflowY: "auto",
                    padding: "12px",
                    flex: 1
                }}
            >
                {filtered.map((emoji: any) => {
                    // Try webp first, with fallback to png/gif logic handled dynamically or via onError
                    const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "webp"}?size=48&quality=lossless`;
                    return (
                        <div
                            key={emoji.id}
                            onClick={() => handleSelect(emoji)}
                            style={{
                                cursor: "pointer",
                                borderRadius: "4px",
                                padding: "4px",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                backgroundColor: "transparent",
                                transition: "background-color 0.1s ease",
                            }}
                            onMouseEnter={(e: any) => {
                                e.currentTarget.style.backgroundColor = "var(--background-modifier-hover)";
                                const img = e.currentTarget.querySelector("img");
                                if (img) img.style.transform = "scale(1.15)";
                            }}
                            onMouseLeave={(e: any) => {
                                e.currentTarget.style.backgroundColor = "transparent";
                                const img = e.currentTarget.querySelector("img");
                                if (img) img.style.transform = "scale(1)";
                            }}
                            title={`:${emoji.name}:`}
                        >
                            <img
                                src={url}
                                alt={emoji.name}
                                onError={(e: any) => {
                                    // Fallback for broken links: try .png if .webp fails
                                    if (e.target.src.includes(".webp")) {
                                        e.target.src = `https://cdn.discordapp.com/emojis/${emoji.id}.png?size=48&quality=lossless`;
                                    }
                                }}
                                style={{
                                    width: "32px",
                                    height: "32px",
                                    objectFit: "contain",
                                    transition: "transform 0.1s ease",
                                }}
                            />
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
