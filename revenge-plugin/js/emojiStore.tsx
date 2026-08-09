/**
 * Renders the Mobile Emoji Store UI natively for the Revenge client mod.
 * Allows users to browse their locally synced emojis, random emojis, and the Pack Market
 * via a React Native Modal overlaid on the screen.
 *
 * We use a native `Modal` and `TouchableOpacity` to simulate the Vencord `Popout` behavior
 * since mobile environments do not support floating DOM popouts in the same way desktop clients do.
 */
import React, { useState, useEffect } from "react";
// @ts-ignore
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Image, Dimensions } from "react-native";
import packsIndex from "../packs_index.json";
import { insertTextIntoChatInputBox } from "./utils";

export function CustomEmojiStoreModal({ visible, onClose, pluginStore }: any) {
  const [search, setSearch] = useState("");
  const [selectedPack, setSelectedPack] = useState("All");
  const [activeTab, setActiveTab] = useState("emojis");

  const allEmojis = Array.from(pluginStore.loadedEmojis.values());

  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

  const packs = Array.from(
    new Set(
      allEmojis.map((e: any) => {
        const parts = e.name.split("_");
        return parts.length > 1 ? capitalize(parts[0]) : "Other";
      })
    )
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

  const handleSelect = (emoji: any) => {
    const textToInsert = `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}> `;
    // In React Native Revenge, inserting text usually requires patching TextInput
    // or using the Native Clipboard
    try {
       // @ts-ignore
       insertTextIntoChatInputBox(textToInsert);

    } catch(e) {}
    onClose();
  };

  const getCleanIconUrl = (rawIcon: string) => {
    if (!rawIcon) return null;
    if (rawIcon.startsWith("<")) {
      const parts = rawIcon.replace(/[<>]/g, "").split(":");
      const isAnim = parts[0] === "a";
      const id = parts[2];
      return `https://cdn.discordapp.com/emojis/${id}.${isAnim ? "gif" : "png"}?size=48&quality=lossless`;
    }
    return rawIcon;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View style={{ height: Dimensions.get('window').height * 0.8, backgroundColor: "#313338", borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1e1f22", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 16 }}>
              <TouchableOpacity onPress={() => setActiveTab("emojis")}>
                <Text style={{ fontSize: 18, fontWeight: "bold", color: activeTab === "emojis" ? "#fff" : "#80848e" }}>Emojis</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab("store")}>
                <Text style={{ fontSize: 18, fontWeight: "bold", color: activeTab === "store" ? "#fff" : "#80848e" }}>Store</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: "#80848e", fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {activeTab === "emojis" ? (
            <View style={{ flex: 1 }}>
              {/* Toolbar */}
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#1e1f22" }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", marginBottom: 12 }}>
                  {packs.map((pack) => (
                    <TouchableOpacity
                      key={pack}
                      onPress={() => setSelectedPack(pack)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        backgroundColor: selectedPack === pack ? "#5865F2" : "#2b2d31",
                        borderRadius: 16,
                        marginRight: 8,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 14 }}>{pack}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={{
                    backgroundColor: "#1e1f22",
                    color: "#fff",
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                  placeholder="Search emojis..."
                  placeholderTextColor="#80848e"
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {/* Grid */}
              <ScrollView style={{ flex: 1, padding: 12 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {filtered.map((e: any) => (
                    <TouchableOpacity
                      key={e.id}
                      onPress={() => handleSelect(e)}
                      style={{
                        width: 48,
                        height: 48,
                        backgroundColor: "#2b2d31",
                        borderRadius: 8,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Image
                        source={{ uri: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}?size=48&quality=lossless` }}
                        style={{ width: 32, height: 32 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          ) : (
            <ScrollView style={{ flex: 1, padding: 16 }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 16 }}>Pack Market</Text>
              {packsIndex.map((pack: any) => {
                const isInstalled = Object.keys(pack.emojis).every((name) => pluginStore.loadedEmojis.has(name));
                return (
                  <View key={pack.name} style={{ backgroundColor: "#2b2d31", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {(pack.iconUrl || pack.icon) && (
                          <Image
                            source={{ uri: getCleanIconUrl(pack.iconUrl || pack.icon)! }}
                            style={{ width: 24, height: 24 }}
                          />
                        )}
                        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>{pack.name}</Text>
                      </View>
                    </View>
                    <Text style={{ color: "#b5bac1", marginBottom: 12 }}>{pack.description}</Text>
                    <TouchableOpacity
                      disabled={isInstalled}
                      style={{
                        backgroundColor: isInstalled ? "#4752c4" : "#5865F2",
                        padding: 8,
                        borderRadius: 4,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "bold" }}>
                        {isInstalled ? "✅ Installed (Use /uninstallpack)" : "📥 Use /installpack"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
