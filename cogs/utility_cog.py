from datetime import datetime
from zoneinfo import ZoneInfo
import discord
from discord import app_commands
from discord.ext import commands
from helpers.checks import restrict_to_owner

@restrict_to_owner
class UtilityCog(commands.Cog):

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.allowed_installs(users=True, guilds=True)
    @app_commands.allowed_contexts(
        guilds=True, dms=True, private_channels=True
    )
    @app_commands.command(
        name="timestamp", description="Generate Discord timestamps."
    )
    async def timestamp(
        self,
        interaction: discord.Interaction,
        day: int,
        month: int,
        year: int,
        hour: int,
        minute: int = 0,
    ):
        dt = datetime(
            year,
            month,
            day,
            hour,
            minute,
            tzinfo=ZoneInfo("Europe/Brussels"),
        )
        unix = int(dt.timestamp())

        text = f"""Full:
`<t:{unix}:F>` - <t:{unix}:F>

Long Date:
`<t:{unix}:D>` - <t:{unix}:D>

Short Date:
`<t:{unix}:d>` - <t:{unix}:d>

Time:
`<t:{unix}:t>` - <t:{unix}:t>

Long Time:
`<t:{unix}:T>` - <t:{unix}:T>

Relative:
`<t:{unix}:R>` - <t:{unix}:R>
"""
        await interaction.response.send_message(text, ephemeral=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(UtilityCog(bot))