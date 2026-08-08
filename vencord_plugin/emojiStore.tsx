import { React, ComponentDispatch, Toasts, showToast, openModal, Modal, ContextMenuApi, Menu, Button } from "@webpack/common";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { findByProps } from "@webpack";


export function CustomEmojiStorePopout({
    onClose,
    pluginStore,
}: any) {
    const [search, setSearch] = React.useState("");
    const [selectedPack, setSelectedPack] = React.useState("All");
    const [activeTab, setActiveTab] = React.useState("emojis");
    const [storePacks, setStorePacks] = React.useState<any[]>([]);
    const [loadingPacks, setLoadingPacks] = React.useState(false);

    React.useEffect(() => {
        if (activeTab === "store" && storePacks.length === 0) {
            setLoadingPacks(true);
            // Example repository where the pack maker stores the json output:
            // "tell me in a comment where i put the packs in what json file or what or where?"
            // You can upload the output JSON files from `helpers/pack_maker.py` into a Github Gist,
            // or a Github repository. Update this URL to point to a raw JSON array of pack links or content:
            // e.g., https://raw.githubusercontent.com/YourName/YourRepo/main/packs/index.json
            fetch("https://raw.githubusercontent.com/Morganite/UserEmojiPicker/main/packs_index.json")
                .then(r => r.json())
                .catch(() => {
                    // MOCK fallback for demo since no repo exists yet
                    return [{
                        name: "catspack",
                        description: "A cute pack of cats!",
                        emojis: {
                            "catspack_smirk": "<:smirk:12345>",
                            "catspack_wave": "<a:wave:67890>"
                        }
                    }];
                })
                .then(data => setStorePacks(data))
                .finally(() => setLoadingPacks(false));
        }
    }, [activeTab]);

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
            backgroundImage: `url(${pluginStore.getSetting?.("storeBackground") || "https://i.pinimg.com/236x/2c/cd/9d/2ccd9d9501e6ecbcca340a868ddd1184.jpg"})`, backgroundSize: "cover",
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <h3
                            onClick={() => setActiveTab("emojis")}
                            style={{
                                color: activeTab === "emojis" ? "#fff" : "#aaa",
                                margin: 0,
                                fontSize: "16px",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}>
                            {pluginStore.getSetting?.("storeName") || "💎 Custom Emojis"}
                        </h3>
                        <h3
                            onClick={() => setActiveTab("store")}
                            style={{
                                color: activeTab === "store" ? "#fff" : "#aaa",
                                margin: 0,
                                fontSize: "16px",
                                fontWeight: 600,
                                cursor: "pointer"
                            }}>
                            🛍️ Packs Store
                        </h3>
                    </div>
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
                                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", { plainText: "/addemoji " });
                            }}
                        >
                            + Add
                        </Button>
                    </div>
                </div>
            </div>

            {activeTab === "emojis" ? (
                <div style={{ padding: "12px", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
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
                            {packs.map((pack: string) => <option key={pack} value={pack}>{pack}</option>)}
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
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
                            gap: "8px",
                            overflowY: "auto",
                            padding: "12px",
                            flex: 1,
                            backgroundColor: "rgba(0,0,0,0.6)",
                            borderRadius: "4px"
                        }}
                    >
                        {filtered.map((emoji: any) => {
                            const url = `https://cdn.discordapp.com/emojis/${emoji.id}?size=48&quality=lossless${emoji.animated ? "&animated=true" : ""}`;
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
                                        padding: "0",
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
            ) : (
                <div style={{ padding: "12px", overflowY: "auto", flex: 1, backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}>
                    {loadingPacks ? <div style={{textAlign:"center", padding:"20px"}}>Loading Packs...</div> : (
                        storePacks.map(pack => (
                            <div key={pack.name} style={{
                                backgroundColor: "rgba(255,255,255,0.1)",
                                borderRadius: "8px",
                                padding: "12px",
                                marginBottom: "12px"
                            }}>
                                <h4 style={{margin: "0 0 4px 0", fontSize: "16px"}}>{pack.name}</h4>
                                <p style={{margin: "0 0 8px 0", fontSize: "12px", color: "#ccc"}}>{pack.description || "No description provided."}</p>
                                <div style={{display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "12px"}}>
                                    {Object.entries(pack.emojis).slice(0, 5).map(([name, tag]: any) => {
                                        const parts = tag.replace(/[<>]/g, "").split(":");
                                        const id = parts[parts.length - 1];
                                        return <img key={id} src={`https://cdn.discordapp.com/emojis/${id}?size=24&quality=lossless`} style={{width:"24px",height:"24px"}} title={name} />;
                                    })}
                                    {Object.keys(pack.emojis).length > 5 && <span style={{fontSize:"10px", alignSelf:"center"}}>+{Object.keys(pack.emojis).length - 5} more</span>}
                                </div>
                                <Button
                                    size={Button.Sizes.SMALL}
                                    color={Button.Colors.BRAND}
                                    onClick={() => {
                                        showToast("Packs must be installed via bot commands or manual sync in this version.", Toasts.Type.SUCCESS);
                                    }}
                                >
                                    Install Pack
                                </Button>
                            </div>
                        ))
                    )}
                    {storePacks.length === 0 && !loadingPacks && <div style={{textAlign:"center", padding:"20px", color:"#aaa"}}>No packs available in the remote store.</div>}

                    <div style={{marginTop: "20px", padding: "12px", backgroundColor: "rgba(0,0,0,0.8)", borderRadius: "8px", fontSize: "11px", color: "#ccc"}}>
                        <b>How to add your own packs:</b><br/>
                        1. Use <code>helpers/pack_maker.py</code> in your bot directory.<br/>
                        2. Upload the JSON output to a Github Gist.<br/>
                        3. Update the <code>fetch()</code> URL in <code>emojiStore.tsx</code> to point to a central <code>index.json</code> containing your pack URLs.
                    </div>
                </div>
            )}
        </div>
    );

}
