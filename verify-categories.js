const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://ajblxmolmmvvnobpzzhr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYmx4bW9sbW12dm5vYnB6emhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzMjA0OTgsImV4cCI6MjA2Mzg5NjQ5OH0.UFjEo9qpZEChFedWxJEw1vgYrHrd4sFfBi_ZSKiiO9E"
);

const VENDOR_ID = "60cc15ad-fe97-4393-b598-b7ccab230464";

async function verifyCategoriesAndProducts() {
  console.log("Checking categories and product distribution...\n");

  // Get all legranola categories
  const categoryNames = [
    "Quiches & Tartes Salées",
    "Plats Complets",
    "Pâtes & Salades de Pâtes",
    "Salades Fraîches",
    "Bowls & Plats Santé",
    "Pains & Focaccias",
    "Soupes & Veloutés",
    "Plats Internationaux",
    "Petit-Déjeuner",
    "Desserts & Douceurs",
  ];

  for (const categoryName of categoryNames) {
    // Get category
    const { data: category } = await supabase
      .from("categories")
      .select("id, name")
      .eq("name", categoryName)
      .single();

    if (category) {
      // Count products in this category
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("category_id", category.id)
        .eq("vendor_id", VENDOR_ID);

      console.log(`${category.name}: ${count} products`);
    } else {
      console.log(`${categoryName}: NOT FOUND`);
    }
  }

  // Check for products without category
  const { count: uncategorized } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .is("category_id", null)
    .eq("vendor_id", VENDOR_ID);

  console.log(`\nUncategorized products: ${uncategorized}`);

  // Show some sample products with their categories
  console.log("\nSample products with categories:");
  const { data: samples } = await supabase
    .from("products")
    .select("name, categories(name)")
    .eq("vendor_id", VENDOR_ID)
    .order("display_order")
    .limit(10);

  samples?.forEach((p) => {
    console.log(`  - ${p.name} → ${p.categories?.name || "No category"}`);
  });
}

verifyCategoriesAndProducts()
  .then(() => console.log("\n✓ Done!"))
  .catch(console.error);
