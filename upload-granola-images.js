const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Initialize Supabase client
const supabaseUrl =
  process.env.SUPABASE_URL || "https://ajblxmolmmvvnobpzzhr.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "product-images";
const IMAGES_DIR = path.join(__dirname, "public/imagesgranola");
const VENDOR_ID = "60cc15ad-fe97-4393-b598-b7ccab230464";

async function ensureBucketExists() {
  console.log("Checking if bucket exists...");

  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) {
    console.error("Error listing buckets:", listError);
    return false;
  }

  const bucketExists = buckets.some((b) => b.name === BUCKET_NAME);

  if (!bucketExists) {
    console.log("Creating bucket:", BUCKET_NAME);
    const { error: createError } = await supabase.storage.createBucket(
      BUCKET_NAME,
      {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
        ],
      }
    );

    if (createError) {
      console.error("Error creating bucket:", createError);
      return false;
    }
    console.log("Bucket created successfully");
  } else {
    console.log("Bucket already exists");
  }

  return true;
}

async function uploadImage(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);
  const storagePath = `legranola/${filename}`;

  console.log(`Uploading ${filename}...`);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.error(`Error uploading ${filename}:`, error.message);
    return null;
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

  console.log(`✓ Uploaded: ${filename}`);
  return { filename, publicUrl };
}

async function updateProductUrls(uploadedImages) {
  console.log("\nUpdating product image URLs in database...");

  for (const { filename, publicUrl } of uploadedImages) {
    const oldUrl = `/imagesgranola/${filename}`;

    const { error } = await supabase
      .from("products")
      .update({
        image_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("image_url", oldUrl)
      .eq("vendor_id", VENDOR_ID);

    if (error) {
      console.error(
        `Error updating product with image ${filename}:`,
        error.message
      );
    } else {
      console.log(`✓ Updated product URL for: ${filename}`);
    }
  }
}

async function main() {
  console.log("Starting image upload process...\n");

  // Ensure bucket exists
  const bucketReady = await ensureBucketExists();
  if (!bucketReady) {
    console.error("Failed to ensure bucket exists");
    process.exit(1);
  }

  // Get all JPG files
  const files = fs
    .readdirSync(IMAGES_DIR)
    .filter((file) => file.endsWith(".JPG"));

  console.log(`\nFound ${files.length} images to upload\n`);

  // Upload all images
  const uploadedImages = [];
  for (const file of files) {
    const result = await uploadImage(file);
    if (result) {
      uploadedImages.push(result);
    }
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✓ Successfully uploaded ${uploadedImages.length} images`);

  // Update product URLs
  await updateProductUrls(uploadedImages);

  console.log("\n✓ All done! Images uploaded and product URLs updated.");
}

main().catch(console.error);
