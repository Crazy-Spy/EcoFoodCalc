
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8080")

        # Add a food item to trigger diet calculation
        # 1. Type "Baked Meat" in the food input
        await page.locator("#food").fill("Baked Meat")
        # 2. Select "Delicious" status (default is Delicious in the screenshot, but let's be safe)
        await page.locator("#food-status").select_option("Delicious")
        # 3. Click "Add Food"
        await page.locator("button:has-text('Add Food')").click()

        # Wait for the diet cards to appear
        try:
            await page.wait_for_selector(".diet-card", timeout=5000)
        except:
            print("Diet cards still not found after adding food.")

        # 1. Check Button Text
        btn_text = await page.locator(".diet-controls button").text_content()
        if "New Diet Suggestion" in btn_text:
            print("PASS: Button text updated")
        else:
            print(f"FAIL: Button text is '{btn_text}'")

        # 2. Check Card Headers (with line breaks)
        eat_card = page.locator(".eat-card h5")
        if await eat_card.count() > 0:
            eat_header = await eat_card.inner_html()
            if "Eat<br>" in eat_header or "Eat\n" in eat_header:
                 print("PASS: Eat header has line break")
            else:
                 print(f"FAIL: Eat header is '{eat_header}'")
        else:
            print("SKIP: Eat card not found")

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

        await page.screenshot(path="verification_final_ui_v3.png", full_page=True)
        await browser.close()

asyncio.run(run())
