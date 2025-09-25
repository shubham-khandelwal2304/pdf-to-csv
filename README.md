# PDF to CSV Converter

A production-ready web application that converts PDF files to CSV format using an n8n workflow backend. Features a modern React frontend with Tailwind CSS and a robust Node.js/Express backend with local file storage.

## ✨ Features

- 🎨 **Modern UI**: Beautiful Tailwind CSS interface with gradient backgrounds and glass-morphism effects
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- 🔄 **Drag & Drop Upload**: Intuitive file upload with visual feedback
- ⚡ **Real-time Status**: Live progress tracking and status updates
- 🗄️ **Local Storage**: No external dependencies - files stored locally
- 🔒 **Secure**: File validation, CORS protection, and error handling
- 🚀 **Production Ready**: Complete with testing, linting, and CI/CD

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React SPA     │───▶│  Express API    │───▶│   n8n Workflow  │───▶│ Local Storage   │
│  (Tailwind CSS) │    │                 │    │                 │    │                 │
│ • Drag & Drop   │    │ • File Upload   │    │ • PDF → CSV     │    │ • CSV Files     │
│ • Status Poll   │    │ • Job Tracking  │    │ • Conversion    │    │ • Direct Serve  │
│ • Download      │    │ • File Serving  │    │ • Callback      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn  
- n8n instance (self-hosted or cloud)
- Optional: Cloudflare R2 account (for cloud storage alternative)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd pdf2csv

# Install root dependencies (includes concurrently for running both servers)
npm install

# Install all dependencies for both apps
npm run install:all

# Or install individually
npm run install:backend
npm run install:frontend
```

### 2. Configure Environment

#### Backend Configuration
Create `backend/.env`:
```env
# Server Configuration
PORT=8080
ALLOWED_ORIGIN=http://localhost:5173

# Base URL for file downloads (used by local storage)
BASE_URL=http://localhost:8080

# n8n Configuration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/pdf-to-csv
CALLBACK_SECRET=your-secure-secret-here

# Optional: Cloudflare R2 Configuration (if you want cloud storage)
# R2_ACCOUNT_ID=your-r2-account-id
# R2_ACCESS_KEY_ID=your-r2-access-key
# R2_SECRET_ACCESS_KEY=your-r2-secret-key
# R2_BUCKET=pdf2csv
# R2_ENDPOINT=https://your-r2-account-id.r2.cloudflarestorage.com
# R2_PRESIGN_EXPIRES_SECONDS=3600
```

#### Frontend Configuration
Create `frontend/.env`:
```env
# API Configuration
VITE_API_BASE=http://localhost:8080
```

### 3. Run Development Servers

```bash
# Run both frontend and backend together (recommended)
npm run dev

# Or run individually in separate terminals
npm run dev:backend  # Backend on http://localhost:8080
npm run dev:frontend # Frontend on http://localhost:5173
```

### 4. Access the Application

- **Frontend (UI)**: http://localhost:5173
- **Backend (API)**: http://localhost:8080
- **Health Check**: http://localhost:8080/health

## 🎨 Frontend Features

### Modern UI with Tailwind CSS
- **Beautiful Design**: Gradient backgrounds with glass-morphism effects
- **Responsive Layout**: Mobile-first design that works on all devices
- **Interactive Elements**: Smooth hover effects and animations
- **Drag & Drop**: Intuitive file upload with visual feedback
- **Status Indicators**: Real-time progress bars and status updates

### Tailwind CSS Configuration
The frontend uses Tailwind CSS v3 with custom configuration:
- Custom color palette for consistent branding
- Extended animations for progress indicators
- Component classes for buttons and alerts
- Responsive breakpoints for mobile optimization

## 💾 Storage Options

By default, the application uses **local file storage** for CSV files. This is the simplest option and works great for single-server deployments.

### Local Storage (Default)
- ✅ No external dependencies or accounts needed
- ✅ Simple setup and deployment
- ✅ Direct file serving through Express
- ✅ Immediate availability after conversion
- ❌ Files lost on server restart/redeploy
- ❌ Not suitable for multi-instance deployments

**How it works:**
- CSV files stored in `backend/storage/csv/`
- Served via `/api/files/download/:encodedKey`
- Automatic cleanup of old files (24h TTL)

### Alternative: Cloudflare R2
If you need cloud storage, you can switch to Cloudflare R2:

1. Uncomment R2 variables in `backend/.env`
2. Replace `localStorageClient` imports with `r2Client` in:
   - `backend/src/routes/callback.js`
   - `backend/src/routes/jobs.js`
3. Remove the `/api/files` route from `server.js`

### Other Cloud Storage Options
- **AWS S3**: Use the existing R2Client (same AWS SDK)
- **Google Cloud Storage**: Implement with `@google-cloud/storage`
- **Database Storage**: Store CSV content in PostgreSQL BLOB fields

## 🔧 n8n Workflow Setup

### Workflow Overview

Your n8n workflow needs these components:

1. **Webhook Trigger** - Receives PDF + jobId from backend
2. **Your PDF Processing Nodes** - Convert PDF to CSV (your existing logic)
3. **HTTP Request Node** - Send CSV back to backend

### Step 1: Configure Webhook Trigger

1. Add a **Webhook** node as your workflow trigger
2. Set the webhook path: `/pdf-to-csv`
3. HTTP Method: `POST`
4. Response Mode: `Respond Immediately`

The webhook will receive:
- `file`: PDF file (binary)
- `jobId`: String identifier for tracking

### Step 2: Add Your PDF → CSV Processing

Insert your existing PDF processing nodes here. The workflow should:
- Process the uploaded PDF file
- Convert it to CSV format
- Ensure the final CSV is available as binary data

### Step 3: Configure Callback HTTP Request

Add an **HTTP Request** node at the end of your workflow:

**Basic Settings:**
- Method: `POST`
- URL: `https://your-backend-domain.com/api/n8n/callback`
- Send Binary Data: `✅ ON`
- Binary Property: `csv`

**Headers:**
```
X-Job-Id: {{$json.jobId}}
X-Callback-Secret: your-secure-secret-here
```

**Authentication:** None (secured by callback secret)

### Step 4: Error Handling (Optional)

For better error handling, add an **HTTP Request** node on error paths:

- Method: `POST`
- URL: `https://your-backend-domain.com/api/n8n/error`
- Headers:
  ```
  X-Job-Id: {{$json.jobId}}
  X-Callback-Secret: your-secure-secret-here
  ```
- Body (JSON):
  ```json
  {
    "error": "PDF processing failed",
    "details": "{{$json.error}}"
  }
  ```

### Example Workflow Structure

```
[Webhook] → [PDF Processing] → [HTTP Request: Success]
     │                              ↑
     └── [On Error] → [HTTP Request: Error]
```

## 📁 Project Structure

```
pdf2csv/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── server.js       # Main server file
│   │   ├── routes/         # API routes
│   │   │   ├── jobs.js     # Job management endpoints
│   │   │   ├── callback.js # n8n callback endpoints
│   │   │   └── files.js    # File download endpoints
│   │   ├── services/       # Business logic
│   │   │   ├── jobStore.js # In-memory job storage
│   │   │   ├── n8nClient.js# n8n webhook client
│   │   │   ├── r2Client.js # Cloudflare R2 client (optional)
│   │   │   └── localStorageClient.js # Local file storage
│   │   ├── middleware/     # Express middleware
│   │   │   └── errors.js   # Error handling
│   │   └── utils/          # Utilities
│   │       └── ids.js      # ID generation
│   ├── tests/              # Unit tests
│   ├── tmp/                # Temporary file storage
│   ├── storage/csv/        # Local CSV file storage (gitignored)
│   └── package.json
├── frontend/               # React SPA
│   ├── src/
│   │   ├── App.jsx         # Main app component
│   │   ├── api.js          # API client
│   │   └── components/     # React components
│   │       ├── Uploader.jsx    # Drag & drop uploader
│   │       └── StatusBar.jsx   # Status display
│   └── package.json
├── .github/workflows/      # CI/CD
├── package.json           # Monorepo root
└── README.md
```

## 🔌 API Endpoints

### Job Management

#### `POST /api/jobs`
Upload PDF and start conversion.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (PDF file, max 20MB)

**Response:**
```json
{
  "jobId": "abc123def456",
  "message": "PDF uploaded and processing started",
  "filename": "document.pdf"
}
```

#### `GET /api/jobs/:jobId/status`
Get job status.

**Response:**
```json
{
  "jobId": "abc123def456",
  "status": "processing|done|error",
  "ready": false,
  "filename": "document.pdf",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:30.000Z"
}
```

#### `GET /api/jobs/:jobId/download-url`
Get download URL (only when status is 'done').

**Response:**
```json
{
  "url": "http://localhost:8080/api/files/download/jobs%2Fjob123%2F1234567-document.csv",
  "filename": "document.csv",
  "expiresInSeconds": 3600
}
```

### File Downloads

#### `GET /api/files/download/:encodedKey`
Download CSV file directly.

**Parameters:**
- `encodedKey`: URL-encoded file key

**Response:**
- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="document.csv"`
- File stream

### n8n Callbacks

#### `POST /api/n8n/callback`
Receive CSV from n8n workflow.

**Headers:**
- `X-Job-Id`: Job identifier
- `X-Callback-Secret`: Authentication secret

**Request:**
- Content-Type: `multipart/form-data`
- Body: `csv` (CSV file)

#### `POST /api/n8n/error`
Receive error notifications from n8n.

**Headers:**
- `X-Job-Id`: Job identifier  
- `X-Callback-Secret`: Authentication secret

**Body:**
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd backend
npm test

# Run tests with coverage
npm test -- --coverage

# Watch mode for development
npm run test:watch
```

### Test Structure

- `tests/jobStore.test.js` - Job storage functionality
- `tests/localStorageClient.test.js` - Local storage client functionality  
- `tests/r2Client.test.js` - R2 client with mocked AWS SDK (optional)
- `tests/ids.test.js` - ID generation and validation

### Frontend Testing
The frontend includes ESLint configuration for code quality:
```bash
cd frontend
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run build       # Test production build
```

### Manual Testing with cURL

#### Upload a PDF:
```bash
curl -X POST http://localhost:8080/api/jobs \
  -F "file=@test-document.pdf" \
  -v
```

#### Check job status:
```bash
curl http://localhost:8080/api/jobs/YOUR_JOB_ID/status
```

#### Simulate n8n callback:
```bash
curl -X POST http://localhost:8080/api/n8n/callback \
  -H "X-Job-Id: YOUR_JOB_ID" \
  -H "X-Callback-Secret: your-secret" \
  -F "csv=@test-output.csv" \
  -v
```

## 🚀 Deployment

### Local Development

```bash
# Backend
cd backend && npm run dev

# Frontend  
cd frontend && npm run dev
```

### Production Deployment

#### Backend (Railway/Render/Fly.io)

1. Deploy backend with environment variables
2. Ensure HTTPS is enabled
3. Set `ALLOWED_ORIGIN` to your frontend domain
4. Configure n8n webhook URL to point to your backend

#### Frontend (Vercel/Netlify)

1. Build and deploy frontend
2. Set `VITE_API_BASE` to your backend URL
3. Ensure CORS is configured on backend

#### Cloudflare R2 Setup

1. Create R2 bucket
2. Generate API tokens with R2 permissions
3. Configure CORS if needed for direct access
4. Set up custom domain (optional)

#### n8n Configuration

1. Update webhook URL to production backend
2. Set callback secret environment variable
3. Test webhook connectivity
4. Monitor workflow execution

## 🔍 Troubleshooting

### Common Issues

#### Tailwind CSS Not Working
**Problem:** Frontend shows unstyled HTML instead of beautiful design

**Solutions:**
- ✅ Hard refresh browser: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- ✅ Clear browser cache for localhost:5173
- ✅ Open in incognito/private browsing mode
- ✅ Check that config files use `.cjs` extension: `tailwind.config.cjs`, `postcss.config.cjs`
- ✅ Verify build process: `cd frontend && npm run build` should succeed

#### "Internal Server Error" on Upload
**Problem:** File upload fails with generic error message

**Solutions:**
- ✅ Ensure both `.env` files exist (backend and frontend)
- ✅ Check that both servers are running (backend on :8080, frontend on :5173)
- ✅ Only upload PDF files (other file types are rejected)
- ✅ Open browser developer console (F12) for specific error messages
- ✅ Restart both servers after environment changes: `npm run dev`

#### CORS Errors
**Problem:** Frontend can't reach backend API
```
Access to fetch blocked by CORS policy
```

**Solutions:**
- ✅ Check `ALLOWED_ORIGIN` in `backend/.env` matches frontend URL exactly
- ✅ Ensure no trailing slashes: `http://localhost:5173` not `http://localhost:5173/`
- ✅ Restart backend after changing CORS settings
- ✅ In production, set frontend domain: `https://yourapp.vercel.app`

#### PostCSS Configuration Errors
**Problem:** Build fails with "module is not defined" error

**Solutions:**
- ✅ Ensure config files use `.cjs` extension (not `.js`)
- ✅ Remove any duplicate config files
- ✅ Use `module.exports` instead of `export default` in config files

#### File Upload Fails
**Problem:** "Multipart: Boundary not found" error

**Solutions:**
- ✅ Check file size (max 20MB)
- ✅ Verify file type is `application/pdf`
- ✅ Ensure `backend/storage/csv/` directory exists
- ✅ Check backend logs for specific error details

#### Job Stuck in Processing
**Problem:** Upload succeeds but job never completes

**Solutions:**
- ✅ Check n8n workflow execution logs
- ✅ Verify n8n webhook URL is reachable
- ✅ Confirm callback secret matches between backend and n8n
- ✅ Test n8n callback endpoint manually

### Debug Mode

Enable debug logging:

```bash
# Backend
NODE_ENV=development npm run dev

# Check logs for detailed error information
```

### Health Checks

```bash
# Backend health
curl http://localhost:8080/health

# n8n webhook health (from backend)
# Check logs for n8n connectivity status
```

## 📊 Monitoring

### Job Statistics

In development mode, access job statistics:

```bash
curl http://localhost:8080/api/jobs
```

Returns:
```json
{
  "stats": {
    "total": 10,
    "processing": 2,
    "done": 7,
    "error": 1
  },
  "jobs": [...]
}
```

### Performance Considerations

- **Memory Usage**: In-memory job store grows with usage
  - Consider Redis/MongoDB for production scale
  - Jobs auto-cleanup after 24 hours

- **File Storage**: Temporary files in `tmp/`
  - Auto-cleanup on success/error
  - Monitor disk space

- **R2 Costs**: Presigned URLs regenerated on each request
  - Consider caching URLs with TTL
  - Monitor R2 API usage

## 🔒 Security

- PDF uploads restricted to 20MB
- File type validation (application/pdf only)
- Callback authentication via secret header
- CORS restrictions
- No sensitive data in error messages (production)
- Presigned URLs with expiration
- Temporary file cleanup

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📞 Support

For issues and questions:
1. Check this README and troubleshooting section
2. Review GitHub issues
3. Create a new issue with detailed information

---

## 📋 Example Commands for Testing

### Local Development Setup
```bash
# 1. Clone and setup
git clone <your-repo>
cd pdf2csv
npm install

# 2. Create environment files
echo 'ALLOWED_ORIGIN=http://localhost:5173
BASE_URL=http://localhost:8080
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/pdf-to-csv
CALLBACK_SECRET=your-secure-secret' > backend/.env

echo 'VITE_API_BASE=http://localhost:8080' > frontend/.env

# 3. Install dependencies and run
npm run install:all
npm run dev
```

### Testing API Endpoints
```bash
# Health check
curl http://localhost:8080/health

# Upload PDF (PowerShell)
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/jobs" -Method POST -Form @{file=Get-Item "test.pdf"}
$jobData = $response.Content | ConvertFrom-Json
echo "Job ID: $($jobData.jobId)"

# Check status
curl "http://localhost:8080/api/jobs/YOUR_JOB_ID/status"

# Get download URL (when ready)
curl "http://localhost:8080/api/jobs/YOUR_JOB_ID/download-url"
```

### Frontend Access
- **Application**: http://localhost:5173
- **Features**: Beautiful Tailwind CSS UI, drag & drop upload, real-time status updates
- **Mobile Friendly**: Responsive design works on all devices

---

Built with ❤️ using React, Tailwind CSS, Node.js, Express, and n8n.
#   p d f - t o - c s v  
 