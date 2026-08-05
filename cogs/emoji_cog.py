import base64
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

EMOJI_FILE = "emojis.json"
PAT = re.compile(r";([A-Za-z0-9_]+);")

class EditMessageModal(discord.ui.Modal, title="Edit Last Message"):
    def __init__(self, cog: "EmojiCog", message: discord.InteractionMessage, raw_text: str, reply_user: Optional[discord.User]):
        super().__init__()
        self.cog = cog
        self.target_message = message
        self.reply_user = reply_user

        # Pre-fill the modal input with the original raw text (e.g., 'test ;piplup;')
        self.text_input = discord.ui.TextInput(
            label="Message Content",
            style=discord.TextStyle.paragraph,
            default=raw_text,  # <--- PRE-FILLS THE TEXT FIELD
            required=True,
            max_length=2000,
        )
        self.add_item(self.text_input)

    async def on_submit(self, interaction: discord.Interaction):
        # 1. Process the newly edited text
        await interaction.response.defer(ephemeral=True)
        new_raw_text = self.text_input.value
        processed_text = self.cog.repl(new_raw_text.replace("\\n", "\n"))

        # 2. Preserve the previous reply header if it existed
        if self.reply_user:
            processed_text += f"\n-# Replying to {self.reply_user.mention}"

        # 3. Edit the original interaction message directly
        await self.target_message.edit(content=processed_text)

        # 4. Save the updated raw text back into memory for future edits
        self.cog.last_messages[interaction.user.id] = {
            "message": self.target_message,
            "raw_text": new_raw_text,
            "reply_user": self.reply_user,
        }
        # Ephemeral confirmation so no extra clutter is posted
        # await interaction.delete_original_response()

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

        # Discord Select Menus display up to 25 items max
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
                    emoji=emoji_obj,  # Renders the custom emoji thumbnail directly in the list
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
        self.api = f"https://discord.com/api/v10/applications/{os.environ.get('APP_ID')}"
        self.load()

    def load(self):
        # make file if it doesn't exist
        if not os.path.exists(EMOJI_FILE):
            with open(EMOJI_FILE, "w", encoding="utf8") as f:
                json.dump({}, f, indent=2)
        if os.path.exists(EMOJI_FILE):
            with open(EMOJI_FILE, "r", encoding="utf8") as f:
                self.emotes = json.load(f)
        else:
            self.emotes = {}

    def save(self):
        with open(EMOJI_FILE, "w", encoding="utf8") as f:
            json.dump(self.emotes, f, indent=2)

    async def refresh_emojis(self):
        token = os.environ.get("TOKEN")
        headers = {"Authorization": f"Bot {token}"}
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{self.api}/emojis", headers=headers) as r:
                data = await r.json()
        self.emotes = {}
        for e in data.get("items", data):
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

    @commands.Cog.listener()
    async def on_ready(self):
        try:
            await self.refresh_emojis()
        except Exception as e:
            print(f"Failed to auto-refresh emojis on startup: {e}")

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

        # Save message reference and raw input text in memory
        self.last_messages[inter.user.id] = {
            "message": msg,
            "raw_text": text,
            "reply_user": reply,
        }

    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="ed", description="Edit your last sent emote message")
    async def ed(self, inter: discord.Interaction):
        # Retrieve the user's last message data
        user_data = self.last_messages.get(inter.user.id)

        if not user_data:
            await inter.response.send_message(
                "❌ You haven't sent any messages using `/e` yet during this session.",
                ephemeral=True
            )
            return

        # Open the modal with pre-filled raw text
        modal = EditMessageModal(
            cog=self,
            message=user_data["message"],
            raw_text=user_data["raw_text"],
            reply_user=user_data["reply_user"]
        )
        
        await inter.response.send_modal(modal)

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
            emb.set_author(name=f"Long press the 📱 field to copy for Mobile")

            total_pages = Pagination.compute_total_pages(len(self.emotes), page_size)
            emb.set_footer(text=f"Page {page} from {total_pages}")
            return emb, total_pages

        await Pagination(inter, get_page).navegate()

    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="search", description="Browse and search emojis with interactive select menu")
    @app_commands.describe(search="Optional emoji name filter")
    async def emoji_command(
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

    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
    @app_commands.command(name="browse", description="Browse available emotes")
    async def browse(self, inter: discord.Interaction, name: str):
        filtered = {
            k: v for k, v in self.emotes.items() if name.lower() in k.lower()
        }
        if not filtered:
            await inter.response.send_message(
                f"No emoji found with name `{name}`", ephemeral=True
            )
            return

        page_size = 15

        async def get_page(page: int):
            emb = discord.Embed(title="Available Emotes", description="")
            offset = (page - 1) * page_size
            keys = list(filtered.keys())[offset : offset + page_size]
            for emoji in keys:
                emb.add_field(
                    name="** **",
                    value=f"\n```;{emoji};```\n" + filtered[emoji],
                    inline=True,
                )
            emb.set_author(name=f"Requested by {inter.user}")
            total_pages = Pagination.compute_total_pages(len(filtered), page_size)
            emb.set_footer(text=f"Page {page} from {total_pages}")
            return emb, total_pages

        await Pagination(inter, get_page).navegate()

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
        token = os.environ.get("TOKEN")
        headers = {
            "Authorization": f"Bot {token}",
            "Content-Type": "application/json",
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.api}/emojis", headers=headers, json=payload
            ) as r:
                data = await r.json()
                if r.status != 201:
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

        async with aiohttp.ClientSession() as session:
            # 1. Fetch raw bytes using Discord's recommended .webp extension + ?animated=true
            cdn_url = f"https://cdn.discordapp.com/emojis/{emoji_id}.webp?animated=true&quality=lossless"

            async with session.get(cdn_url) as resp:
                if resp.status != 200:
                    await inter.followup.send(
                        f"Failed to fetch emoji image from CDN (Status {resp.status}).",
                        ephemeral=True,
                    )
                    return
                image_bytes = await resp.read()

            name = new_name or extracted_name or f"emoji_{emoji_id}"

            # 2. Upload using valid data:image/webp format
            payload = {
                "name": name,
                "image": "data:image/webp;base64," + base64.b64encode(image_bytes).decode(),
            }
            token = os.environ.get("TOKEN")
            headers = {
                "Authorization": f"Bot {token}",
                "Content-Type": "application/json",
            }

            async with session.post(
                f"{self.api}/emojis", headers=headers, json=payload
            ) as response:
                data = await response.json()

        if "id" not in data:
            await inter.followup.send(
                f"Upload failed.\n```{data}```", ephemeral=True
            )
            return

        # 3. Read the 'animated' flag returned directly by Discord's API
        is_animated_by_discord = data.get("animated", False)
        prefix = "a" if is_animated_by_discord else ""
        emoji_string = f"<{prefix}:{name}:{data['id']}>"

        self.emotes[name] = emoji_string
        self.save()

        await inter.followup.send(
            f"Successfully added {emoji_string}\nUse it with `;{name};`", ephemeral=True
        )


async def setup(bot: commands.Bot):
    await bot.add_cog(EmojiCog(bot))