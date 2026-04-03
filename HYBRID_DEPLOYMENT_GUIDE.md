# 🔄 Hybrid Deployment: Cloud App + Local Patient Data

## 📋 Overview

Keep BeanHealth deployed on cloud (Vercel/current hosting) but store **only patient data** on hospital's local server.

---

## ⚠️ **IMPORTANT CONSIDERATIONS**

### **Pros:**
- ✅ App updates are easy (deploy to cloud as usual)
- ✅ No need to manage app hosting on-premises
- ✅ Patient data stays on hospital server

### **Cons:**
- ❌ **Complex architecture** - two databases to manage
- ❌ **Sync issues** - potential data conflicts
- ❌ **Performance** - extra network hops
- ❌ **Authentication complexity** - where do users log in?
- ❌ **Requires code changes** - need to modify database logic
- ❌ **More expensive** - cloud costs + local server costs

### **Verdict:**
⚠️ **Not Recommended** unless you have specific regulatory requirements. Full self-hosting is simpler and more reliable.

---

## 🎯 Hybrid Architecture Options

### **Option A: Database Federation (RECOMMENDED if hybrid is needed)**

```
┌─────────────────┐
│  Cloud (Vercel) │
│   - Frontend    │
│   - API Layer   │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
┌───▼────┐  ┌──▼──────────────┐
│ Cloud  │  │ Hospital Server │
│ Supabase│  │  - PostgreSQL   │
│ - Auth  │  │  - Patient Data │
│ - Users │  │  - Prescriptions│
│ - Audit │  │  - Queue        │
└────────┘  └─────────────────┘
```

**How It Works:**
1. Main Supabase stays in cloud (handles auth, users, audit logs)
2. Hospital runs PostgreSQL server locally
3. Use **Foreign Data Wrapper (FDW)** to connect databases
4. Patient tables are on local server
5. Cloud Supabase queries local server when needed

**Implementation Steps:**

#### **Step 1: Setup Local PostgreSQL Server**

```bash
# On hospital server
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb beanhealth_local

# Create user
sudo -u postgres psql
CREATE USER beanhealth WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE beanhealth_local TO beanhealth;
```

#### **Step 2: Apply Patient Data Migrations**

Copy these tables to local server:
- `hospital_patients`
- `hospital_prescriptions`
- `hospital_queues`
- `hospital_patient_reviews`

```bash
# Export schema from cloud Supabase
pg_dump -h your-cloud-db.supabase.co -U postgres \
  --schema-only \
  -t hospital_patients \
  -t hospital_prescriptions \
  -t hospital_queues \
  -t hospital_patient_reviews \
  > patient_schema.sql

# Import to local server
psql -h localhost -U beanhealth -d beanhealth_local < patient_schema.sql
```

#### **Step 3: Setup Foreign Data Wrapper on Cloud Supabase**

In Supabase Studio → SQL Editor:

```sql
-- Enable postgres_fdw extension
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Create server connection to hospital's database
CREATE SERVER hospital_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host 'HOSPITAL_SERVER_IP', port '5432', dbname 'beanhealth_local');

-- Create user mapping (credentials to access hospital DB)
CREATE USER MAPPING FOR CURRENT_USER
  SERVER hospital_server
  OPTIONS (user 'beanhealth', password 'secure_password');

-- Import foreign schema (patient tables)
IMPORT FOREIGN SCHEMA public
  LIMIT TO (hospital_patients, hospital_prescriptions, hospital_queues, hospital_patient_reviews)
  FROM SERVER hospital_server
  INTO public;
```

#### **Step 4: Expose Hospital Server to Cloud**

⚠️ **CRITICAL SECURITY REQUIREMENT:**

```bash
# On hospital server - setup VPN or secure tunnel
# Option A: WireGuard VPN (Recommended)
sudo apt install wireguard

# Option B: SSH Tunnel
ssh -L 5432:localhost:5432 user@cloud-server

# Option C: Expose with strict firewall
sudo ufw allow from SUPABASE_CLOUD_IP to any port 5432
```

**Security Best Practices:**
- ✅ Use VPN (WireGuard or OpenVPN)
- ✅ Whitelist only Supabase's IP addresses
- ✅ Use SSL/TLS for database connections
- ✅ Strong passwords and key-based auth
- ❌ Never expose port 5432 publicly without encryption

---

### **Option B: API Gateway Pattern**

```
┌──────────────┐
│ Cloud Vercel │
│  - Frontend  │
└──────┬───────┘
       │
   ┌───┴────┐
   │        │
┌──▼──────┐ │
│ Cloud   │ │
│Supabase │ │
│- Auth   │ │
└─────────┘ │
            │
        ┌───▼────────────────┐
        │ Hospital API Server│
        │  - Express/Fastify │
        │  - PostgreSQL      │
        │  - Patient Data    │
        └────────────────────┘
```

**How It Works:**
1. Frontend stays on Vercel
2. Create custom API on hospital server
3. Frontend routes patient data requests to hospital API
4. Non-patient data goes to cloud Supabase

**Code Changes Required:**

**Frontend (Conditional Database Client):**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// Cloud Supabase (for auth, users, etc.)
export const supabaseCloud = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Hospital API (for patient data)
const HOSPITAL_API_URL = import.meta.env.VITE_HOSPITAL_API_URL || 'https://hospital-api.local';

export const hospitalAPI = {
  async getPatients(hospitalId: string) {
    const res = await fetch(`${HOSPITAL_API_URL}/patients?hospital_id=${hospitalId}`);
    return res.json();
  },
  
  async createPrescription(data: any) {
    const res = await fetch(`${HOSPITAL_API_URL}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
  
  // ... more API methods
};
```

**Hospital API Server (Express):**

```javascript
// hospital-api/server.js
const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  host: 'localhost',
  database: 'beanhealth_local',
  user: 'beanhealth',
  password: 'secure_password'
});

// Get patients
app.get('/patients', async (req, res) => {
  const { hospital_id } = req.query;
  const result = await pool.query(
    'SELECT * FROM hospital_patients WHERE hospital_id = $1',
    [hospital_id]
  );
  res.json(result.rows);
});

// Create prescription
app.post('/prescriptions', async (req, res) => {
  const { patient_id, medications, notes } = req.body;
  const result = await pool.query(
    'INSERT INTO hospital_prescriptions (patient_id, medications, notes) VALUES ($1, $2, $3) RETURNING *',
    [patient_id, medications, notes]
  );
  res.json(result.rows[0]);
});

app.listen(3001, () => console.log('Hospital API running on port 3001'));
```

**Deployment:**
```bash
# On hospital server
cd hospital-api
npm install express pg cors
node server.js
```

---

### **Option C: Database Replication**

Keep both databases in sync using PostgreSQL replication.

```
┌──────────────────┐
│   Cloud Supabase │ ← Master
│  (All Data)      │
└────────┬─────────┘
         │
         │ Replication
         ▼
┌────────────────────┐
│  Hospital Server   │ ← Replica (Read-only)
│  (Patient Data)    │
└────────────────────┘
```

**Cons:**
- Data still on cloud (defeats the purpose)
- Local is read-only replica
- Not suitable if goal is data sovereignty

---

## 🚫 **Why Hybrid is Complicated**

### **1. Row Level Security (RLS) Issues**

Your app uses RLS policies extensively:

```sql
-- This policy checks hospital_id from auth context
CREATE POLICY "Users can only see their hospital's patients"
ON hospital_patients
USING (hospital_id = auth.uid()::uuid);
```

**Problem:** If patient data is on separate database:
- Auth context (auth.uid()) won't work on local DB
- Need to pass hospital_id manually in every query
- Security becomes your responsibility (not Supabase's)

### **2. Foreign Key Constraints**

```sql
-- Prescription references patient
ALTER TABLE hospital_prescriptions
ADD CONSTRAINT fk_patient
FOREIGN KEY (patient_id) REFERENCES hospital_patients(id);
```

**Problem:** Foreign keys don't work across databases
- Need to manually enforce referential integrity
- Risk of orphaned records

### **3. Real-Time Subscriptions**

```typescript
// This won't work with hybrid setup
supabase
  .from('hospital_patients')
  .on('INSERT', payload => {
    console.log('New patient', payload);
  })
  .subscribe();
```

**Problem:** Supabase realtime only works for tables in cloud database

### **4. Authentication Complexity**

- Users authenticate with cloud Supabase
- Hospital API needs to verify JWT tokens from cloud
- Additional security layer to implement

---

## 💡 **RECOMMENDED APPROACH**

### **If data sovereignty is the concern:**

**✅ Go Full Self-Hosted** (see `SELF_HOSTED_DEPLOYMENT_GUIDE.md`)

**Why:**
1. Simpler architecture
2. No code changes needed
3. All data local (true data sovereignty)
4. Lower ongoing costs
5. Better performance (no network latency)
6. Easier to maintain

### **If you still want hybrid:**

**✅ Use Option A (Foreign Data Wrapper)**

**But you'll need:**
1. VPN connection between cloud and hospital
2. Modify RLS policies
3. Handle connection failures gracefully
4. Monitor both databases
5. Budget for both cloud + local server

---

## 📊 Complexity Comparison

| Approach | Code Changes | Setup Time | Maintenance | Cost |
|----------|--------------|------------|-------------|------|
| **Full Self-Hosted** | None | 1 day | Low | Low |
| **Hybrid (FDW)** | Medium | 2-3 days | High | Medium |
| **Hybrid (API Gateway)** | High | 3-5 days | Very High | High |
| **Current Cloud** | None | 0 | None | Medium |

---

## 🎯 My Recommendation

**For Hospitals:**
1. **Start with Full Self-Hosted** - It's simpler and cheaper
2. **If that's not possible** - Use Foreign Data Wrapper approach
3. **Avoid API Gateway** - Too complex to maintain

**For Testing/Trial:**
- Keep current cloud setup
- Later migrate to self-hosted when ready

---

## 📞 Next Steps

1. **Discuss with hospital** - What's the real concern?
   - Data privacy? → Full self-hosted
   - Cost? → Full self-hosted
   - Convenience? → Stay on cloud

2. **Assess infrastructure**
   - Do they have IT team?
   - Do they have servers?
   - Can they maintain it?

3. **Choose approach:**
   - **Recommended:** Full self-hosted
   - **If must hybrid:** Foreign Data Wrapper

**Need help deciding? Happy to discuss!** 🚀
