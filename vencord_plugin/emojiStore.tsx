import { React, ComponentDispatch, Toasts, showToast, openModal, Modal } from "@webpack/common";
import { findByProps } from "@webpack";


export function CustomEmojiStoreModal({
    transitionState,
    onClose,
    pluginStore,
}: any) {
    const [search, setSearch] = React.useState("");

    // Filter emojis based on the search input
    const allEmojis = Array.from(pluginStore.loadedEmojis.values());
    const filtered = allEmojis.filter((e: any) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
    );

    const handleSelect = (emoji: any) => {
        // We use the exact tag your bot expects!
        const textToInsert = `;${emoji.name}; `;

        try {
            // Secretly inject the text directly into the active Discord chat box
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
            // Bulletproof fallback: If Discord changes their dispatcher, it copies to your clipboard instead!
            navigator.clipboard.writeText(textToInsert);
            showToast("Copied to clipboard!", Toasts.Type.SUCCESS);
        }

        onClose();
    };

    return (
        <Modal
            transitionState={transitionState}
            onClose={onClose}
            title="💎 Custom Emoji Store"
            size="medium"
        >
            <div style={{ padding: "16px" }}>
                <input
                    type="text"
                    placeholder="Search your custom emojis..."
                    value={search}
                    onChange={(e: any) => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "8px",
                        backgroundColor: "var(--background-secondary-alt)",
                        color: "var(--text-normal)",
                        border: "none",
                        marginBottom: "16px",
                        outline: "none",
                        fontSize: "16px",
                        boxSizing: "border-box",
                    }}
                    autoFocus
                />
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fill, minmax(56px, 1fr))",
                        gap: "12px",
                        maxHeight: "50vh",
                        overflowY: "auto",
                        paddingRight: "8px",
                    }}
                >
                    {filtered.map((emoji: any) => {
                        const ext = emoji.animated ? "gif" : "webp";
                        const url = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=48&quality=lossless`;
                        return (
                            <div
                                key={emoji.id}
                                onClick={() => handleSelect(emoji)}
                                style={{
                                    cursor: "pointer",
                                    borderRadius: "8px",
                                    padding: "8px",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    backgroundColor:
                                        "var(--background-secondary)",
                                    transition:
                                        "transform 0.1s ease, background-color 0.1s ease",
                                }}
                                onMouseEnter={(e: any) => {
                                    e.currentTarget.style.transform =
                                        "scale(1.1)";
                                    e.currentTarget.style.backgroundColor =
                                        "var(--background-modifier-hover)";
                                }}
                                onMouseLeave={(e: any) => {
                                    e.currentTarget.style.transform =
                                        "scale(1)";
                                    e.currentTarget.style.backgroundColor =
                                        "var(--background-secondary)";
                                }}
                                title={`:${emoji.name}:`}
                            >
                                <img
                                    src={url}
                                    alt={emoji.name}
                                    style={{
                                        width: "40px",
                                        height: "40px",
                                        objectFit: "contain",
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
                                padding: "30px",
                                fontSize: "16px",
                            }}
                        >
                            No emojis found matching "{search}".
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export function openCustomEmojiStore(pluginStore: any) {
    if (openModal) {
        openModal((props: any) => (
            <CustomEmojiStoreModal {...props} pluginStore={pluginStore} />
        ));
    } else {
        showToast("Failed to open Emoji Store.", Toasts.Type.FAILURE);
    }
}
