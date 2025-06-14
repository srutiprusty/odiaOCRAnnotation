# backend/ocr_processor.py

import os
import base64
import logging
import time
from typing import List, Dict, Optional

import google.generativeai as genai

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


SUPPORTED_IMAGE_TYPES = {"jpg", "jpeg", "png", "bmp", "webp", "tiff"}


def encode_image_to_base64(image_path: str) -> Optional[str]:
    """Read image and encode it into base64 string format."""
    if not os.path.exists(image_path):
        logger.error(f"Image not found: {image_path}")
        return None
    try:
        with open(image_path, "rb") as img_file:
            return base64.b64encode(img_file.read()).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to read or encode image {image_path}: {e}")
        return None


def get_mime_type(image_path: str) -> Optional[str]:
    """Return appropriate MIME type for given image."""
    ext = image_path.split(".")[-1].lower()
    if ext in SUPPORTED_IMAGE_TYPES:
        return f"image/{'jpeg' if ext == 'jpg' else ext}"
    logger.warning(f"Unsupported image format: {ext}")
    return None


def run_gemini_ocr(image_path: str, api_key: str, max_retries: int = 3) -> str:
    """Perform OCR on a single image using Google Gemini API with retry logic."""
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    base64_image = encode_image_to_base64(image_path)
    mime_type = get_mime_type(image_path)

    if base64_image is None or mime_type is None:
        return "[Image could not be processed]"

    prompt = """Extract all visible Odia (ଓଡ଼ିଆ) text from the image accurately. 
Only output the Odia text content. Do not explain or translate anything.
If no Odia text is found, return '[No Odia text found]'."""

    for attempt in range(max_retries):
        try:
            response = model.generate_content(
                [
                    prompt,
                    {
                        "mime_type": mime_type,
                        "data": base64_image
                    }
                ],
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 2048,
                    "top_p": 0.8,
                    "top_k": 40
                }
            )

            text = response.text.strip() if response.text else "[No text extracted]"
            logger.info(f"OCR complete for {os.path.basename(image_path)}")
            return text

        except Exception as e:
            logger.error(f"OCR attempt {attempt + 1} failed for {image_path}: {e}")
            if attempt == max_retries - 1:
                return f"[OCR failed after {max_retries} attempts: {str(e)}]"
            time.sleep(1)  # Wait before retrying


def batch_run_ocr(image_filenames: List[str], image_folder: str, api_key: str) -> Dict[str, str]:
    """
    Run OCR on a list of images and return a dictionary mapping
    filenames to extracted text.
    """
    results = {}
    logger.info(f"Starting batch OCR on {len(image_filenames)} images.")
    
    for filename in image_filenames:
        image_path = os.path.join(image_folder, filename)
        if not os.path.exists(image_path):
            logger.error(f"Image not found: {image_path}")
            results[filename] = "[Image file not found]"
            continue
            
        results[filename] = run_gemini_ocr(image_path, api_key)
        
    logger.info("Batch OCR complete.")
    return results


if __name__ == "__main__":
    # Example standalone test
    import sys
    test_api_key = os.getenv("GEMINI_API_KEY") or input("Enter Gemini API Key: ").strip()
    test_folder = "uploaded_images"
    test_files = [f for f in os.listdir(test_folder) if f.lower().split('.')[-1] in SUPPORTED_IMAGE_TYPES]
    results = batch_run_ocr(test_files, test_folder, test_api_key)

    for file, text in results.items():
        print(f"\n=== {file} ===\n{text}\n")
