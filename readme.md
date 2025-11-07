# 📦 Warehouse Management System - Backend API

A complete backend system for warehouse inventory management with QR code tracking, forklift operator management, and real-time analytics.

## 🌟 Features

### Core Functionality
- ✅ **QR Code Generation** - Create unique QR codes for each pallet with embedded metadata
- ✅ **Pallet Tracking** - Real-time status updates through warehouse lifecycle
- ✅ **FLO Management** - Track forklift operator performance and shifts
- ✅ **Warehouse Stock** - Current inventory with location tracking
- ✅ **Analytics & Reports** - Comprehensive dashboards and performance metrics
- ✅ **Audit Trail** - Complete history of every pallet movement
- ✅ **Offline Ready** - Designed to work with offline-first mobile apps

### Security
- 🔐 JWT-based authentication
- 🔒 Role-based access control (Admin vs FLO)
- 🛡️ SQL injection prevention with parameterized queries
- 🔑 Password hashing with bcrypt
- ⚡ Secure API endpoints with middleware protection

## 🏗️ Tech Stack

- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **QR Codes**: qrcode library
- **Security**: helmet, bcrypt, cors

## 📁 Project Structure

```
warehouse-backend/
├── config/
│   └── database.js          # PostgreSQL connection pool
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── routes/
│   ├── auth.js              # Login, register, password management
│   ├── pallets.js           # Pallet CRUD and scanning operations
│   ├── qr.js                # QR code generation and decoding
│   ├── flo.js               # FLO operator stats and shifts
│   └── analytics.js         # Reports and analytics endpoints
├── database/
│   └── schema.sql           # Database schema and initial setup
├── scripts/
│   └── setup-database.js    # Automated database initialization
├── server.js                # Main application entry point
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables (not in git)
├── .env.example             # Environment template
└── .gitignore              # Git ignore rules
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone repository
git clone <your-repo-url>
cd warehouse-backend

# Install dependencies
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/warehouse_db
JWT_SECRET=your-super-secret-key
FRONTEND_URL=http://localhost:3000
```

### 3. Setup Database

```bash
npm run setup-db
```

This creates all tables and default admin user.

### 4. Start Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Server runs on http://localhost:3000

## 📖 API Documentation

### Base URL
```
Local: http://localhost:3000
Production: https://your-app.railway.app
```

### Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <your-token>
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "fullName": "System Administrator",
    "role": "admin"
  }
}
```

#### Register FLO Operator
```http
POST /api/auth/register/flo
Content-Type: application/json

{
  "username": "flo_john",
  "password": "secure123",
  "fullName": "John Smith",
  "floId": "FLO001"
}
```

### Pallets

#### Create Pallet (Admin Only)
```http
POST /api/pallets
Authorization: Bearer <admin-token>
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
  "warehouseLocation": "A-12-3",
  "destination": "Customer XYZ"
}
```

#### Scan Pallet (Update Status)
```http
POST /api/pallets/PLT001/scan
Authorization: Bearer <token>
Content-Type: application/json

{
  "newStatus": "At Warehouse",
  "warehouseLocation": "A-12-3",
  "notes": "Placed in zone A"
}
```

**Valid Statuses:**
- `At Production`
- `Picked from Production`
- `In Transit to Warehouse`
- `At Warehouse`
- `Picked for Delivery`
- `Out for Delivery`
- `Delivered`

#### Get All Pallets
```http
GET /api/pallets?status=At%20Warehouse&limit=50&offset=0
Authorization: Bearer <token>
```

#### Get Pallet History
```http
GET /api/pallets/PLT001/history
Authorization: Bearer <token>
```

### QR Codes

#### Generate QR Code (Admin Only)
```http
POST /api/qr/generate
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "palletId": "PLT001"
}

Response:
{
  "message": "QR code generated successfully",
  "palletId": "PLT001",
  "qrCode": "data:image/png;base64,iVBOR...",
  "metadata": { ... }
}
```

#### Generate Bulk QR Codes
```http
POST /api/qr/generate-bulk
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "palletIds": ["PLT001", "PLT002", "PLT003"]
}
```

### FLO Operations

#### Get My Stats (FLO Dashboard)
```http
GET /api/flo/my-stats
Authorization: Bearer <flo-token>
```

#### Clock In
```http
POST /api/flo/shift/clock-in
Authorization: Bearer <flo-token>
Content-Type: application/json

{
  "shiftType": "morning"
}
```

**Shift Types:** `morning`, `afternoon`, `night`

#### Clock Out
```http
POST /api/flo/shift/clock-out
Authorization: Bearer <flo-token>
```

### Analytics (Admin Only)

#### Dashboard Overview
```http
GET /api/analytics/dashboard
Authorization: Bearer <admin-token>
```

#### FLO Performance Report
```http
GET /api/analytics/flo-performance?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin-token>
```

#### Expiring Items
```http
GET /api/analytics/expiring-items?days=30
Authorization: Bearer <admin-token>
```

## 🗄️ Database Schema

### Tables

1. **users** - Admin and FLO operator accounts
2. **pallets** - Main pallet inventory
3. **pallet_scans** - Audit trail of all scans/movements
4. **shifts** - FLO work shifts and clock in/out

### Key Relationships

- One pallet has many scans (audit trail)
- One FLO has many scans
- One FLO has many shifts

## 🔒 Security Best Practices

1. ✅ Always use HTTPS in production
2. ✅ Change default admin password immediately
3. ✅ Keep JWT_SECRET secure and never commit to git
4. ✅ Use strong passwords (min 8 characters for admin, 6 for FLO)
5. ✅ Regularly update dependencies
6. ✅ Enable rate limiting in production (add express-rate-limit)
7. ✅ Monitor database access logs

## 📊 Database Indexes

Optimized queries for:
- Pallet status lookups
- Warehouse location searches
- FLO operator activity
- Date-based scan queries

## 🧪 Testing Endpoints

Use Postman, Thunder Client, or curl to test:

```bash
# Health check
curl http://localhost:3000/

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get pallets (replace TOKEN)
curl http://localhost:3000/api/pallets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🚢 Deployment

See **DEPLOYMENT_GUIDE.md** for detailed deployment instructions.

### Quick Deploy Links
- **Database**: [Supabase](https://supabase.com) (FREE)
- **Backend**: [Railway](https://railway.app) (FREE tier available)

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 3000 |
| NODE_ENV | Environment | development/production |
| DATABASE_URL | PostgreSQL connection | postgresql://user:pass@host/db |
| JWT_SECRET | Token signing secret | random-64-char-string |
| FRONTEND_URL | CORS allowed origin | http://localhost:3000 |

## 🐛 Common Issues

### Database Connection Error
- Verify DATABASE_URL is correct
- Check database server is running
- Ensure SSL settings match your database provider

### JWT Token Invalid
- Check JWT_SECRET is same across restarts
- Verify token hasn't expired (7 day default)
- Ensure Authorization header format: `Bearer <token>`

### Permission Denied
- Verify user role (admin vs flo)
- Check token is valid and not expired
- Ensure route requires correct role

## 🔄 API Response Format

### Success Response
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error message describing what went wrong"
}
```

### Pagination Response
```json
{
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

## 📦 npm Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run setup-db   # Initialize database schema and default users
```

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## 📄 License

MIT License - feel free to use for your warehouse operations!

## 👨‍💻 Author

Built for efficient warehouse management with love ❤️

## 🆘 Support

For issues or questions:
1. Check DEPLOYMENT_GUIDE.md
2. Review API documentation above
3. Check server logs for errors
4. Verify environment variables

---

**Happy Warehousing! 📦🚀**