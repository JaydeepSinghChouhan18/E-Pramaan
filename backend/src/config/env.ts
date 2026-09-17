import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  isProduction: process.env.NODE_ENV === 'production',

  // Supabase Configuration
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  hasSupabaseConfigured(): boolean {
    return Boolean(this.supabaseUrl && (this.supabaseServiceRoleKey || this.supabaseAnonKey));
  }
};
