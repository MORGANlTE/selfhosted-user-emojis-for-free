from datetime import date
import discord
from discord import app_commands
from discord.ext import commands
from helpers.checks import restrict_to_owner
from helpers.potd import get_pokemon_of_the_day

@restrict_to_owner
class PokemonCog(commands.Cog):

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.allowed_installs(users=True, guilds=False)
    @app_commands.allowed_contexts(
        guilds=True, dms=True, private_channels=True
    )
    @app_commands.command(name="potd", description="Today's Pokémon.")
    async def potd(self, interaction: discord.Interaction):
        pokemon = await get_pokemon_of_the_day()

        embed = discord.Embed(
            title="Pokémon of the Day",
            description=(
                f"# **{date.today():%B %d, %Y}**\n\n"
                f"## {pokemon['name']}\n"
                f"**Type:** {pokemon['types']}\n\n"
                f"{pokemon['flavor']}"
            ),
            color=discord.Color.yellow(),
        )
        embed.set_thumbnail(url=pokemon["sprite"])

        await interaction.response.send_message(embed=embed)


async def setup(bot: commands.Bot):
    await bot.add_cog(PokemonCog(bot))