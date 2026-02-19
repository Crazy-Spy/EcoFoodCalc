from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Enable console logs
    page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

    # Handle dialogs (alerts)
    def handle_dialog(dialog):
        print(f"Dialog message: {dialog.message}")
        dialog.accept()
    page.on("dialog", handle_dialog)

    try:
        page.goto("http://localhost:8000/index.html")

        # Wait for page to be ready
        page.wait_for_load_state("networkidle")

        # Check Tesseract
        is_tesseract_defined = page.evaluate("typeof Tesseract !== 'undefined'")
        print(f"Tesseract defined: {is_tesseract_defined}")

        # Upload the file
        print("Uploading screenshot...")
        # Ensure the file exists
        if not os.path.exists("verification/image.png"):
            print("Error: verification/image.png not found")
            return

        page.set_input_files("#screenshot-input", "verification/image.png")

        # Wait for processing.
        print("Waiting for OCR processing...")
        try:
            # Wait for the specific success message in session-status
            # The code sets: updateSessionStatus("Screenshot processed successfully.");
            page.wait_for_function(
                "document.getElementById('session-status').textContent.includes('Screenshot processed successfully.')",
                timeout=60000
            )
            print("OCR processed successfully according to status.")
        except Exception as e:
            print(f"Timeout or error waiting for success: {e}")
            status = page.evaluate("document.getElementById('session-status').textContent")
            print(f"Current status: {status}")

        # Take screenshot
        page.screenshot(path="verification/verification_result.png")
        print("Screenshot saved to verification/verification_result.png")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error_state.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
