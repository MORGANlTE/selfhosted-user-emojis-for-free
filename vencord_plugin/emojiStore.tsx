import {
  React,
  ComponentDispatch,
  Toasts,
  showToast,
  openModal,
  Modal,
  ContextMenuApi,
  Menu,
  Button,
} from "@webpack/common";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { findByProps } from "@webpack";

export function CustomEmojiStorePopout({ onClose, pluginStore }: any) {
  const [search, setSearch] = React.useState("");
  const [selectedPack, setSelectedPack] = React.useState("All");
  const [activeTab, setActiveTab] = React.useState("emojis");
  const [storePacks, setStorePacks] = React.useState<any[]>([]);
  const [loadingPacks, setLoadingPacks] = React.useState(false);

  // Random emoji state moved to top level to avoid React Error 300
  const allEmojisArr = Array.from(pluginStore.loadedEmojis.values());
  const [randomEmoji, setRandomEmoji] = React.useState<any>(
    allEmojisArr[0] || { name: "random", id: "" },
  );
  React.useEffect(() => {
    if (allEmojisArr.length === 0) return;
    const interval = setInterval(() => {
      setRandomEmoji(
        allEmojisArr[Math.floor(Math.random() * allEmojisArr.length)],
      );
    }, 800);
    return () => clearInterval(interval);
  }, [pluginStore.loadedEmojis.size]);

  React.useEffect(() => {
    if (activeTab === "store" && storePacks.length === 0) {
      setLoadingPacks(true);
      // Discord's CSP blocks raw gist/github fetch requests natively via `fetch()`.
      // Instead of fetching from GitHub, we import the local JSON file.
      // You can update `packs_index.json` in your plugin folder directly!
      try {
        // We use require to let Webpack bundle the JSON file statically
        const localPacks = require("./packs_index.json");
        setStorePacks(Array.isArray(localPacks) ? localPacks : []);
      } catch (e) {
        console.error("Failed to load local packs_index.json", e);
        setStorePacks([]);
      } finally {
        setLoadingPacks(false);
      }
    }
  }, [activeTab]);

  const allEmojis = Array.from(pluginStore.loadedEmojis.values());

  const capitalize = (s: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

  // Extract unique packs by checking for the `packname_` prefix convention
  const packs = Array.from(
    new Set(
      allEmojis.map((e: any) => {
        const parts = e.name.split("_");
        return parts.length > 1 ? capitalize(parts[0]) : "Other";
      }),
    ),
  ).sort();
  packs.unshift("All");

  const filtered = allEmojis.filter((e: any) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedPack === "All") return true;

    const parts = e.name.split("_");
    const packName = parts.length > 1 ? parts[0] : "Other";
    return packName.toLowerCase() === selectedPack.toLowerCase();
  });

  const handleSelect = (emoji: any, event: any) => {
    try {
      if (emoji.isRandom) {
        insertTextIntoChatInputBox(`<:gift:999999999999999999> `);
      } else {
        const textToInsert = `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}> `;
        insertTextIntoChatInputBox(textToInsert);
      }
    } catch (e) {
      const textToInsert = emoji.isRandom
        ? `;random;`
        : `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
      navigator.clipboard.writeText(textToInsert);
      showToast("Copied to clipboard!", Toasts.Type.SUCCESS);
    }

    if (!event.shiftKey) {
      onClose();
    }
  };

  return (
    <div
      style={{
        width: "420px",
        height: "450px",
        backgroundImage: `url(${pluginStore.getSetting?.("storeBackground") || "https://i.pinimg.com/236x/2c/cd/9d/2ccd9d9501e6ecbcca340a868ddd1184.jpg"})`,
        backgroundSize: "cover",
        border: "1px solid var(--background-tertiary)",
        borderRadius: "8px",
        boxShadow: "0 8px 16px rgba(0,0,0,0.24)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid rgba(0,0,0,0.3)",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <h3
              onClick={() => setActiveTab("emojis")}
              style={{
                color: activeTab === "emojis" ? "#fff" : "#aaa",
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {pluginStore.getSetting?.("storeName") || "💎 Custom Emojis"}
            </h3>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Button
              size={Button.Sizes.MIN}
              color={
                activeTab === "store"
                  ? Button.Colors.BRAND
                  : Button.Colors.PRIMARY
              }
              onClick={() =>
                setActiveTab(activeTab === "store" ? "emojis" : "store")
              }
              style={{ padding: "0 8px" }}
            >
              🛒
            </Button>
            {pluginStore.isSyncing && (
              <div style={{ color: "#aaa", fontSize: "12px" }}>Loading...</div>
            )}
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
                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
                  plainText: "/addemoji ",
                });
              }}
            >
              + Add
            </Button>
          </div>
        </div>
      </div>

      {activeTab === "emojis" ? (
        <div
          style={{
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <select
              value={selectedPack}
              onChange={(e: any) => setSelectedPack(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "4px",
                backgroundColor: "#fff",
                color: "#000",
                border: "none",
                outline: "none",
                fontSize: "12px",
                cursor: "pointer",
                maxWidth: "100px",
              }}
            >
              {packs.map((pack: string) => (
                <option key={pack} value={pack}>
                  {pack}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={
                pluginStore.isSyncing
                  ? "Syncing emojis..."
                  : "Search custom emojis..."
              }
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "4px",
                backgroundColor: "#fff",
                color: "#000",
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
              overflowX: "hidden",
              padding: "12px",
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: "4px",
            }}
          >
            {search === "" && selectedPack === "All" && (
              <div
                key="random-emoji"
                onClick={(e: any) =>
                  handleSelect(
                    {
                      name: "gift",
                      id: "999999999999999999",
                      animated: false,
                      isRandom: true,
                    },
                    e,
                  )
                }
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
                  position: "relative",
                }}
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(255,255,255,0.1)";
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
              >
                <div
                  style={{
                    position: "relative",
                    width: "32px",
                    height: "32px",
                  }}
                >
                  {randomEmoji.id ? (
                    <img
                      src={`https://cdn.discordapp.com/emojis/${randomEmoji.id}?size=48&quality=lossless${randomEmoji.animated ? "&animated=true" : ""}`}
                      alt="random"
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        transition: "transform 0.1s ease",
                        opacity: 0.6,
                      }}
                    />
                  ) : null}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      fontSize: "20px",
                      textShadow: "0 0 4px #000",
                    }}
                  >
                    🎁
                  </div>
                </div>
                <span
                  style={{
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
                    zIndex: 9999,
                  }}
                >
                  random
                </span>
              </div>
            )}
            {filtered.map((emoji: any) => {
              const url = `https://cdn.discordapp.com/emojis/${emoji.id}?size=48&quality=lossless${emoji.animated ? "&animated=true" : ""}`;
              return (
                <div
                  key={emoji.id}
                  onClick={(e: any) => handleSelect(emoji, e)}
                  onContextMenu={(e: any) => {
                    e.preventDefault();
                    ContextMenuApi.openContextMenu(e, () => (
                      <Menu.Menu
                        navId="custom-emoji-context"
                        onClose={ContextMenuApi.closeContextMenu}
                      >
                        <Menu.MenuItem
                          id="rename-emoji"
                          label="Rename Emoji"
                          action={() => {
                            onClose();
                            insertTextIntoChatInputBox(
                              `/renameemoji old_name:${emoji.name} new_name:`,
                            );
                          }}
                        />
                        <Menu.MenuItem
                          id="delete-emoji"
                          label="Delete Emoji"
                          color="danger"
                          action={() => {
                            onClose();
                            insertTextIntoChatInputBox(
                              `/deleteemoji name:${emoji.name}`,
                            );
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
                    position: "relative",
                  }}
                  onMouseEnter={(e: any) => {
                    e.currentTarget.style.backgroundColor =
                      "rgba(255,255,255,0.1)";
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
                  <span
                    style={{
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
                      zIndex: 9999,
                    }}
                  >
                    {emoji.name.includes("_")
                      ? emoji.name.split("_").slice(1).join("_")
                      : emoji.name}
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
        <div
          style={{
            padding: "16px",
            overflowY: "auto",
            overflowX: "hidden",
            flex: 1,
            backgroundColor: "rgba(20,20,25,0.95)",
            color: "#fff",
            backdropFilter: "blur(10px)",
            transition: "all 0.3s ease",
          }}
        >
          <div style={{ marginBottom: "24px", textAlign: "center" }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                margin: "12px 0",
                color: "var(--brand-experiment)",
              }}
            >
              Pack Market
            </h2>
            <p
              style={{
                fontSize: "12px",
                color: "#aaa",
                margin: 0,
              }}
            >
              Discover and install community emoji packs instantly.
            </p>
          </div>

          {loadingPacks ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div
                className="spinner-mock"
                style={{
                  width: "24px",
                  height: "24px",
                  border: "3px solid rgba(255,255,255,0.3)",
                  borderRadius: "50%",
                  borderTopColor: "#fff",
                  animation: "spin 1s ease-in-out infinite",
                  margin: "0 auto",
                }}
              ></div>
            </div>
          ) : (
            storePacks.map((pack) => {
              // Check if installed
              const isInstalled =
                pack.emojis &&
                Object.keys(pack.emojis).some((name: string) =>
                  pluginStore.loadedEmojis.has(name.toLowerCase()),
                );

              return (
                <div
                  key={pack.name}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "16px",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                  }}
                  onMouseEnter={(e: any) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 12px rgba(0,0,0,0.5)";
                    e.currentTarget.style.backgroundColor =
                      "rgba(255,255,255,0.08)";
                  }}
                  onMouseLeave={(e: any) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 6px rgba(0,0,0,0.3)";
                    e.currentTarget.style.backgroundColor =
                      "rgba(255,255,255,0.05)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                      }}
                    >
                      {(pack.iconUrl || pack.icon) &&
                        (() => {
                          const rawIcon = pack.iconUrl || pack.icon;
                          let src = rawIcon;
                          if (rawIcon.startsWith("<")) {
                            const parts = rawIcon
                              .replace(/[<>]/g, "")
                              .split(":");
                            const id = parts[parts.length - 1];
                            const isAnimated = parts[0] === "a";
                            src = `https://cdn.discordapp.com/emojis/${id}?size=64&quality=lossless${isAnimated ? "&animated=true" : ""}`;
                          }
                          return (
                            <img
                              src={src}
                              alt={pack.name}
                              style={{
                                width: "40px",
                                height: "40px",
                                borderRadius: "8px",
                                objectFit: "cover",
                              }}
                            />
                          );
                        })()}
                      <div>
                        <h4
                          style={{
                            margin: "0 0 4px 0",
                            fontSize: "16px",
                            color: "var(--header-primary)",
                          }}
                        >
                          {capitalize(pack.name)}
                        </h4>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {pack.description || "No description provided."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      marginBottom: "16px",
                      backgroundColor: "rgba(0,0,0,0.3)",
                      padding: "8px",
                      borderRadius: "8px",
                    }}
                  >
                    {pack.emojis &&
                      Object.entries(pack.emojis)
                        .slice(0, 10)
                        .map(([name, tag]: any) => {
                          const parts = tag.replace(/[<>]/g, "").split(":");
                          const id = parts[parts.length - 1];
                          const isAnimated = parts[0] === "a";
                          return (
                            <img
                              key={id}
                              src={`https://cdn.discordapp.com/emojis/${id}?size=32&quality=lossless${isAnimated ? "&animated=true" : ""}`}
                              style={{
                                width: "28px",
                                height: "28px",
                                objectFit: "contain",
                                borderRadius: "4px",
                              }}
                              title={name}
                            />
                          );
                        })}
                    {pack.emojis && Object.keys(pack.emojis).length > 10 && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#ccc",
                          alignSelf: "center",
                          padding: "0 4px",
                          fontWeight: "bold",
                        }}
                      >
                        +{Object.keys(pack.emojis).length - 10}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      width: "100%",
                    }}
                  >
                    <Button
                      size={Button.Sizes.SMALL}
                      color={
                        isInstalled ? Button.Colors.GREEN : Button.Colors.BRAND
                      }
                      disabled={isInstalled}
                      onClick={() => {
                        if (isInstalled) return;
                        onClose();
                        insertTextIntoChatInputBox(
                          `/installpack pack_name:${pack.name}`,
                        );
                        showToast(
                          `Drafted install command for ${pack.name}! Hit enter in chat to begin.`,
                          Toasts.Type.SUCCESS,
                        );
                      }}
                      style={{ flex: 1 }}
                    >
                      {isInstalled ? "✅ Installed" : "📥 Install Pack"}
                    </Button>
                    {isInstalled && (
                      <Button
                        size={Button.Sizes.SMALL}
                        color={Button.Colors.RED}
                        onClick={() => {
                          onClose();
                          insertTextIntoChatInputBox(
                            `/uninstallpack pack_name:${pack.name}`,
                          );
                          showToast(
                            `Drafted uninstall command for ${pack.name}! Hit enter to remove.`,
                            Toasts.Type.SUCCESS,
                          );
                        }}
                      >
                        🗑️ Uninstall
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {storePacks.length === 0 && !loadingPacks && (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: "#aaa",
              }}
            >
              No packs available in the remote store.
            </div>
          )}

          <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
        </div>
      )}
    </div>
  );
}
