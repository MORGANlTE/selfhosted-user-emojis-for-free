import json
import os

def create_pack():
    pack_name = input("Enter pack name (e.g. catspack): ").strip()
    if not pack_name:
        return

    print("Enter emojis for the pack. Type 'done' when finished.")
    emojis = {}

    while True:
        emoji_input = input("Enter emoji format <a:name:id> or <:name:id> (or 'done'): ").strip()
        if emoji_input.lower() == 'done':
            break

        # extract name and id
        parts = emoji_input.strip("<>").split(":")
        if len(parts) == 3:
            animated = parts[0] == "a"
            name = parts[1]
            emoji_id = parts[2]

            # create pack-prefixed name
            pack_emoji_name = f"{pack_name}_{name}"
            emojis[pack_emoji_name] = emoji_input
            print(f"Added {pack_emoji_name} -> {emoji_input}")
        else:
            print("Invalid format. Please use <a:name:id> or <:name:id>.")

    if emojis:
        os.makedirs("packs", exist_ok=True)
        filename = f"packs/{pack_name}.json"
        with open(filename, "w") as f:
            json.dump(emojis, f, indent=4)
        print(f"Successfully created pack {filename} with {len(emojis)} emojis.")
        print("You can now distribute this JSON pack structure to users locally.")

if __name__ == "__main__":
    create_pack()
