import os
import aiohttp
from typing import Tuple, Any, Optional

class DiscordAPIHelper:
    """Centralized helper for Discord Application API interaction."""

    @staticmethod
    def get_base_url() -> str:
        app_id = os.environ.get("APP_ID")
        return f"https://discord.com/api/v10/applications/{app_id}"

    @classmethod
    async def request(
        cls, 
        method: str, 
        endpoint: str, 
        json_data: Optional[dict] = None
    ) -> Tuple[int, Any]:
        """Executes HTTP requests against the Discord Application API."""
        token = os.environ.get("TOKEN")
        headers = {
            "Authorization": f"Bot {token}",
            "Content-Type": "application/json",
        }
        url = f"{cls.get_base_url()}{endpoint}"

        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, headers=headers, json=json_data) as resp:
                try:
                    data = await resp.json()
                except Exception:
                    data = await resp.text()
                return resp.status, data