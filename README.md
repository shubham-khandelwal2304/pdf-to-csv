# PDF to CSV Converter

A production-ready web application that converts PDF files to CSV format using an n8n workflow. Built with React frontend and Node.js/Express backend, storing files in MongoDB.

## 🏗️ Architecture

```
Frontend (React) → Backend (Node.js/Express) → n8n Workflow → MongoDB (GridFS)
     ↓                        ↑                                      ↓
PDF Upload              CSV Callback                         File Storage
Job Status              File Download                        Download URLs
```

## 🚀 Features

- **Drag & Drop PDF Upload**: Modern React interface with file validation
- **Real-time Job Tracking**: Live status updates during conversion
- **MongoDB Storage**: Secure file storage using GridFS
- **n8n Integration**: Powerful workflow automation for PDF processing
- **Download Management**: Secure file downloads with proper headers
- **Error Handling**: Comprehensive error handling and user feedback
- **Responsive Design**: Mobile-friendly UI built with Tailwind CSS

## 📋 Prerequisites

- **Node.js**: v16 or higher
- **MongoDB**: v4.4 or higher (local or cloud)
- **n8n**: Running instance with webhook access
- **npm**: Package manager

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd pdf2csv

# Install all dependencies
npm install
```

### 2. Setup MongoDB

**Option A: Local MongoDB**
```bash
# Install MongoDB locally
# Windows: Download from https://www.mongodb.com/try/download/community
# macOS: brew install mongodb-community
# Linux: Follow MongoDB installation guide

# Start MongoDB service
mongod
```

**Option B: MongoDB Atlas (Cloud)**
1. Create account at https://cloud.mongodb.com
2. Create a new cluster
3. Get connection string
4. Replace `localhost:27017` in environment variables

### 3. Configure Environment Variables

**Backend (.env):**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
# Server Configuration
PORT=8080
NODE_ENV=development

# CORS Configuration  
ALLOWED_ORIGIN=http://localhost:5174

# Base URL for file serving
BASE_URL=http://localhost:8080

# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=pdf2csv

# n8n Configuration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/pdf-to-csv
CALLBACK_SECRET=your-secret-key-here
```

**Frontend (.env):**
```bash
cd frontend
echo "VITE_API_BASE=http://localhost:8080" > .env
```

### 4. Setup n8n Workflow

Your n8n workflow needs these nodes in sequence:

1. **Webhook Trigger**
   - HTTP Method: `POST`
   - Path: `pdf-to-csv`
   - Response Mode: `On Received`

2. **Your PDF Processing Nodes**
   - Add your PDF to CSV conversion logic here
   - Ensure the final output is a CSV file

3. **Respond to Webhook** (Required)
   - Response Code: `200`
   - Response Body: `{"status": "success"}`

4. **HTTP Request** (Callback)
   - Method: `POST`
   - URL: `http://YOUR_IP:8080/api/n8n/callback`
   - Headers:
     - `X-Job-Id`: `{{$json.jobId}}`
     - `X-Callback-Secret`: `your-secret-key-here`
   - Body: Form-Data with CSV file
   - Parameter Type: `n8n Binary File`
   - Name: `csv`
   - Input Data Field Name: `data`

### 5. Start the Application

```bash
# Start both frontend and backend
npm run dev
```

This starts:
- Frontend: http://localhost:5174
- Backend: http://localhost:8080

## 🔧 API Endpoints

### Job Management
- `POST /api/jobs` - Upload PDF and create job
- `GET /api/jobs/:jobId/status` - Get job status
- `GET /api/jobs/:jobId/download-url` - Get download URL

### File Downloads
- `GET /api/files/download/:fileId` - Download CSV file
- `GET /api/files/health` - MongoDB health check
- `GET /api/files/stats` - Storage statistics (dev only)

### n8n Integration
- `POST /api/n8n/callback` - Receive CSV from n8n
- `POST /api/n8n/error` - Error notifications from n8n
- `GET /api/n8n/health` - Health check

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test

# Run all tests
npm test
```

## 🚀 Production Deployment

### Environment Setup
```env
NODE_ENV=production
MONGODB_URL=mongodb://your-production-db:27017
N8N_WEBHOOK_URL=https://your-n8n-production.com/webhook/pdf-to-csv
ALLOWED_ORIGIN=https://your-frontend-domain.com
BASE_URL=https://your-backend-domain.com
```

### Build and Deploy
```bash
# Build frontend
cd frontend
npm run build

# Start production server
cd backend
npm start
```

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB status
mongod --version

# Test connection
mongo mongodb://localhost:27017/pdf2csv
```

### n8n Webhook Not Working
1. Ensure n8n workflow is **Active** (green toggle)
2. Check n8n execution logs for errors
3. Verify webhook URL and callback secret match
4. Test webhook manually with curl/Postman

### File Upload Errors
- Check file size limits (20MB for PDFs, 50MB for CSVs)
- Verify MongoDB GridFS is working
- Check disk space and permissions

### Frontend Not Connecting to Backend
- Verify CORS settings in backend
- Check frontend `.env` file has correct API base URL
- Ensure both servers are running on correct ports

## 📊 Monitoring

### Health Checks
- Backend: `GET http://localhost:8080/api/n8n/health`
- MongoDB: `GET http://localhost:8080/api/files/health`

### Storage Statistics
- Development only: `GET http://localhost:8080/api/files/stats`

## 🔒 Security Notes

- All file uploads are validated for type and size
- Callback secret prevents unauthorized n8n callbacks
- Files are securely stored in MongoDB GridFS
- Download URLs include proper security headers
- CORS is properly configured for frontend access

## 📝 Development

### Adding New Features
1. Backend changes go in `backend/src/`
2. Frontend changes go in `frontend/src/`
3. Add tests in respective `tests/` directories
4. Update API documentation in this README

### Database Schema
Files are stored in MongoDB GridFS with metadata:
```json
{
  "jobId": "string",
  "uploadDate": "Date",
  "contentType": "text/csv", 
  "originalName": "filename.csv"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Run tests: `npm test`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.