import { supabase } from "./src/integrations/supabase/client";

async function testFetch() {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "plan_limits")
    .single();

  console.log("Fetch result:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}

testFetch();
