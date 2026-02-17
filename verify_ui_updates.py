
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8080")

        # 1. Check Button Text
        btn_text = await page.locator(".diet-controls button").text_content()
        if "New Diet Suggestion" in btn_text:
            print("PASS: Button text updated")
        else:
            print(f"FAIL: Button text is '{btn_text}'")

        # 2. Check Card Headers (with line breaks)
        # Note: text_content() normalizes whitespace, so <br> becomes space or nothing.
        # We can check inner_html or just look for the words.
        eat_header = await page.locator(".eat-card h5").inner_html()
        if "Eat<br>" in eat_header or "Eat\n" in eat_header: # Depending on how browser renders
             print("PASS: Eat header has line break")
        else:
             print(f"FAIL: Eat header is '{eat_header}'")

        shop_header = await page.locator(".shop-card h5").inner_html()
        if "Shopping List<br>" in shop_header:
             print("PASS: Shop header has line break")
        else:
             print(f"FAIL: Shop header is '{shop_header}'")

        # 3. Check Background Color
        # We need to evaluate the computed style
        bg_color = await page.locator(".diet-card").first.evaluate("el => getComputedStyle(el).backgroundColor")
        # white is rgb(255, 255, 255)
        if bg_color == "rgb(255, 255, 255)":
            print("PASS: Background is white")
        else:
            print(f"FAIL: Background is {bg_color}")

        await page.screenshot(path="verification_final_ui.png", full_page=True)
        await browser.close()

asyncio.run(run())
