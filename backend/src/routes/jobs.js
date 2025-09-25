const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateJobId, isValidJobId } = require('../utils/ids');
const jobStore = require('../services/jobStore');
const n8nClient = require('../services/n8nClient');
const mongoClient = require('../services/mongoClient');
const { asyncHandler, createError } = require('../middleware/errors');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../../tmp'),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDF files
    if (file.mimetype !== 'application/pdf') {
      return cb(createError('Only PDF files are allowed', 400, 'INVALID_FILE_TYPE'));
    }
    cb(null, true);
  }
});

/**
 * POST /api/jobs - Upload PDF and start conversion
 */
router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw createError('No file uploaded', 400, 'NO_FILE');
  }

  const { originalname, path: filePath, size } = req.file;
  
  console.log(`📄 Received PDF upload: ${originalname} (${(size / 1024 / 1024).toFixed(2)}MB)`);

  // Generate unique job ID outside try block so it's accessible in catch
  const jobId = generateJobId();

  try {
    
    // Create job record
    jobStore.createJob(jobId, originalname);
    
    // Forward to n8n webhook
    await n8nClient.forwardToN8n({
      filePath,
      originalName: originalname,
      jobId
    });

    // Clean up temporary file after forwarding
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn(`⚠️  Failed to cleanup temp file: ${cleanupError.message}`);
    }

    console.log(`✅ Job created: ${jobId} for ${originalname}`);

    res.status(201).json({
      jobId,
      message: 'PDF uploaded and processing started',
      filename: originalname
    });

  } catch (error) {
    // Clean up temporary file on error
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn(`⚠️  Failed to cleanup temp file after error: ${cleanupError.message}`);
    }

    // Update job status to error
    if (jobId) {
      jobStore.failJob(jobId, error.message);
    }

    throw error;
  }
}));

/**
 * GET /api/jobs/:jobId/status - Get job status
 */
router.get('/:jobId/status', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  if (!isValidJobId(jobId)) {
    throw createError('Invalid job ID format', 400, 'INVALID_JOB_ID');
  }

  const job = jobStore.getJob(jobId);
  if (!job) {
    throw createError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  const response = {
    jobId,
    status: job.status,
    ready: job.status === 'done',
    filename: job.filenamePdf,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };

  // Include error details if job failed
  if (job.status === 'error' && job.error) {
    response.error = job.error;
  }

  res.json(response);
}));

/**
 * GET /api/jobs/:jobId/download-url - Get presigned download URL
 */
router.get('/:jobId/download-url', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  if (!isValidJobId(jobId)) {
    throw createError('Invalid job ID format', 400, 'INVALID_JOB_ID');
  }

  const job = jobStore.getJob(jobId);
  if (!job) {
    throw createError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  if (job.status !== 'done') {
    throw createError('Job not completed yet', 400, 'JOB_NOT_READY');
  }

  if (!job.r2Key) {
    throw createError('CSV file not available', 500, 'CSV_NOT_AVAILABLE');
  }

  try {
    // Generate fresh download URL from MongoDB
    const downloadUrl = await mongoClient.generateDownloadUrl(jobId);

    // Update job with new download URL
    jobStore.updateJob(jobId, { presignedUrl: downloadUrl });

    res.json({
      url: downloadUrl,
      filename: job.filenamePdf.replace(/\.pdf$/i, '.csv'),
      expiresInSeconds: 3600 // Local storage doesn't expire, but kept for compatibility
    });

  } catch (error) {
    console.error(`❌ Failed to generate download URL for job ${jobId}: ${error.message}`);
    throw createError('Failed to generate download URL', 500, 'DOWNLOAD_URL_ERROR');
  }
}));

/**
 * GET /api/jobs - List all jobs (for debugging)
 * Only available in development
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/', asyncHandler(async (req, res) => {
    const allJobs = jobStore.getAllJobs();
    const stats = jobStore.getStats();
    
    res.json({
      stats,
      jobs: allJobs.map(([jobId, job]) => ({
        jobId,
        ...job
      }))
    });
  }));
}

module.exports = router;
