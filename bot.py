import os
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.environ.get("TOKEN")

intents = discord.Intents.default()
intents.emojis_and_stickers = True
bot = commands.Bot(command_prefix="!", intents=intents)


def is_module_enabled(env_var_name: str, default: bool = False) -> bool:
    val = os.environ.get(env_var_name)
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on")


@bot.event
async def setup_hook():
    # Load module Cogs based on .env configuration
    modules = {
        "ENABLE_EMOJI_COMMANDS": ("cogs.emoji_cog", True),
        "ENABLE_FUN_COMMANDS": ("cogs.fun_cog", False),
        "ENABLE_POKEMON_COMMANDS": ("cogs.pokemon_cog", False),
        "ENABLE_UTILITY_COMMANDS": ("cogs.utility_cog", False),
    }

    for env_var, (extension, default_state) in modules.items():
        if is_module_enabled(env_var, default=default_state):
            try:
                await bot.load_extension(extension)
                print(f"[+] Loaded extension: {extension}")
            except Exception as e:
                print(f"[!] Failed to load extension {extension}: {e}")
        else:
            print(f"[-] Skipped extension: {extension} (Disabled)")

    # Sync tree with Discord API
    await bot.tree.sync()
    print("[+] Application command tree synced.")


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")


if __name__ == "__main__":
    bot.run(TOKEN)