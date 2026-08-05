import os
import discord
from discord import app_commands
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.environ.get("TOKEN")

intents = discord.Intents.default()
intents.emojis_and_stickers = True
bot = commands.Bot(command_prefix=None, intents=intents)

def is_module_enabled(env_var_name: str, default: bool = False) -> bool:
    val = os.environ.get(env_var_name)
    if val is None:
        return default
    return val.strip().lower() in ("true", "1", "yes", "on")

@bot.tree.error
async def on_app_command_error(
    interaction: discord.Interaction, 
    error: app_commands.AppCommandError
):
    # Unwrap the error if it was wrapped inside CommandInvokeError
    if isinstance(error, app_commands.CommandInvokeError):
        error = error.original

    # Handle failed checks (like our owner check)
    if isinstance(error, app_commands.CheckFailure):
        # Only attempt to respond if the interaction hasn't already been answered
        if not interaction.response.is_done():
            await interaction.response.send_message(
                "❌ Access denied: This is a private user application.",
                ephemeral=True
            )
            print(f"Access denied for user {interaction.user} (ID: {interaction.user.id})")

        # Suppress the console stack trace for blocked users
        return

    # Log true runtime errors (bugs, missing permissions, API exceptions)
    print(f"[!] Unhandled App Command Error: {error}")

@bot.event
async def setup_hook():
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

    # Sync slash commands with Discord API
    await bot.tree.sync()
    print("[+] Application command tree synced.")


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} (ID: {bot.user.id})")


if __name__ == "__main__":
    if not TOKEN:
        print("[!] ERROR: TOKEN is missing in .env file.")
    else:
        bot.run(TOKEN)