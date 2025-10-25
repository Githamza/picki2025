#!/bin/bash

# Configuration
PROJECT_REF="ajblxmolmmvvnobpzzhr"
SUPABASE_URL="https://ajblxmolmmvvnobpzzhr.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYmx4bW9sbW12dm5vYnB6emhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMjA0OTgsImV4cCI6MjA2Mzg5NjQ5OH0.UFjEo9qpZEChFedWxJEw1vgYrHrd4sFfBi_ZSKiiO9E"
BUCKET_NAME="product-images"
VENDOR_ID="60cc15ad-fe97-4393-b598-b7ccab230464"
IMAGES_DIR="./public/imagesgranola"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting image upload process...${NC}\n"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install it first:${NC}"
    echo "  macOS: brew install jq"
    echo "  Ubuntu/Debian: sudo apt-get install jq"
    exit 1
fi

# Function to check if bucket exists and create if needed
check_and_create_bucket() {
    echo -e "${YELLOW}Checking if bucket exists...${NC}"
    
    # Try to list bucket (this will fail if bucket doesn't exist)
    response=$(curl -s -w "\n%{http_code}" -X GET \
        "${SUPABASE_URL}/storage/v1/bucket/${BUCKET_NAME}" \
        -H "Authorization: Bearer ${ANON_KEY}")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" != "200" ]; then
        echo -e "${YELLOW}Bucket doesn't exist. Creating...${NC}"
        
        # Create the bucket
        create_response=$(curl -s -X POST \
            "${SUPABASE_URL}/storage/v1/bucket" \
            -H "Authorization: Bearer ${ANON_KEY}" \
            -H "Content-Type: application/json" \
            -d "{
                \"id\": \"${BUCKET_NAME}\",
                \"name\": \"${BUCKET_NAME}\",
                \"public\": true,
                \"file_size_limit\": 5242880,
                \"allowed_mime_types\": [\"image/jpeg\", \"image/jpg\", \"image/png\", \"image/webp\"]
            }")
        
        echo -e "${GREEN}✓ Bucket created${NC}"
    else
        echo -e "${GREEN}✓ Bucket already exists${NC}"
    fi
}

# Function to upload a single image
upload_image() {
    local filename=$1
    local filepath="${IMAGES_DIR}/${filename}"
    local storage_path="legranola/${filename}"
    
    echo -e "Uploading ${filename}..."
    
    # Upload the file
    response=$(curl -s -w "\n%{http_code}" -X POST \
        "${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storage_path}" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        -H "Content-Type: image/jpeg" \
        --data-binary "@${filepath}")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        # Get public URL
        public_url="${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storage_path}"
        echo -e "${GREEN}✓ Uploaded: ${filename}${NC}"
        echo "$public_url"
        return 0
    else
        echo -e "${RED}✗ Failed to upload ${filename} (HTTP ${http_code})${NC}"
        body=$(echo "$response" | sed '$d')
        echo -e "${RED}Response: ${body}${NC}"
        return 1
    fi
}

# Function to update product URL in database
update_product_url() {
    local filename=$1
    local public_url=$2
    local old_url="/imagesgranola/${filename}"
    
    # Update using Supabase REST API
    response=$(curl -s -w "\n%{http_code}" -X PATCH \
        "${SUPABASE_URL}/rest/v1/products?image_url=eq.${old_url}&vendor_id=eq.${VENDOR_ID}" \
        -H "Authorization: Bearer ${ANON_KEY}" \
        -H "apikey: ${ANON_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: return=minimal" \
        -d "{\"image_url\": \"${public_url}\", \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
        echo -e "${GREEN}✓ Updated product URL for: ${filename}${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to update product URL for ${filename}${NC}"
        return 1
    fi
}

# Main process
check_and_create_bucket

echo -e "\n${YELLOW}Uploading images...${NC}\n"

uploaded_count=0
failed_count=0

# Loop through all JPG files
for file in "${IMAGES_DIR}"/*.JPG; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        
        # Upload image
        public_url=$(upload_image "$filename")
        
        if [ $? -eq 0 ]; then
            # Update product URL
            update_product_url "$filename" "$public_url"
            ((uploaded_count++))
        else
            ((failed_count++))
        fi
        
        # Small delay to avoid rate limiting
        sleep 0.1
    fi
done

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Upload complete!${NC}"
echo -e "${GREEN}Successfully uploaded: ${uploaded_count}${NC}"
if [ $failed_count -gt 0 ]; then
    echo -e "${RED}Failed uploads: ${failed_count}${NC}"
fi
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

