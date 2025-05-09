import { supabase } from './supabase';

export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    // Use edge function to check if email exists
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'checkEmail',
          userData: { email },
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    return result.exists;
  } catch (error) {
    throw error;
  }
}

export async function createUser(userData: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  phone?: string;
  service_commission_rate?: number;
  product_commission_rate?: number;
}) {
  try {
    // Call the edge function to create the auth user
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create',
          userData: {
            email: userData.email,
            password: userData.password,
          },
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    // Create the profile using the new user's ID
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: result.user.id,
        full_name: userData.full_name,
        role: userData.role,
        phone: userData.phone,
        service_commission_rate: userData.service_commission_rate,
        product_commission_rate: userData.product_commission_rate,
      }]);

    if (profileError) throw profileError;

    return { success: true };
  } catch (error) {
    throw error;
  }
}

export async function updateUser(id: string, userData: {
  password?: string;
  full_name: string;
  role: string;
  phone?: string;
  service_commission_rate?: number;
  product_commission_rate?: number;
}) {
  try {
    // If password is provided, update it through the edge function
    if (userData.password) {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update',
            userData: {
              id,
              password: userData.password,
            },
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
    }

    // Update the profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: userData.full_name,
        role: userData.role,
        phone: userData.phone,
        service_commission_rate: userData.service_commission_rate,
        product_commission_rate: userData.product_commission_rate,
      })
      .eq('id', id);

    if (profileError) throw profileError;

    return { success: true };
  } catch (error) {
    throw error;
  }
}

export async function deleteUser(id: string) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          userData: { id },
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    return { success: true };
  } catch (error) {
    throw error;
  }
}