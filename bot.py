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

    # Handle failed checks (like owner check)
    if isinstance(error, app_commands.CheckFailure):
        if not interaction.response.is_done():
            await interaction.response.send_message(
                "❌ Access denied: This is a private user application.",
                ephemeral=True
            )
            print(f"Access denied for user {interaction.user} (ID: {interaction.user.id})")
        return

    # Log true runtime errors
    print(f"[!] Unhandled App Command Error: {error}")

@bot.event
async def setup_hook():
    # 1. Load standard public modules
    try:
        await bot.load_extension("cogs.emoji_cog")
        print(f"[+] Loaded extension: cogs.emoji_cog")
    except Exception as e:
        print(f"[!] Failed to load extension cogs.emoji_cog: {e}")

    # 2. Load private cogs safely (if the folder exists & contains files)
    private_cogs_path = "cogs/private"
    for filename in os.listdir(private_cogs_path):
        if filename.endswith(".py") and not filename.startswith("__"):
            module_name = f"cogs.private.{filename[:-3]}"
            try:
                await bot.load_extension(module_name)
                print(f"[+] Loaded private extension: {module_name}")
            except Exception as e:
                print(f"[!] Failed to load private extension {module_name}: {e}")

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