import dns from 'dns';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './env.js';

// Ensure reliable DNS resolution for Supabase API endpoints across all local network topologies
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const origLookup = dns.lookup;
  (dns as any).lookup = (hostname: string, options: any, callback: any) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (hostname && hostname.includes('supabase.co')) {
      return dns.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) return origLookup(hostname, options, callback);
        if (options && options.all) {
          return callback(null, addresses.map(addr => ({ address: addr, family: 4 })));
        }
        return callback(null, addresses[0], 4);
      });
    }
    return origLookup(hostname, options, callback);
  };
} catch {
  // Silent fallback
}

let adminClientInstance: SupabaseClient | null = null;
let publicClientInstance: SupabaseClient | null = null;

/**
 * Returns the administrative Supabase client using the service role key.
 * Strictly used by backend operations to bypass RLS for administrative verification/sync.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error(
      'Supabase Admin Client unavailable: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured in backend environment.'
    );
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return adminClientInstance;
}

/**
 * Returns a public client with anon key for standard auth requests (sign in, sign up).
 */
export function getSupabasePublicClient(): SupabaseClient {
  const key = config.supabaseAnonKey || config.supabaseServiceRoleKey;
  if (!config.supabaseUrl || !key) {
    throw new Error(
      'Supabase Client unavailable: SUPABASE_URL or SUPABASE_ANON_KEY is not configured in backend environment.'
    );
  }

  if (!publicClientInstance) {
    publicClientInstance = createClient(config.supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return publicClientInstance;
}
