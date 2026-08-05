import traceback
import discord
from discord import app_commands
from discord.ext import commands


class FunCog(commands.Cog):

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.allowed_installs(users=True, guilds=True)
    @app_commands.allowed_contexts(
        guilds=True, dms=True, private_channels=True
    )
    @app_commands.command(name="gift", description="Gift free Discord Nitro")
    async def gift_command(self, interaction: discord.Interaction):
        await interaction.response.defer()
        try:
            embed = discord.Embed(
                title="Basic Discord Nitro",
                description=f"You have been gifted Discord Nitro `1 week` by {interaction.user.mention}",
                colour=0xFF73FA,
            )
            embed.set_thumbnail(url="https://imgproxy.eneba.games/CoyH69EsR_972cTLsT04RdJXZSmdMJdLLe7mUr78M5U/rs:fit:300/ar:1/czM6Ly9wcm9kdWN0/cy5lbmViYS5nYW1l/cy9wcm9kdWN0cy9N/YVVpaWp2azhVREV0/ZTZJVTh1TS0tVmdy/WkthcTBGLWs1bElX/Ql9YTFZNLmpwZWc")
            embed.set_footer(
                text="This offer is a limited-time promotion. Terms and conditions apply*")
            embed.set_author(
                name="Discord Nitro",
                icon_url="https://cdn3.emoji.gg/emojis/8409-nitro.png",
            )

            view = discord.ui.View()
            view.add_item(
                discord.ui.Button(
                    label="Accept",
                    url="https://short-url.cc/nitrobasic1w",
                    style=discord.ButtonStyle.danger,
                    emoji="<:rainbowboost:1280448859448803520>",
                )
            )
            await interaction.followup.send(embed=embed, view=view)
        except Exception:
            print(traceback.format_exc())
            await interaction.followup.send("Error processing command.")


async def setup(bot: commands.Bot):
    await bot.add_cog(FunCog(bot))