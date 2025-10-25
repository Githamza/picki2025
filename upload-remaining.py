#!/usr/bin/env python3
import os
import requests
from pathlib import Path
import time

# Configuration
SUPABASE_URL = "https://ajblxmolmmvvnobpzzhr.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYmx4bW9sbW12dm5vYnB6emhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMjA0OTgsImV4cCI6MjA2Mzg5NjQ5OH0.UFjEo9qpZEChFedWxJEw1vgYrHrd4sFfBi_ZSKiiO9E"
BUCKET_NAME = "product-images"
IMAGES_DIR = Path("./public/imagesgranola")

def upload_image(file_path):
    """Upload a single image to Supabase Storage"""
    filename = file_path.name
    storage_path = f"legranola/{filename}"
    
    print(f"Uploading {filename}...", end=" ")
    
    headers = {
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "image/jpeg",
    }
    
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    try:
        response = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{storage_path}",
            headers=headers,
            data=file_data,
            timeout=30
        )
        
        if response.status_code in [200, 201]:
            print("✓ Success")
            return True
        elif response.status_code == 409:
            print("✓ Already exists")
            return True
        else:
            print(f"✗ Failed ({response.status_code}): {response.text[:100]}")
            return False
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return False

def main():
    print("Starting image upload...\n")
    
    # Get all JPG files
    image_files = sorted(IMAGES_DIR.glob("*.JPG"))
    print(f"Found {len(image_files)} images\n")
    
    successful = 0
    failed = 0
    
    for img_file in image_files:
        if upload_image(img_file):
            successful += 1
        else:
            failed += 1
        
        # Small delay to avoid rate limiting
        time.sleep(0.2)
    
    print(f"\n{'='*50}")
    print(f"Upload complete!")
    print(f"✓ Successful: {successful}")
    print(f"✗ Failed: {failed}")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()

