
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8080")

        # Wait for the diet cards to appear. They might take a moment if JS is processing.
        try:
            await page.wait_for_selector(".diet-card", timeout=5000)
        except:
            print("Diet cards not found. Maybe initialization failed or no suggestions.")
            # If no suggestions, we can't verify the cards.
            # But with default 3000 kcal, we usually get suggestions unless no food data.
            pass

        # 1. Check Button Text
        btn_text = await page.locator(".diet-controls button").text_content()
        if "New Diet Suggestion" in btn_text:
            print("PASS: Button text updated")
        else:
            print(f"FAIL: Button text is '{btn_text}'")

        # 2. Check Card Headers (with line breaks)
        # We need to ensure the element exists before getting inner_html
        eat_card = page.locator(".eat-card h5")
        if await eat_card.count() > 0:
            eat_header = await eat_card.inner_html()
            # Normalize checks
            if "Eat<br>" in eat_header or "Eat\n" in eat_header:
                 print("PASS: Eat header has line break")
            else:
                 print(f"FAIL: Eat header is '{eat_header}'")
        else:
            print("SKIP: Eat card not found (maybe no diet result)")

        shop_card = page.locator(".shop-card h5")
        if await shop_card.count() > 0:
            shop_header = await shop_card.inner_html()
            if "Shopping List<br>" in shop_header:
                 print("PASS: Shop header has line break")
            else:
                 print(f"FAIL: Shop header is '{shop_header}'")
        else:
             print("SKIP: Shop card not found")

        # 3. Check Background Color
        cards = page.locator(".diet-card")
        if await cards.count() > 0:
            bg_color = await cards.first.evaluate("el => getComputedStyle(el).backgroundColor")
            if bg_color == "rgb(255, 255, 255)":
                print("PASS: Background is white")
            else:
                print(f"FAIL: Background is {bg_color}")
        else:
            print("SKIP: Background check skipped (no cards)")

        await page.screenshot(path="verification_final_ui_v2.png", full_page=True)
        await browser.close()

asyncio.run(run())
