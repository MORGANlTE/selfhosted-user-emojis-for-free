import base64
import io
import json
import os
import re
import traceback
from typing import Optional, List
import aiohttp
import discord
from discord import app_commands
from discord.ext import commands

from helpers.checks import restrict_to_owner
from helpers.pagination import Pagination
from helpers.api import DiscordAPIHelper

EMOJI_FILE = "emojis.json"
PAT = re.compile(r";([A-Za-z0-9_]+);")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GIST_ID = os.getenv("GIST_ID")

class RenameEmojiModal(discord.ui.Modal, title="Rename Emoji"):
    def __init__(self, cog: "EmojiCog", emoji_id: str, old_name: str, is_animated: bool):
        super().__init__()
        self.cog = cog
        self.emoji_id = emoji_id
        self.old_name = old_name
        self.is_animated = is_animated

        self.new_name_input = discord.ui.TextInput(
            label="New Emoji Name",
            default=old_name,
            required=True,
            max_length=32,
            placeholder="Enter a new alphanumeric name...",
        )
        self.add_item(self.new_name_input)

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        new_name = self.new_name_input.value.strip().replace(" ", "_")

        # 1. Update the emoji name on Discord's Application API via Helper
        status, data = await DiscordAPIHelper.request(
            "PATCH", f"/emojis/{self.emoji_id}", {"name": new_name}
        )

        if status != 200:
            await interaction.followup.send(
                f"❌ Failed to rename emoji via API.\n```{data}```", ephemeral=True
            )
            return

        # 2. Update self.emotes dictionary & JSON file
        prefix = "a" if self.is_animated else ""
        new_emoji_string = f"<{prefix}:{new_name}:{self.emoji_id}>"

        if self.old_name in self.cog.emotes:
            del self.cog.emotes[self.old_name]

        self.cog.emotes[new_name] = new_emoji_string
        self.cog.save()

        # 3. Edit original message feedback
        await interaction.edit_original_response(
            content=f"Successfully renamed {new_emoji_string} to `;{new_name};`",
            view=None
        )


class RenameEmojiView(discord.ui.View):
    def __init__(self, cog: "EmojiCog", emoji_id: str, current_name: str, is_animated: bool):
        super().__init__(timeout=180)
        self.cog = cog
        self.emoji_id = emoji_id
        self.current_name = current_name
        self.is_animated = is_animated

    @discord.ui.button(label="Rename", style=discord.ButtonStyle.secondary, emoji="✏️")
    async def rename_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = RenameEmojiModal(
            cog=self.cog,
            emoji_id=self.emoji_id,
            old_name=self.current_name,
            is_animated=self.is_animated
        )
        await interaction.response.send_modal(modal)


class EditMessageModal(discord.ui.Modal, title="Edit Last Message"):
    def __init__(self, cog: "EmojiCog", message: discord.InteractionMessage, raw_text: str, reply_user: Optional[discord.User]):
        super().__init__()
        self.cog = cog
        self.target_message = message
        self.reply_user = reply_user

        self.text_input = discord.ui.TextInput(
            label="Message Content",
            style=discord.TextStyle.paragraph,
            default=raw_text,
            required=True,
            max_length=2000,
        )
        self.add_item(self.text_input)

    async def on_submit(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        new_raw_text = self.text_input.value
        processed_text = self.cog.repl(new_raw_text.replace("\\n", "\n"))

        if self.reply_user:
            processed_text += f"\n-# Replying to {self.reply_user.mention}"

        await self.target_message.edit(content=processed_text)

        self.cog.last_messages[interaction.user.id] = {
            "message": self.target_message,
            "raw_text": new_raw_text,
            "reply_user": self.reply_user,
        }


class EmojiSearchModal(discord.ui.Modal, title="Search Emojis"):
    query = discord.ui.TextInput(
        label="Emoji Name",
        placeholder="Type part of an emoji name (e.g. cat)...",
        required=True,
        max_length=50,
    )

    def __init__(self, cog: "EmojiCog"):
        super().__init__()
        self.cog = cog

    async def on_submit(self, interaction: discord.Interaction):
        search_term = self.query.value.lower()
        filtered = {
            k: v for k, v in self.cog.emotes.items()
            if search_term in k.lower()
        }

        if not filtered:
            await interaction.response.send_message(
                f"❌ No emojis found matching `{search_term}`.",
                ephemeral=True,
            )
            return

        view = EmojiSelectView(self.cog, filtered)
        await interaction.response.send_message(
            content=f"Found **{len(filtered)}** result(s) for `{search_term}`:",
            view=view,
            ephemeral=True,
        )


class EmojiSelectMenu(discord.ui.Select):
    def __init__(self, cog: "EmojiCog", emotes_dict: dict):
        self.cog = cog
        options = []

        for name, syntax in list(emotes_dict.items())[:25]:
            emoji_obj = None
            if syntax.startswith("<"):
                try:
                    emoji_obj = discord.PartialEmoji.from_str(syntax)
                except Exception:
                    pass

            options.append(
                discord.SelectOption(
                    label=name[:100],
                    value=f";{name};",
                    description=f"Select to copy ;{name};",
                    emoji=emoji_obj,
                )
            )

        super().__init__(
            placeholder="Choose an emoji to copy...",
            min_values=1,
            max_values=1,
            options=options,
        )

    async def callback(self, interaction: discord.Interaction):
        selected_tag = self.values[0]
        clean_name = selected_tag.strip(";")
        rendered_emoji = self.cog.emotes.get(clean_name, selected_tag)

        embed = discord.Embed(
            title=f"{selected_tag.strip(';')}",
            color=0x5865F2,
        )
        embed.add_field(
            name="Long press code below to copy for Mobile",
            value=f"`{selected_tag}`",
            inline=False,
        )
        embed.add_field(
            name="PC Copy",
            value=f"```{selected_tag}```",
            inline=False,
        )

        await interaction.response.send_message(
            content=f"**Preview:** {rendered_emoji}",
            embed=embed,
            ephemeral=True,
        )


class EmojiSelectView(discord.ui.View):
    def __init__(self, cog: "EmojiCog", emotes_dict: dict):
        super().__init__(timeout=180)
        self.cog = cog
        self.add_item(EmojiSelectMenu(cog, emotes_dict))

    @discord.ui.button(label="Search", style=discord.ButtonStyle.secondary, emoji="🔍")
    async def search_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(EmojiSearchModal(self.cog))


@restrict_to_owner
class EmojiCog(commands.Cog):

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.emotes = {}
        self.last_messages = {}
        self.load()

    def load(self):
        if os.path.exists(EMOJI_FILE):
            with open(EMOJI_FILE, "r", encoding="utf8") as f:
                self.emotes = json.load(f)
        else:
            self.emotes = {}

    def save(self):
        with open(EMOJI_FILE, "w", encoding="utf8") as f:
            json.dump(self.emotes, f, indent=2)

    async def sync_to_gist(self):
        """Pushes the current formatted emotes list directly to GitHub Gist."""
        if not GITHUB_TOKEN or not GIST_ID:
            return

        formatted_emojis = []
        for name, tag in self.emotes.items():
            match = re.match(r"<(a?):([^:]+):(\d+)>", tag)
            if match:
                formatted_emojis.append({
                    "id": match.group(3),
                    "name": name,
                    "animated": bool(match.group(1))
                })

        url = f"https://api.github.com/gists/{GIST_ID}"
        headers = {
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "MyDiscordBot/1.0",
            "X-GitHub-Api-Version": "2022-11-28"
        }
        payload = {
            "files": {
                "emojis.json": {
                    "content": json.dumps(formatted_emojis, indent=2)
                }
            }
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.patch(url, json=payload, headers=headers) as resp:
                    if resp.status == 200:
                        print(f"[+] Synced {len(formatted_emojis)} emojis to GitHub Gist!")
                    else:
                        text = await resp.text()
                        print(f"[!] Gist sync failed ({resp.status}): {text}")
        except Exception as e:
            print(f"[!] Gist sync exception: {e}")

    async def refresh_emojis(self):
        status, data = await DiscordAPIHelper.request("GET", "/emojis")
        if status != 200:
            print(f"[!] API Emoji fetch failed with status {status}: {data}")
            return

        self.emotes = {}
        items = data.get("items", data) if isinstance(data, dict) else data
        for e in items:
            self.emotes[e["name"]] = (
                f"<{'a' if e.get('animated') else ''}:{e['name']}:{e['id']}>"
            )
        self.save()

    def repl(self, txt: str) -> str:
        def replace(match):
            name = match.group(1)
            if name == "random":
                if not self.emotes:
                    return ";random;"
                import random
                return random.choice(list(self.emotes.values()))
            return self.emotes.get(name, match.group(0))

        return PAT.sub(replace, txt)

    def _build_formatted_emojis(self) -> list[dict]:
        formatted_emojis = []
        for name, tag in self.emotes.items():
            match = re.match(r"<(a?):([^:]+):(\d+)>", tag)
            if not match:
                continue
            formatted_emojis.append(
                {
                    "id": match.group(3),
                    "name": name,
                    "animated": bool(match.group(1)),
                }
            )
        return formatted_emojis

    @commands.Cog.listener()
    async def on_ready(self):
        try:
            await self.refresh_emojis()
        except Exception as e:
            print(f"[!] Failed to auto-refresh emojis on startup: {e}")

    # /e
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="e", description="Replace emotes in text")
    async def e(
        self,
        inter: discord.Interaction,
        text: str,
        reply: Optional[discord.User] = None,
    ):
        processed_text = self.repl(text.replace("\\n", "\n"))
        if reply:
            processed_text += f"\n-# Replying to {reply.mention}"
        await inter.response.send_message(processed_text)
        msg = await inter.original_response()

        self.last_messages[inter.user.id] = {
            "message": msg,
            "raw_text": text,
            "reply_user": reply,
        }

    # /ed
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="ed", description="Edit your last sent emote message")
    @app_commands.describe(text="The new text (bypasses modal if provided)")
    async def ed(self, inter: discord.Interaction, text: Optional[str] = None):
        user_data = self.last_messages.get(inter.user.id)

        if not user_data:
            await inter.response.send_message(
                "❌ You haven't sent any messages using `/e` yet during this session.",
                ephemeral=True
            )
            return

        # If Vencord provides the text directly, skip the modal!
        if text is not None:
            await inter.response.defer(ephemeral=True)
            processed_text = self.repl(text.replace("\\n", "\n"))
            
            if user_data["reply_user"]:
                processed_text += f"\n-# Replying to {user_data['reply_user'].mention}"

            await user_data["message"].edit(content=processed_text)
            
            # Update the cached raw text so future edits work
            self.last_messages[inter.user.id]["raw_text"] = text
            await inter.followup.send("✅ Message edited successfully!", ephemeral=True)
            return

        # Fallback: If no text is provided (e.g., using it on mobile), show the modal
        modal = EditMessageModal(
            cog=self,
            message=user_data["message"],
            raw_text=user_data["raw_text"],
            reply_user=user_data["reply_user"]
        )
        await inter.response.send_modal(modal)

    # /elist
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="elist", description="List all available emotes")
    async def elist(self, inter: discord.Interaction):
        page_size = 15

        async def get_page(page: int):
            emb = discord.Embed(title="Available Emotes", description="")
            offset = (page - 1) * page_size
            keys = list(self.emotes.keys())[offset : offset + page_size]
            for emoji in keys:
                emb.add_field(
                    name="** **",
                    value=f"📱`;{emoji};`\n```;{emoji};```" + self.emotes[emoji],
                    inline=True,
                )
            emb.set_author(name="Long press the 📱 field to copy for Mobile")

            total_pages = Pagination.compute_total_pages(len(self.emotes), page_size)
            emb.set_footer(text=f"Page {page} from {total_pages}")
            return emb, total_pages

        await Pagination(inter, get_page).navegate()

    # /search
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="search", description="Browse and search emojis with interactive select menu")
    @app_commands.describe(search="Optional emoji name filter")
    async def search_command(
        self, 
        interaction: discord.Interaction, 
        search: Optional[str] = None
    ):
        if search:
            filtered = {
                k: v for k, v in self.emotes.items() 
                if search.lower() in k.lower()
            }
        else:
            filtered = self.emotes

        if not filtered:
            await interaction.response.send_message(
                f"❌ No emojis found matching `{search}`.",
                ephemeral=True,
            )
            return

        view = EmojiSelectView(self, filtered)
        await interaction.response.send_message(
            content="Select an emoji below or tap **Search** to filter:",
            view=view,
            ephemeral=True,
        )

    async def emoji_name_autocomplete(
        self,
        interaction: discord.Interaction,
        current: str,
    ) -> list[app_commands.Choice[str]]:
        """Provides autocomplete suggestions from loaded application emojis."""
        choices = []
        for name in self.emotes.keys():
            if current.lower() in name.lower():
                choices.append(app_commands.Choice(name=name, value=name))
                if len(choices) >= 25:
                    break
        return choices

    # /renameemoji
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(
        name="renameemoji",
        description="Rename an existing emoji in your application library.",
    )
    @app_commands.describe(
        old_name="The current name of the emoji to rename",
        new_name="The new name for the emoji",
    )
    @app_commands.autocomplete(old_name=emoji_name_autocomplete)
    async def renameemoji(
        self,
        inter: discord.Interaction,
        old_name: str,
        new_name: str,
    ):
        await inter.response.defer(ephemeral=True)

        clean_old_name = old_name.strip().replace(";", "").replace(":", "")
        clean_new_name = new_name.strip().replace(" ", "_").replace(";", "").replace(":", "")

        if clean_old_name not in self.emotes:
            await inter.followup.send(
                f"❌ Emoji `;{clean_old_name};` was not found in your application library.",
                ephemeral=True,
            )
            return

        old_emoji_string = self.emotes[clean_old_name]

        match = re.match(r"<(a?):([^:]+):(\d+)>", old_emoji_string)
        if not match:
            await inter.followup.send(
                f"❌ Could not parse emoji ID from stored string: `{old_emoji_string}`",
                ephemeral=True,
            )
            return

        is_animated_prefix = match.group(1)
        emoji_id = match.group(3)

        status, data = await DiscordAPIHelper.request(
            "PATCH", f"/emojis/{emoji_id}", {"name": clean_new_name}
        )

        if status != 200:
            await inter.followup.send(
                f"❌ Failed to rename emoji via Discord API (Status {status}).\n```{data}```",
                ephemeral=True,
            )
            return

        new_emoji_string = f"<{is_animated_prefix}:{clean_new_name}:{emoji_id}>"

        del self.emotes[clean_old_name]
        self.emotes[clean_new_name] = new_emoji_string
        self.save()

        await inter.followup.send(
            f"✓ Successfully renamed {new_emoji_string} from `;{clean_old_name};` to `;{clean_new_name};`!",
            ephemeral=True,
        )

    # /refresh
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(
        name="refresh", description="Refresh the list of available emotes"
    )
    async def refresh(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
        await self.refresh_emojis()
        await inter.followup.send(
            f"Loaded {len(self.emotes)} emojis.", ephemeral=True
        )

    # /addemoji
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="addemoji", description="Add a new emoji")
    @app_commands.describe(name="Emoji name", image="PNG image")
    async def addemoji(
        self,
        inter: discord.Interaction,
        name: str,
        image: discord.Attachment,
    ):
        await inter.response.defer(ephemeral=True)
        image_bytes = await image.read()
        payload = {
            "name": name,
            "image": "data:image/png;base64,"
            + base64.b64encode(image_bytes).decode(),
        }

        status, data = await DiscordAPIHelper.request("POST", "/emojis", payload)

        if status != 201:
            await inter.followup.send(
                f"Failed: {data}", ephemeral=True
            )
            return

        self.emotes[name] = (
            f"<{'a' if data.get('animated') else ''}:{name}:{data['id']}>"
        )
        self.save()
        await inter.followup.send(
            f"Added {self.emotes[name]} as ;{name};", ephemeral=True
        )

    # /stealemoji
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(
        name="stealemoji",
        description="Steal an emoji by formatted string or raw ID.",
    )
    @app_commands.describe(
        emoji="Emoji tag (<:name:id> or <a:name:id>) OR raw Emoji ID",
        new_name="Optional custom name. If omitted, uses original name.",
    )
    async def stealemoji(
        self,
        inter: discord.Interaction,
        emoji: str,
        new_name: Optional[str] = None,
    ):
        await inter.response.defer(ephemeral=True)
        input_str = emoji.strip()

        match_full = re.match(r"<([^:]*):([^:]+):(\d+)>", input_str)
        match_id = re.match(r"^(\d+)$", input_str)

        emoji_id = None
        extracted_name = None

        if match_full:
            extracted_name = match_full.group(2)
            emoji_id = match_full.group(3)

        elif match_id:
            emoji_id = match_id.group(1)
            guild_emoji = self.bot.get_emoji(int(emoji_id))
            if guild_emoji:
                extracted_name = guild_emoji.name
        else:
            await inter.followup.send(
                "Invalid input! Provide a formatted emoji (`<:name:id>` / `<a:name:id>`) or numeric ID.",
                ephemeral=True,
            )
            return

        name = (new_name or extracted_name or f"emoji_{emoji_id}").strip().replace(" ", "_").replace(";", "").replace(":", "")
        if not re.fullmatch(r"[A-Za-z0-9_]{2,32}", name):
            await inter.followup.send(
                "❌ Invalid emoji name. Use 2-32 chars: letters, numbers, underscore.",
                ephemeral=True,
            )
            return
        if name in self.emotes:
            await inter.followup.send(
                f"❌ `;{name};` already exists. Choose another name.",
                ephemeral=True,
            )
            return

        parsed_animated = bool(match_full and match_full.group(1) == "a")
        emoji_extensions = ["gif", "webp"] if parsed_animated else ["webp", "png", "gif"]
        image_bytes = None
        mime_ext = None

        async with aiohttp.ClientSession() as session:
            for ext in emoji_extensions:
                cdn_url = f"https://cdn.discordapp.com/emojis/{emoji_id}.{ext}?quality=lossless"
                async with session.get(cdn_url) as resp:
                    if resp.status == 200:
                        image_bytes = await resp.read()
                        mime_ext = ext
                        break

        if image_bytes is None or mime_ext is None:
            await inter.followup.send(
                "❌ Failed to fetch emoji image from CDN.",
                ephemeral=True,
            )
            return

        payload = {
            "name": name,
            "image": f"data:image/{mime_ext};base64," + base64.b64encode(image_bytes).decode(),
        }

        status, data = await DiscordAPIHelper.request("POST", "/emojis", payload)

        if status not in (200, 201) or "id" not in data:
            await inter.followup.send(
                f"❌ Upload failed (Status {status}).\n```{data}```", ephemeral=True
            )
            return

        is_animated_by_discord = data.get("animated", False)
        prefix = "a" if is_animated_by_discord else ""
        emoji_string = f"<{prefix}:{name}:{data['id']}>"

        self.emotes[name] = emoji_string
        self.save()

        view = RenameEmojiView(
            cog=self,
            emoji_id=str(data["id"]),
            current_name=name,
            is_animated=is_animated_by_discord
        )

        await inter.followup.send(
            f"Successfully added {emoji_string}\nUse it with `;{name};`",
            view=view,
            ephemeral=True
        )

    # /esync
    @app_commands.command(
    name="esync",
    description="Return your emoji cache as an ephemeral JSON file.",
    )
    async def esync(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)

        formatted_emojis = self._build_formatted_emojis()
        if not formatted_emojis:
            await inter.followup.send(
                "❌ No emojis currently stored in local library.",
                ephemeral=True,
            )
            return

        payload = json.dumps(formatted_emojis, indent=2)
        file_bytes = io.BytesIO(payload.encode("utf-8"))
        discord_file = discord.File(fp=file_bytes, filename="emojis.json")

        await inter.followup.send(
            content=f"✅ Exported **{len(formatted_emojis)}** emojis.",
            file=discord_file,
            ephemeral=True,
        )

    # /deleteemoji
    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(
        name="deleteemoji",
        description="Permanently remove an emoji from your application library.",
    )
    @app_commands.describe(
        name="The name of the emoji to delete",
    )
    @app_commands.autocomplete(name=emoji_name_autocomplete)
    async def deleteemoji(
        self,
        inter: discord.Interaction,
        name: str,
    ):
        await inter.response.defer(ephemeral=True)

        clean_name = name.strip().replace(";", "").replace(":", "")

        if clean_name not in self.emotes:
            await inter.followup.send(
                f"❌ Emoji `;{clean_name};` was not found in your application library.",
                ephemeral=True,
            )
            return

        emoji_string = self.emotes[clean_name]

        match = re.match(r"<(a?):([^:]+):(\d+)>", emoji_string)
        if not match:
            await inter.followup.send(
                f"❌ Could not parse emoji ID from stored tag: `{emoji_string}`",
                ephemeral=True,
            )
            return

        emoji_id = match.group(3)

        status, data = await DiscordAPIHelper.request("DELETE", f"/emojis/{emoji_id}")

        if status not in (200, 204):
            await inter.followup.send(
                f"❌ Failed to delete emoji via Discord API (Status {status}).\n```{data}```",
                ephemeral=True,
            )
            return

        del self.emotes[clean_name]
        self.save()

        await inter.followup.send(
            f"🗑️ Successfully deleted `;{clean_name};` from your application library!",
            ephemeral=True,
        )

    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(
        name="sync_emojis",
        description="Publishes the bot's emoji cache for the Vencord plugin.",
    )
    async def sync_emojis(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)

        if not self.emotes:
            await inter.followup.send(
                "❌ No emojis currently stored in local library.",
                ephemeral=True,
            )
            return

        formatted_emojis = self._build_formatted_emojis()

        cache_json = json.dumps(formatted_emojis)

        # Send public payload message in channel that the plugin can read
        await inter.channel.send(
            f"```json\nEMOJI_CACHE:{cache_json}\n```"
        )

        await inter.followup.send(
            f"✅ Successfully published cache containing **{len(formatted_emojis)}** emojis to this channel!",
            ephemeral=True,
        )


async def setup(bot: commands.Bot):
    await bot.add_cog(EmojiCog(bot))