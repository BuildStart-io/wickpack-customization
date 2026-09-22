## 📦 Wickpack Customization (v1.0)

This repository contains specific customizations tailored for **Wickpack**, isolating their data, behavior, and functions away from the core `public` schema.

### Database Isolation

- **Custom Schema**: Instead of `public`, this project operates entirely within the `wickpack_customization` schema. All core tables (`orders`, `profiles`, `faqs`, `ai_usage_logs`, etc.) are duplicated natively into this schema.
- **PostgREST Configuration**: To ensure the frontend can access this schema, the API Gateway has been patched. The `.env` variables now expose `wickpack_customization` via `PGRST_DB_SCHEMAS`.
- **Global Auth Triggers**: We intercept global signups from Supabase Auth (`auth.users`) using a custom script (`db/04_triggers.sql`). When a Wickpack user signs up, their profile and roles are correctly injected into the isolated `wickpack_customization` schema instead of leaking into the public schema.

### Edge Functions

- **Independent Functions**: All Edge Functions have been cloned and suffixed with `-wickpack-customization` (e.g., `ai-chat-wickpack-customization`).
- **Targeting**: The Supabase Client `createClient()` calls inside these edge functions have been modified to pass `{ db: { schema: 'wickpack_customization' } }`, safely sandboxing all data access.
- **AI Strict Order Format**: The AI system prompt in `ai-chat-wickpack-customization` has been heavily tailored. It aggressively enforces the collection of **7 key details** before confirming an order:
  1. Product Type
  2. Size (L x W x H)
  3. Quantity
  4. Material
  5. Printing Colors
  6. Artwork
  7. Sample availability
- **AI Sales Escalation**: If the customer has complex demands, manual artwork review, or complaints, the AI now securely directs them to human sales contacts (`+94 33 22 57592`, `+94 71 777 6010`, `saleswickpack@gmail.com`).
- **Robust Order Generation**: The prompt logic was updated to strictly output the `<ORDER_JSON>` tags internally so orders cleanly sync to the Supabase database without leaking JSON tags to WhatsApp customers.

### Dashboard & Frontend

- **Enhanced Specs Viewer**: The Wickpack dashboard naturally captures complex `special_instructions` as JSON. `Customers.tsx` and `Orders.tsx` have been updated to dynamically parse these JSON fields and display them to the admin as a beautiful, human-readable bulleted list in the "View Specs" modal, instead of showing raw JSON text.
