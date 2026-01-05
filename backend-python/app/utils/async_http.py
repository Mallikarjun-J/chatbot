import httpx

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (CampusAura AI)"
}

async def fetch_text(url: str, timeout: int = 5) -> str:
    async with httpx.AsyncClient(timeout=timeout, headers=DEFAULT_HEADERS) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.text
