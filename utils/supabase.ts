import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
// `utils/database.types.ts` is GENERATED from the linked Supabase project:
//   npx supabase gen types typescript --linked > utils/database.types.ts
// Regenerate it after every `db push` — it reflects the LIVE prod schema, so
// anything authored-but-unpushed under supabase/migrations/ is absent until then.
// Never hand-edit it; local extensions belong in utils/database.ts.
import type { Database } from '@/utils/database.types';

const supabaseUrl = "https://wbcnhvvakptoinwkulmn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiY25odnZha3B0b2lud2t1bG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NzQ4NDAsImV4cCI6MjA1MTQ1MDg0MH0.tFthqZOKZaBVd5NYhNbF5LHTGpm5hClfLl8F5QESv9o";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
