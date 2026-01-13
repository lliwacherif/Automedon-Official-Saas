
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';

// Load .env.local manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env.local');

let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value.trim();
        }
    });
}

console.log(`Connecting to: ${supabaseUrl}`)

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
    console.log('--- Testing Connection to tenant_users table ---')
    try {
        const { data, error } = await supabase
            .from('tenant_users')
            .select('*')
            .eq('username', 'root')
            .maybeSingle()

        if (error) {
            console.error('❌ Supabase Error:', error.message)
            console.error('Full Error:', error)
            if (error.code === 'PGRST301' || error.message.includes('relation "public.tenant_users" does not exist')) {
                console.log('\n💡 DIAGNOSIS: The "tenant_users" table does not exist. You need to run the "multi_tenant_setup.sql" script in Supabase.')
            } else if (error.message.includes('fetch failed') || error.message.includes('Network request failed')) {
                console.log('\n💡 DIAGNOSIS: Could not connect to the Supabase server. Check if the URL is correct and the server is running.')
            }
        } else {
            console.log('✅ Connection Successful!')
            if (data) {
                console.log('✅ Root user found:', data)
            } else {
                console.log('❌ Root user NOT found in database. The table exists, but the user is missing.')
                console.log('💡 DIAGNOSIS: Run the INSERT statement for the root user in "multi_tenant_setup.sql".')
            }
        }
    } catch (err) {
        console.error('❌ Unexpected Error:', err)
    }
}

testConnection()
