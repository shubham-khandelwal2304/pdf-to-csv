const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/**
 * Cloudflare R2 client (S3-compatible)
 */
class R2Client {
  constructor() {
    this.accountId = process.env.R2_ACCOUNT_ID;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET;
    this.endpoint = process.env.R2_ENDPOINT;
    this.presignExpiresSeconds = parseInt(process.env.R2_PRESIGN_EXPIRES_SECONDS) || 3600;

    // Validate configuration
    if (!this.accountId || !this.accessKeyId || !this.secretAccessKey || !this.bucket) {
      console.warn('⚠️  R2 credentials not fully configured - CSV storage will fail');
    }

    // Initialize S3 client for R2
    this.s3Client = new S3Client({
      region: 'auto', // R2 uses 'auto' region
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey
      },
      // R2-specific configuration
      forcePathStyle: false, // R2 supports virtual-hosted-style requests
    });

    console.log(`🗄️  R2 Client initialized for bucket: ${this.bucket}`);
  }

  /**
   * Upload CSV data to R2
   * @param {object} params
   * @param {string} params.key - Object key (path) in R2
   * @param {Buffer|string} params.body - CSV data
   * @param {string} params.contentType - Content type (default: 'text/csv')
   * @returns {Promise<object>} Upload result
   */
  async putCsv({ key, body, contentType = 'text/csv' }) {
    try {
      console.log(`📤 Uploading CSV to R2: ${key}`);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Add metadata for better organization
        Metadata: {
          'uploaded-at': new Date().toISOString(),
          'source': 'pdf2csv-backend'
        }
      });

      const result = await this.s3Client.send(command);
      
      console.log(`✅ CSV uploaded to R2: ${key} (ETag: ${result.ETag})`);
      
      return {
        success: true,
        key,
        etag: result.ETag,
        location: `${this.endpoint}/${this.bucket}/${key}`
      };

    } catch (error) {
      console.error(`❌ Failed to upload CSV to R2: ${error.message}`);
      throw new Error(`R2 upload failed: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for downloading CSV
   * @param {object} params
   * @param {string} params.key - Object key in R2
   * @param {number} params.expiresInSeconds - URL expiration time (default: from env)
   * @returns {Promise<string>} Presigned download URL
   */
  async getPresignedUrl({ key, expiresInSeconds = this.presignExpiresSeconds }) {
    try {
      console.log(`🔗 Generating presigned URL for: ${key} (expires in ${expiresInSeconds}s)`);

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // Set proper response headers for CSV download
        ResponseContentType: 'text/csv',
        ResponseContentDisposition: `attachment; filename="${this.extractFilename(key)}"`
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds
      });

      console.log(`✅ Presigned URL generated for: ${key}`);
      return presignedUrl;

    } catch (error) {
      console.error(`❌ Failed to generate presigned URL: ${error.message}`);
      throw new Error(`Presigned URL generation failed: ${error.message}`);
    }
  }

  /**
   * Check if an object exists in R2
   * @param {string} key - Object key
   * @returns {Promise<boolean>} True if object exists
   */
  async objectExists(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Extract filename from R2 key
   * @param {string} key - R2 object key
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
   * Generate R2 key for a job
   * @param {string} jobId - Job ID
   * @param {string} originalFilename - Original PDF filename (optional)
   * @returns {string} R2 object key
   */
  generateKey(jobId, originalFilename = null) {
    const timestamp = Date.now();
    const baseName = originalFilename 
      ? originalFilename.replace(/\.pdf$/i, '') 
      : 'converted';
    
    return `jobs/${jobId}/${timestamp}-${baseName}.csv`;
  }

  /**
   * Health check for R2 connectivity
   * @returns {Promise<boolean>} True if R2 is accessible
   */
  async healthCheck() {
    try {
      // Try to list bucket (minimal operation)
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: 'health-check-non-existent-key'
      });

      await this.s3Client.send(command);
      return true; // Shouldn't reach here
    } catch (error) {
      // We expect a 404 for non-existent key, which means R2 is accessible
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return true;
      }
      console.warn(`⚠️  R2 health check failed: ${error.message}`);
      return false;
    }
  }
}

module.exports = new R2Client();
