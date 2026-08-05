import aiohttp
import json
import random
from datetime import date
import os

POKEMON_HISTORY = "pokemon_history.json"

MAX_POKEMON = 1025


async def get_pokemon_of_the_day():
    today = str(date.today())

    if not os.path.exists(POKEMON_HISTORY):
        with open(POKEMON_HISTORY, "w") as f:
            json.dump({
                "date": "",
                "pokemon": None,
                "remaining": list(range(1, MAX_POKEMON + 1))
            }, f, indent=4)

    try:
        with open(POKEMON_HISTORY, "r") as f:
            history = json.load(f)
    except:
        history = {
            "date": "",
            "pokemon": None,
            "remaining": list(range(1, MAX_POKEMON + 1))
        }

    # Already generated today
    if history["date"] == today:
        return history["pokemon"]

    # Refill after every Pokémon has been used
    if not history["remaining"]:
        history["remaining"] = list(range(1, MAX_POKEMON + 1))

    pokemon_id = random.choice(history["remaining"])
    history["remaining"].remove(pokemon_id)

    async with aiohttp.ClientSession() as session:

        pokemon = await (
            await session.get(
                f"https://pokeapi.co/api/v2/pokemon/{pokemon_id}"
            )
        ).json()

        species = await (
            await session.get(
                f"https://pokeapi.co/api/v2/pokemon-species/{pokemon_id}"
            )
        ).json()

    flavor = "No Pokédex entry found."

    for entry in species["flavor_text_entries"]:
        if entry["language"]["name"] == "en":
            flavor = (
                entry["flavor_text"]
                .replace("\n", " ")
                .replace("\f", " ")
            )
            break

    result = {
        "id": pokemon_id,
        "name": pokemon["name"].title(),
        "sprite": pokemon["sprites"]["front_default"],
        "types": ", ".join(
            t["type"]["name"].title()
            for t in pokemon["types"]
        ),
        "height": pokemon["height"],
        "weight": pokemon["weight"],
        "flavor": flavor
    }

    history["date"] = today
    history["pokemon"] = result

    with open(POKEMON_HISTORY, "w") as f:
        json.dump(history, f, indent=4)

    return result