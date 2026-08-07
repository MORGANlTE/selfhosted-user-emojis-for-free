import json
import os
import re

def create_pack():
    pack_name = input("Enter pack name (e.g. catspack): ").strip()
    if not pack_name:
        return

    file_path = input("Enter the text file name (e.g. emojis.txt): ").strip()

    if not os.path.isfile(file_path):
        print(f"❌ Error: Could not find the file '{file_path}'. Make sure it's in the same folder as this script!")
        return

    # Read the file content
    with open(file_path, "r", encoding="utf-8") as file:
        content = file.read()

    # Regex to catch both animated <a:name:id> and static <:name:id> emojis anywhere in the text
    emoji_pattern = re.compile(r'<(a?):([a-zA-Z0-9_]+):(\d+)>')
    matches = emoji_pattern.finditer(content)

    emojis = {}

    for match in matches:
        name = match.group(2)
        full_emoji = match.group(0)

        # create pack-prefixed name
        pack_emoji_name = f"{pack_name}_{name}"
        emojis[pack_emoji_name] = full_emoji
        print(f"Added {pack_emoji_name} -> {full_emoji}")

    if emojis:
        os.makedirs("packs", exist_ok=True)
        filename = f"packs/{pack_name}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(emojis, f, indent=4)
        print(f"\n✅ Successfully created pack {filename} with {len(emojis)} emojis.")
        print("You can now upload this JSON file to GitHub Gist to share it.")
    else:
        print("\n⚠️ No valid emojis were found in the file. Check your formatting!")

if __name__ == "__main__":
    create_pack()