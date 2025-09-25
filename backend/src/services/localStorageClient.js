const fs = require('fs');
const path = require('path');

/**
 * Local file storage client - Alternative to Cloudflare R2
 * Stores CSV files on local filesystem and serves them via Express
 */
class LocalStorageClient {
  constructor() {
    this.storageDir = path.join(__dirname, '../../storage/csv');
    this.baseUrl = process.env.BASE_URL || 'http://localhost:8080';
    
    // Create storage directory if it doesn't exist
    this.ensureStorageDir();
    
    console.log(`📁 Local storage initialized: ${this.storageDir}`);
  }

  /**
   * Ensure storage directory exists
   */
  ensureStorageDir() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        console.log(`✅ Created storage directory: ${this.storageDir}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create storage directory: ${error.message}`);
      throw new Error(`Storage directory creation failed: ${error.message}`);
    }
  }

  /**
   * Store CSV data locally
   * @param {object} params
   * @param {string} params.key - File key/path
   * @param {Buffer|string} params.body - CSV data
   * @param {string} params.contentType - Content type (ignored for local storage)
   * @returns {Promise<object>} Storage result
   */
  async putCsv({ key, body, contentType = 'text/csv' }) {
    try {
      console.log(`📤 Storing CSV locally: ${key}`);

      // Generate local file path
      const filePath = this.getFilePath(key);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filePath, body);
      
      // Get file stats
      const stats = fs.statSync(filePath);
      
      console.log(`✅ CSV stored locally: ${key} (${(stats.size / 1024).toFixed(2)}KB)`);
      
      return {
        success: true,
        key,
        size: stats.size,
        location: filePath,
        url: this.getPublicUrl(key)
      };

    } catch (error) {
      console.error(`❌ Failed to store CSV locally: ${error.message}`);
      throw new Error(`Local storage failed: ${error.message}`);
    }
  }

  /**
   * Generate download URL for CSV file
   * @param {object} params
   * @param {string} params.key - File key
   * @param {number} params.expiresInSeconds - Ignored for local storage
   * @returns {Promise<string>} Download URL
   */
  async getDownloadUrl({ key, expiresInSeconds = 3600 }) {
    try {
      const filePath = this.getFilePath(key);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${key}`);
      }

      const downloadUrl = this.getPublicUrl(key);
      console.log(`🔗 Generated download URL: ${key}`);
      
      return downloadUrl;

    } catch (error) {
      console.error(`❌ Failed to generate download URL: ${error.message}`);
      throw new Error(`Download URL generation failed: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   * @param {string} key - File key
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(key) {
    try {
      const filePath = this.getFilePath(key);
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete file
   * @param {string} key - File key
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async deleteFile(key) {
    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted file: ${key}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Failed to delete file: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate file key for a job
   * @param {string} jobId - Job ID
   * @param {string} originalFilename - Original PDF filename (optional)
   * @returns {string} File key
   */
  generateKey(jobId, originalFilename = null) {
    const timestamp = Date.now();
    const baseName = originalFilename 
      ? originalFilename.replace(/\.pdf$/i, '') 
      : 'converted';
    
    return `jobs/${jobId}/${timestamp}-${baseName}.csv`;
  }

  /**
   * Get local file path from key
   * @param {string} key - File key
   * @returns {string} Local file path
   */
  getFilePath(key) {
    // Sanitize key to prevent directory traversal
    const sanitizedKey = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.storageDir, sanitizedKey);
  }

  /**
   * Get public URL for file
   * @param {string} key - File key
   * @returns {string} Public download URL
   */
  getPublicUrl(key) {
    // URL encode the key to handle special characters
    const encodedKey = encodeURIComponent(key);
    return `${this.baseUrl}/api/files/download/${encodedKey}`;
  }

  /**
   * Extract filename from key
   * @param {string} key - File key
   * @returns {string} Filename for download
   */
  extractFilename(key) {
    const parts = key.split('/');
    const filename = parts[parts.length - 1];
    
    // Ensure .csv extension
    if (!filename.endsWith('.csv')) {
      return `${filename}.csv`;
    }
    return filename;
  }

  /**
   * Get storage statistics
   * @returns {Promise<object>} Storage stats
   */
  async getStats() {
    try {
      const files = this.getAllFiles(this.storageDir);
      let totalSize = 0;
      
      files.forEach(filePath => {
        try {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        } catch (error) {
          // Ignore files that can't be accessed
        }
      });

      return {
        totalFiles: files.length,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        storageDir: this.storageDir
      };
    } catch (error) {
      return {
        totalFiles: 0,
        totalSizeBytes: 0,
        totalSizeMB: '0.00',
        storageDir: this.storageDir,
        error: error.message
      };
    }
  }

  /**
   * Get all files recursively
   * @param {string} dir - Directory to search
   * @returns {Array<string>} Array of file paths
   */
  getAllFiles(dir) {
    let files = [];
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files = files.concat(this.getAllFiles(fullPath));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  /**
   * Cleanup old files (older than specified hours)
   * @param {number} hoursOld - Files older than this will be deleted
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanup(hoursOld = 24) {
    try {
      const cutoffTime = Date.now() - (hoursOld * 60 * 60 * 1000);
      const files = this.getAllFiles(this.storageDir);
      let deletedCount = 0;

      for (const filePath of files) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (error) {
          // Ignore files that can't be processed
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old CSV files (older than ${hoursOld}h)`);
      }

      return deletedCount;
    } catch (error) {
      console.error(`❌ Cleanup failed: ${error.message}`);
      return 0;
    }
  }

  /**
   * Health check for local storage
   * @returns {Promise<boolean>} True if storage is accessible
   */
  async healthCheck() {
    try {
      // Test write/read/delete
      const testKey = 'health-check-test.csv';
      const testData = 'test,data\n1,2';
      
      await this.putCsv({ key: testKey, body: testData });
      const exists = await this.fileExists(testKey);
      await this.deleteFile(testKey);
      
      return exists;
    } catch (error) {
      console.warn(`⚠️  Local storage health check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = new LocalStorageClient();
