import os
import discord
from discord import app_commands

raw_owner_ids = os.environ.get("OWNER_IDs", "")
OWNER_IDs = [
    int(user_id.strip())
    for user_id in raw_owner_ids.replace("[", "").replace("]", "").split(",")
    if user_id.strip().isdigit()
]

def restrict_to_owner(cls):
    """Class decorator that locks all slash commands inside a Cog to owner IDs."""

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id in OWNER_IDs:
            return True
        print(f"Access denied for user {interaction.user} (ID: {interaction.user.id})")
        # Send ephemeral notice to blocked user
        if not interaction.response.is_done():
            await interaction.response.send_message(
                "❌ Access denied: Private User Application. Owner of the bot has been notified.",
                ephemeral=True
            )
        
        # Returning False tells discord.py to block command execution
        return False

    cls.interaction_check = interaction_check
    return cls