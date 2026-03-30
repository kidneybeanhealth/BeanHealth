import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.log('Missing env vars');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMockPatients() {
    const { data: profiles } = await supabase.from('hospital_profiles').select('id, email, hospital_name');
    const profile = profiles?.find(p => p.email === 'kongunadkidneycentre@kkc.in');
    if (!profile) {
        console.log('Profile not found.');
        return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: queueItems } = await supabase
        .from('hospital_queues')
        .select('id, patient_id, status, created_at, patient:hospital_patients(name)')
        .eq('hospital_id', profile.id)
        .gte('created_at', startOfDay.toISOString());

    console.log(`Found ${queueItems?.length || 0} queue items for today:`);
    console.log(JSON.stringify(queueItems, null, 2));
}

checkMockPatients();
