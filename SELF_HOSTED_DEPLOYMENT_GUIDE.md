# 🏥 BeanHealth Self-Hosted Deployment Guide

## 📋 Overview

This guide explains how to deploy BeanHealth locally on the hospital's own server, keeping all patient data on-premises.

---

## 🎯 Deployment Options

### **Option 1: Self-Hosted Supabase (RECOMMENDED)**
✅ Easiest - No code changes needed  
✅ Full control over data  
✅ All features work out of the box  
⚠️ Requires Docker and some technical setup

### **Option 2: Custom PostgreSQL + Backend**
✅ Maximum flexibility  
✅ Use existing infrastructure  
⚠️ Requires significant code changes  
⚠️ Need to rebuild auth, storage, RPC functions

### **Option 3: Hybrid Approach**
✅ Use Supabase Cloud but with VPN  
⚠️ Data still on Supabase servers  
⚠️ Monthly costs apply

---

## 🚀 RECOMMENDED: Self-Hosted Supabase

### **What You'll Need:**

1. **Hardware Requirements:**
   - **Minimum:** 
     - 4 CPU cores
     - 8 GB RAM
     - 100 GB SSD storage
   - **Recommended (for hospital use):**
     - 8 CPU cores
     - 16 GB RAM
     - 500 GB SSD storage
     - Backup storage

2. **Software Requirements:**
   - Ubuntu Server 22.04 LTS (or Windows Server 2019+)
   - Docker & Docker Compose
   - Git
   - Node.js 18+

3. **Network Requirements:**
   - Static IP address (for the hospital's internal network)
   - Port 80 and 443 open for web access
   - Port 5432 for database (optional, for remote access)

---

## 📦 Step-by-Step Installation

### **Step 1: Install Docker on Server**

**For Ubuntu:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Add user to docker group
sudo usermod -aG docker $USER
```

**For Windows Server:**
- Download and install Docker Desktop for Windows
- Enable WSL2 if needed

### **Step 2: Clone Supabase Self-Hosted**

```bash
# Create directory for Supabase
mkdir ~/supabase-hospital
cd ~/supabase-hospital

# Clone the self-hosted repo
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
```

### **Step 3: Configure Environment**

```bash
# Copy example environment file
cp .env.example .env

# Generate secure passwords and secrets
# You can use: openssl rand -base64 32

# Edit the .env file
nano .env
```

**Important Environment Variables to Set:**

```bash
# Database
POSTGRES_PASSWORD=your_secure_db_password_here

# API Keys (generate strong random strings)
ANON_KEY=your_anon_key_here
SERVICE_ROLE_KEY=your_service_key_here
JWT_SECRET=your_jwt_secret_here

# Studio (Supabase Dashboard)
STUDIO_DEFAULT_ORGANIZATION=Hospital Name
STUDIO_DEFAULT_PROJECT=BeanHealth

# SMTP (for email notifications)
SMTP_ADMIN_EMAIL=admin@your-hospital.com
SMTP_HOST=smtp.your-hospital.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# URLs (use your server's IP or domain)
API_EXTERNAL_URL=http://192.168.1.100:8000
SUPABASE_PUBLIC_URL=http://192.168.1.100:8000
```

### **Step 4: Start Supabase**

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

**Services that will start:**
- PostgreSQL Database
- PostgREST API
- GoTrue (Authentication)
- Realtime Server
- Storage API
- Supabase Studio (Admin Dashboard)

### **Step 5: Access Supabase Studio**

Open browser and go to:
```
http://YOUR_SERVER_IP:3000
```

**Default credentials:**
- Email: (no default, create on first access)
- Password: (set during first access)

### **Step 6: Apply Database Migrations**

```bash
# Install Supabase CLI on your dev machine
npm install -g supabase

# Connect to your self-hosted instance
supabase db push --db-url "postgresql://postgres:YOUR_PASSWORD@YOUR_SERVER_IP:5432/postgres"
```

Or manually apply migrations:
1. Copy all files from `supabase/migrations/` folder
2. Go to Supabase Studio → SQL Editor
3. Run each migration file in order (oldest to newest)

### **Step 7: Configure BeanHealth Frontend**

On the hospital's server or workstations:

```bash
# Clone BeanHealth project
git clone https://github.com/kidneybeanhealth/BeanHealth-Jnani.git
cd BeanHealth-Jnani

# Install dependencies
npm install

# Create production environment file
nano .env.production
```

**Add to `.env.production`:**
```bash
VITE_SUPABASE_URL=http://YOUR_SERVER_IP:8000
VITE_SUPABASE_ANON_KEY=your_anon_key_from_step3
```

### **Step 8: Build and Deploy Frontend**

```bash
# Build for production
npm run build

# The build will be in the 'dist' folder
# You can serve it with:

# Option A: Simple HTTP server
npm install -g serve
serve -s dist -p 3000

# Option B: Nginx (production recommended)
sudo apt install nginx
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
```

### **Step 9: Setup Nginx (Production - Recommended)**

```bash
# Install Nginx
sudo apt install nginx

# Create config file
sudo nano /etc/nginx/sites-available/beanhealth
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;

    # Frontend
    location / {
        root /var/www/beanhealth;
        try_files $uri $uri/ /index.html;
    }

    # Supabase API proxy
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/beanhealth /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Security Hardening

### **1. Firewall Setup**
```bash
# Allow only necessary ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### **2. SSL/TLS Certificate (HTTPS)**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (if you have a domain)
sudo certbot --nginx -d beanhealth.your-hospital.local
```

### **3. Backup Strategy**

**Database Backup Script:**
```bash
#!/bin/bash
# save as: backup-database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/database"
mkdir -p $BACKUP_DIR

docker exec supabase-db pg_dump -U postgres postgres > $BACKUP_DIR/backup_$DATE.sql
gzip $BACKUP_DIR/backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

**Setup Cron Job:**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/backup-database.sh
```

### **4. User Access Control**

In Supabase Studio:
- Create separate database users for different roles
- Use Row Level Security (RLS) policies
- Regular audit of user permissions

---

## 📊 Monitoring & Maintenance

### **1. Check Service Health**
```bash
# Check all containers
docker-compose ps

# Check resource usage
docker stats

# View logs
docker-compose logs -f postgres
docker-compose logs -f kong
```

### **2. Database Maintenance**
```bash
# Vacuum database (monthly)
docker exec supabase-db psql -U postgres -c "VACUUM ANALYZE;"

# Check database size
docker exec supabase-db psql -U postgres -c "\l+"
```

### **3. Update Supabase**
```bash
cd ~/supabase-hospital/supabase/docker
git pull
docker-compose down
docker-compose up -d
```

---

## 🚨 Disaster Recovery

### **Restore from Backup**
```bash
# Stop services
cd ~/supabase-hospital/supabase/docker
docker-compose down

# Restore database
gunzip -c /backups/database/backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i supabase-db psql -U postgres postgres

# Start services
docker-compose up -d
```

---

## 📝 Checklist for Hospital IT Team

- [ ] Server with required specifications ready
- [ ] Ubuntu Server installed and updated
- [ ] Static IP configured on local network
- [ ] Docker and Docker Compose installed
- [ ] Supabase cloned and configured
- [ ] Environment variables set with secure passwords
- [ ] Database migrations applied
- [ ] BeanHealth frontend built and deployed
- [ ] Nginx configured and running
- [ ] Firewall rules applied
- [ ] SSL certificate installed (if applicable)
- [ ] Backup script created and scheduled
- [ ] Admin access credentials documented
- [ ] Staff trained on system access

---

## 💰 Cost Comparison

### **Self-Hosted:**
- **Initial:** Server hardware (~₹50,000 - ₹2,00,000)
- **Ongoing:** Electricity, maintenance (minimal)
- **Total 1st Year:** ~₹60,000 - ₹2,20,000

### **Supabase Cloud:**
- **Pro Plan:** $25/month = ~₹2,100/month
- **Total 1st Year:** ~₹25,200 + overage charges

**Conclusion:** Self-hosted is more cost-effective for hospitals long-term!

---

## 🆘 Support & Troubleshooting

### **Common Issues:**

**1. Can't access Supabase Studio:**
- Check if port 3000 is open: `sudo ufw allow 3000`
- Verify container is running: `docker-compose ps`

**2. Database connection errors:**
- Check PostgreSQL logs: `docker-compose logs postgres`
- Verify .env file has correct credentials

**3. Frontend can't connect to backend:**
- Check VITE_SUPABASE_URL in .env.production
- Verify API is accessible: `curl http://YOUR_SERVER_IP:8000/rest/v1/`

### **Get Help:**
- Supabase Self-Hosting Docs: https://supabase.com/docs/guides/self-hosting
- BeanHealth Support: (your support contact)

---

## 📞 Next Steps

1. **Schedule a Meeting** with hospital IT team
2. **Assess Infrastructure** - check if they have suitable servers
3. **Plan Installation** - allocate 1-2 days for setup
4. **Training Session** - train hospital staff on system usage
5. **Go Live** - migrate from cloud to self-hosted

**Contact us for installation support!** 🚀
