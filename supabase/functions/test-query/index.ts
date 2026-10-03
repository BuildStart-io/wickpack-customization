import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'wickpack_customization' } });

const userId = 'b9de89fc-02b8-4db0-bfde-3d5e7750579c';

const [productsRes, faqsRes] = await Promise.all([
  supabase.from("products").select("*").eq("is_active", true).eq("user_id", userId),
  supabase.from("faqs").select("*, products(name)").eq("is_active", true).eq("user_id", userId),
]);

console.log("Products Data Length:", productsRes.data?.length);
console.log("Products Error:", productsRes.error);
console.log("Faqs Data Length:", faqsRes.data?.length);
console.log("Faqs Error:", faqsRes.error);
