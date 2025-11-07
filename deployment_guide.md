# 🚀 Warehouse Management System - Backend Deployment Guide

## Phase 1: Backend + Database Setup

This guide will help you deploy the backend API to the cloud using FREE services.

---

## 📋 Prerequisites

### Software to Install on Your Computer

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/
   - Verify installation: `node --version`

2. **Git**
   - Download: https://git-scm.com/
   - Verify installation: `git --version`

3. **VS Code** (Recommended code editor)
   - Download: https://code.visualstudio.com/

---

## 🗂️ Step 1: Project Setup (Local)

### 1.1 Create Project Folder

```bash
# Create folder
mkdir warehouse-backend
cd warehouse-backend

# Initialize Git
git init
```

### 1.2 Create File Structure

Create these folders and files:

```
warehouse-backend/
├── config/
│   └── database.js
├── middleware/
│   └── auth.js
├── routes/
│   ├── auth.js
│   ├── pallets.js
│   ├── qr.js
│   ├── flo.js
│   └── analytics.js
├── database/
│   └── schema.sql
├── scripts/
│   └── setup-database.js
├── server.js
├── package.json
├── .env
├── .env.example
└── .gitignore
```

### 1.3 Copy All Code Files

Copy the code from each artifact I created into the corresponding files.

### 1.4 Install Dependencies

```bash
npm install
```

This will install all required packages.

---

## 🗄️ Step 2: Database Setup (Supabase - FREE)

### 2.1 Create Supabase Account

1. Go to: https://supabase.com/
2. Click "Start your project"
3. Sign up with GitHub or email (FREE forever)

### 2.2 Create New Project

1. Click "New Project"
2. Fill in:
   - **Name**: warehouse-db
   - **Database Password**: Create a strong password (SAVE THIS!)
   - **Region**: Choose closest to Karachi (Singapore or Mumbai)
3. Click "Create new project"
4. Wait 2-3 minutes for setup

### 2.3 Get Database Connection String

1. In Supabase dashboard, go to **Settings** (gear icon)
2. Click **Database** in sidebar
3. Scroll to **Connection string**
4. Copy the **URI** (it looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with your actual database password

### 2.4 Run Database Schema

**Option A: Using Supabase SQL Editor (Easiest)**
1. Go to **SQL Editor** in Supabase dashboard
2. Click "New query"
3. Copy entire contents of `database/schema.sql`
4. Paste and click "Run"
5. You should see "Success" message

**Option B: Using Local Script**
1. Create `.env` file in project root
2. Add your database URL:
   ```
   DATABASE_URL=your-supabase-connection-string
   JWT_SECRET=any-random-long-string-here
   PORT=3000
   ```
3. Run: `npm run setup-db`

---

## 🔐 Step 3: Generate JWT Secret

Run this command to generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and add it to your `.env` file.

---

## ▶️ Step 4: Test Locally

### 4.1 Start Server

```bash
npm start
```

You should see:
```
🚀 Server running on port 3000
✅ Database connected successfully
```

### 4.2 Test API

Open browser or use Postman:

**Health Check:**
```
GET http://localhost:3000/
```

**Login (Test Admin):**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

You should get a token back!

---

## ☁️ Step 5: Deploy to Cloud (Railway - FREE)

### 5.1 Create Railway Account

1. Go to: https://railway.app/
2. Click "Login" → "Login with GitHub"
3. Authorize Railway

### 5.2 Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. If first time: Click "Configure GitHub App"
   - Select your repositories
4. Create a new GitHub repository for your code:
   ```bash
   # In your project folder
   git add .
   git commit -m "Initial commit"
   
   # Create repo on GitHub, then:
   git remote add origin https://github.com/YOUR-USERNAME/warehouse-backend.git
   git push -u origin main
   ```

### 5.3 Deploy on Railway

1. Back in Railway, select your repository
2. Railway will auto-detect Node.js
3. Click on the deployment
4. Go to **Variables** tab
5. Add these environment variables:
   ```
   DATABASE_URL=your-supabase-connection-string
   JWT_SECRET=your-generated-secret
   NODE_ENV=production
   ```
6. Railway will automatically redeploy

### 5.4 Get Your API URL

1. Go to **Settings** tab
2. Scroll to **Domains**
3. Click "Generate Domain"
4. You'll get URL like: `https://your-app.up.railway.app`

---

## ✅ Step 6: Verify Deployment

Test your deployed API:

```
GET https://your-app.up.railway.app/
```

You should see:
```json
{
  "message": "Warehouse Management System API",
  "status": "running",
  "version": "1.0.0"
}
```

**Test Login:**
```
POST https://your-app.up.railway.app/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

---

## 🔒 Step 7: Security (IMPORTANT!)

### 7.1 Change Default Passwords

**Change Admin Password:**
```
POST https://your-app.up.railway.app/api/auth/change-password
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "oldPassword": "admin123",
  "newPassword": "your-new-secure-password"
}
```

### 7.2 Update CORS Settings

In `server.js`, update CORS origin to your future frontend URLs:
```javascript
app.use(cors({
  origin: ['https://your-admin-panel.com', 'exp://your-mobile-app'],
  credentials: true
}));
```

---

## 📊 Step 8: Test All Endpoints

### Create FLO Operator
```
POST /api/auth/register/flo
Content-Type: application/json

{
  "username": "flo_john",
  "password": "secure123",
  "fullName": "John Smith",
  "floId": "FLO001"
}
```

### Create Pallet
```
POST /api/pallets
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "palletId": "PLT001",
  "itemCode": "ITEM-001",
  "itemName": "Widget A",
  "itemQuantity": 100,
  "unitNo": "BOX",
  "weightKg": 50.5,
  "productionDate": "2024-11-01",
  "expiryDate": "2025-02-01",
  "warehouseLocation": "A-12-3"
}
```

### Generate QR Code
```
POST /api/qr/generate
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "palletId": "PLT001"
}
```

### Scan Pallet (FLO Action)
```
POST /api/pallets/PLT001/scan
Authorization: Bearer FLO_TOKEN
Content-Type: application/json

{
  "newStatus": "Picked from Production",
  "notes": "Moving to warehouse"
}
```

---

## 🎯 API Endpoints Summary

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register/admin` - Register admin
- `POST /api/auth/register/flo` - Register FLO
- `GET /api/auth/verify` - Verify token
- `POST /api/auth/change-password` - Change password

### Pallets
- `POST /api/pallets` - Create pallet (Admin)
- `GET /api/pallets` - Get all pallets
- `GET /api/pallets/:palletId` - Get single pallet
- `POST /api/pallets/:palletId/scan` - Scan pallet (update status)
- `GET /api/pallets/:palletId/history` - Get pallet history
- `PUT /api/pallets/:palletId` - Update pallet (Admin)
- `DELETE /api/pallets/:palletId` - Delete pallet (Admin)
- `GET /api/pallets/warehouse/stock` - Current warehouse stock

### QR Codes
- `POST /api/qr/generate` - Generate QR code (Admin)
- `POST /api/qr/generate-bulk` - Generate bulk QR codes (Admin)
- `GET /api/qr/:palletId` - Get QR code
- `POST /api/qr/decode` - Decode scanned QR

### FLO Operations
- `GET /api/flo/my-stats` - Get my stats (FLO)
- `POST /api/flo/shift/clock-in` - Clock in (FLO)
- `POST /api/flo/shift/clock-out` - Clock out (FLO)
- `GET /api/flo/shifts` - Get shift history (FLO)
- `GET /api/flo/all` - Get all FLOs (Admin)

### Analytics
- `GET /api/analytics/dashboard` - Dashboard overview (Admin)
- `GET /api/analytics/flo-performance` - FLO performance report (Admin)
- `GET /api/analytics/pallet-movements` - Pallet movements (Admin)
- `GET /api/analytics/warehouse-locations` - Location report (Admin)
- `GET /api/analytics/item-stock` - Item stock report (Admin)
- `GET /api/analytics/expiring-items` - Expiring items (Admin)
- `GET /api/analytics/daily-timeline` - Daily activity (Admin)

---

## 🐛 Troubleshooting

### Database Connection Failed
- Check DATABASE_URL is correct in .env
- Ensure Supabase project is active
- Check if password in connection string is correct

### Port Already in Use
- Change PORT in .env to 3001 or another port
- Or kill process using port 3000

### Module Not Found
- Run `npm install` again
- Delete node_modules and run `npm install`

### JWT Secret Missing
- Ensure JWT_SECRET is in .env file
- Generate new secret if needed

---

## 💰 Cost Breakdown

### FREE TIER (MVP)
- **Supabase**: 500MB database - FREE forever
- **Railway**: 500 hours/month - FREE (equivalent to ~20 days of 24/7 uptime)
- **Total**: $0/month

### If You Need More (Later)
- **Railway Pro**: $5/month (unlimited hours)
- **Supabase Pro**: $25/month (8GB database)

---

## 📞 Support

If you encounter issues:
1. Check server logs in Railway dashboard
2. Check database connection in Supabase
3. Verify environment variables are set correctly
4. Test endpoints with Postman/Thunder Client

---

## ✨ Next Steps

Once backend is deployed and working:
1. **Test all endpoints thoroughly**
2. **Create a few test pallets and FLO operators**
3. **Ready to proceed to Phase 2: Web Admin Panel**

---

**🎉 Congratulations! Your backend is now deployed and ready!**

Save your API URL - you'll need it for the mobile app and web panel.