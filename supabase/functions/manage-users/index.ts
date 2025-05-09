import { serve } from "https://deno.land/std@0.218.2/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Get environment variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // Create Supabase client with service role (admin) privileges
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Parse request body
    const { action, userData } = await req.json();

    // Validate required data based on action
    if (!action) {
      throw new Error("Action is required");
    }

    // Create admin Supabase client
    const adminAuthClient = supabase.auth.admin;

    let result;

    // Perform action based on request
    switch (action) {
      case "checkEmail":
        if (!userData.email) {
          throw new Error("Email is required");
        }

        // Check if a user with the email exists
        const { data: users } = await adminAuthClient.listUsers({
          search: userData.email,
        });

        const emailExists = users.users.some(
          (user) => user.email === userData.email
        );

        result = { exists: emailExists };
        break;

      case "create":
        if (!userData.email || !userData.password) {
          throw new Error("Email and password are required");
        }

        // Create new user
        const { data: newUser, error: createError } = await adminAuthClient.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
        });

        if (createError) {
          throw createError;
        }

        result = { user: newUser.user };
        break;

      case "update":
        if (!userData.id) {
          throw new Error("User ID is required");
        }

        // Update user
        let updateData: any = {};

        if (userData.password) {
          updateData.password = userData.password;
        }

        const { data: updatedUser, error: updateError } = await adminAuthClient.updateUserById(
          userData.id,
          updateData
        );

        if (updateError) {
          throw updateError;
        }

        result = { user: updatedUser.user };
        break;

      case "delete":
        if (!userData.id) {
          throw new Error("User ID is required");
        }

        // Delete user
        const { error: deleteError } = await adminAuthClient.deleteUser(
          userData.id
        );

        if (deleteError) {
          throw deleteError;
        }

        result = { success: true };
        break;

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    // Return success response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Return error response
    console.error(`Error: ${error.message}`);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});