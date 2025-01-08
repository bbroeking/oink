import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://wbcnhvvakptoinwkulmn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiY25odnZha3B0b2lud2t1bG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU4NzQ4NDAsImV4cCI6MjA1MTQ1MDg0MH0.tFthqZOKZaBVd5NYhNbF5LHTGpm5hClfLl8F5QESv9o";

// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// if (!supabaseUrl || !supabaseAnonKey) {
// 	throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY is not set");
// }


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
