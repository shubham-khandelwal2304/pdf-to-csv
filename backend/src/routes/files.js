const express = require('express');
const path = require('path');
const fs = require('fs');
const localStorageClient = require('../services/localStorageClient');
const { asyncHandler, createError } = require('../middleware/errors');

const router = express.Router();

/**
 * GET /api/files/download/:encodedKey - Download CSV file
 */
router.get('/download/:encodedKey', asyncHandler(async (req, res) => {
  const { encodedKey } = req.params;
  
  // Decode the file key
  let fileKey;
  try {
    fileKey = decodeURIComponent(encodedKey);
  } catch (error) {
    throw createError('Invalid file key', 400, 'INVALID_FILE_KEY');
  }

  // Get file path
  const filePath = localStorageClient.getFilePath(fileKey);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw createError('File not found', 404, 'FILE_NOT_FOUND');
  }

  try {
    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Extract filename for download
    const filename = localStorageClient.extractFilename(fileKey);
    
    console.log(`📥 Serving file download: ${fileKey} (${(stats.size / 1024).toFixed(2)}KB)`);

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error(`❌ File stream error: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'File read error' });
      }
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error(`❌ Failed to serve file: ${error.message}`);
    throw createError('Failed to serve file', 500, 'FILE_SERVE_ERROR');
  }
}));

/**
 * GET /api/files/stats - Get storage statistics (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await localStorageClient.getStats();
    res.json({
      storage: stats,
      type: 'local-filesystem'
    });
  }));
}

/**
 * POST /api/files/cleanup - Cleanup old files (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/cleanup', asyncHandler(async (req, res) => {
    const { hoursOld = 24 } = req.body;
    const deletedCount = await localStorageClient.cleanup(hoursOld);
    
    res.json({
      message: `Cleanup completed`,
      deletedFiles: deletedCount,
      hoursOld
    });
  }));
}

module.exports = router;
