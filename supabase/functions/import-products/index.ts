import { read, utils } from 'npm:xlsx@0.18.5';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const file = await req.blob();
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = utils.sheet_to_json(worksheet);

    const stats = {
      total: data.length,
      success: 0,
      errors: 0,
      errorMessages: [] as string[],
    };

    // First, get all categories
    const { data: existingCategories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, type');

    if (categoriesError) {
      throw new Error(`Error fetching categories: ${categoriesError.message}`);
    }

    if (!existingCategories || existingCategories.length === 0) {
      throw new Error('No categories found in database');
    }

    // Log all categories for debugging
    console.log('\nAvailable categories in database:');
    existingCategories.forEach(c => {
      console.log(`- "${c.name}" (${c.type}) [${c.id}]`);
    });

    // Get unique categories from Excel
    const uniqueExcelCategories = [...new Set(data.map(row => row.Categoria?.trim()))].filter(Boolean);
    console.log('\nCategories found in Excel file:');
    uniqueExcelCategories.forEach(cat => console.log(`- "${cat}"`));

    // Pre-check all categories
    const missingCategories = uniqueExcelCategories.filter(excelCat => {
      const found = existingCategories.find(dbCat => {
        const match = dbCat.name.toLowerCase() === excelCat.toLowerCase();
        const validType = dbCat.type === 'product' || dbCat.type === 'both';
        if (match && !validType) {
          console.log(`Warning: Category "${excelCat}" found but has invalid type: ${dbCat.type}`);
        }
        return match && validType;
      });
      if (!found) {
        console.log(`Warning: Category not found: "${excelCat}"`);
      }
      return !found;
    });

    if (missingCategories.length > 0) {
      throw new Error(
        'Categories not found or invalid type:\n' +
        missingCategories.map(c => `- "${c}"`).join('\n') +
        '\n\nAvailable product categories:\n' +
        existingCategories
          .filter(c => c.type === 'product' || c.type === 'both')
          .map(c => `- "${c.name}" (${c.type})`)
          .join('\n')
      );
    }

    for (const row of data) {
      try {
        // Validate required fields
        if (!row.Nome || !row.Preço || !row.Estoque || !row.Categoria) {
          throw new Error(`Missing required fields for product: ${JSON.stringify(row)}`);
        }

        // Normalize category name and find match
        const categoryName = row.Categoria.trim();
        const category = existingCategories.find(
          c => c.name.toLowerCase() === categoryName.toLowerCase() && 
              (c.type === 'product' || c.type === 'both')
        );

        if (!category) {
          throw new Error(
            `Category not found or invalid type: "${categoryName}"\n` +
            `Available product categories:\n` +
            existingCategories
              .filter(c => c.type === 'product' || c.type === 'both')
              .map(c => `- "${c.name}" (${c.type})`)
              .join('\n')
          );
        }

        // Parse and validate numeric values
        const price = parseFloat(String(row.Preço).replace(',', '.'));
        const stock = parseInt(String(row.Estoque));

        if (isNaN(price) || price <= 0) {
          throw new Error(`Invalid price: ${row.Preço}`);
        }

        if (isNaN(stock) || stock < 0) {
          throw new Error(`Invalid stock quantity: ${row.Estoque}`);
        }

        // Insert product
        const { error: insertError } = await supabase.from('products').insert({
          name: row.Nome.trim(),
          price: price,
          stock_quantity: stock,
          category_id: category.id,
          active: true,
          min_stock_alert: 5,
        });

        if (insertError) {
          throw new Error(`Error inserting product: ${insertError.message}`);
        }

        stats.success++;
        console.log(`Successfully imported: "${row.Nome}" (${categoryName})`);
      } catch (error) {
        stats.errors++;
        const errorMessage = `Error processing "${row.Nome || 'unknown product'}": ${error.message}`;
        stats.errorMessages.push(errorMessage);
        console.error(errorMessage);
      }
    }

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});