const { S3Client } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    R2_ACCOUNT_ID: 'test-account-id',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    R2_BUCKET: 'test-bucket',
    R2_ENDPOINT: 'https://test-account-id.r2.cloudflarestorage.com',
    R2_PRESIGN_EXPIRES_SECONDS: '3600'
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});

describe('R2Client', () => {
  let r2Client;
  let mockS3Client;
  let mockSend;

  beforeEach(() => {
    mockSend = jest.fn();
    mockS3Client = {
      send: mockSend
    };
    S3Client.mockImplementation(() => mockS3Client);
    
    // Require after mocking
    r2Client = require('../src/services/r2Client');
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: 'auto',
        endpoint: 'https://test-account-id.r2.cloudflarestorage.com',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key'
        },
        forcePathStyle: false
      });
    });
  });

  describe('putCsv', () => {
    it('should upload CSV with correct parameters', async () => {
      const mockResult = { ETag: '"test-etag"' };
      mockSend.mockResolvedValue(mockResult);

      const params = {
        key: 'jobs/test-job/123456.csv',
        body: 'col1,col2\nval1,val2',
        contentType: 'text/csv'
      };

      const result = await r2Client.putCsv(params);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: params.key,
        Body: params.body,
        ContentType: 'text/csv',
        Metadata: {
          'uploaded-at': expect.any(String),
          'source': 'pdf2csv-backend'
        }
      });

      expect(result).toEqual({
        success: true,
        key: params.key,
        etag: '"test-etag"',
        location: `https://test-account-id.r2.cloudflarestorage.com/test-bucket/${params.key}`
      });
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      mockSend.mockRejectedValue(error);

      const params = {
        key: 'test-key',
        body: 'test-data'
      };

      await expect(r2Client.putCsv(params)).rejects.toThrow('R2 upload failed: Upload failed');
    });
  });

  describe('getPresignedUrl', () => {
    it('should generate presigned URL with correct parameters', async () => {
      const mockUrl = 'https://presigned-url.example.com';
      getSignedUrl.mockResolvedValue(mockUrl);

      const params = {
        key: 'jobs/test-job/123456.csv',
        expiresInSeconds: 1800
      };

      const result = await r2Client.getPresignedUrl(params);

      expect(getSignedUrl).toHaveBeenCalledTimes(1);
      const [client, command, options] = getSignedUrl.mock.calls[0];
      
      expect(client).toBe(mockS3Client);
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: params.key,
        ResponseContentType: 'text/csv',
        ResponseContentDisposition: 'attachment; filename="123456.csv"'
      });
      expect(options).toEqual({ expiresIn: 1800 });
      expect(result).toBe(mockUrl);
    });

    it('should use default expiration time', async () => {
      const mockUrl = 'https://presigned-url.example.com';
      getSignedUrl.mockResolvedValue(mockUrl);

      await r2Client.getPresignedUrl({ key: 'test-key' });

      const options = getSignedUrl.mock.calls[0][2];
      expect(options.expiresIn).toBe(3600); // Default from env
    });

    it('should handle presigned URL generation errors', async () => {
      const error = new Error('Presign failed');
      getSignedUrl.mockRejectedValue(error);

      await expect(r2Client.getPresignedUrl({ key: 'test-key' }))
        .rejects.toThrow('Presigned URL generation failed: Presign failed');
    });
  });

  describe('generateKey', () => {
    it('should generate key with job ID and timestamp', () => {
      const jobId = 'test-job-123';
      const key = r2Client.generateKey(jobId);
      
      expect(key).toMatch(/^jobs\/test-job-123\/\d+-converted\.csv$/);
    });

    it('should use original filename when provided', () => {
      const jobId = 'test-job-456';
      const originalFilename = 'my-document.pdf';
      const key = r2Client.generateKey(jobId, originalFilename);
      
      expect(key).toMatch(/^jobs\/test-job-456\/\d+-my-document\.csv$/);
    });

    it('should remove .pdf extension from original filename', () => {
      const jobId = 'test-job-789';
      const originalFilename = 'Report.PDF';
      const key = r2Client.generateKey(jobId, originalFilename);
      
      expect(key).toMatch(/^jobs\/test-job-789\/\d+-Report\.csv$/);
    });
  });

  describe('extractFilename', () => {
    it('should extract filename from R2 key', () => {
      const key = 'jobs/test-job/123456-report.csv';
      const filename = r2Client.extractFilename(key);
      
      expect(filename).toBe('123456-report.csv');
    });

    it('should add .csv extension if missing', () => {
      const key = 'jobs/test-job/123456-report';
      const filename = r2Client.extractFilename(key);
      
      expect(filename).toBe('123456-report.csv');
    });

    it('should handle nested paths', () => {
      const key = 'jobs/test-job/subfolder/nested-file.csv';
      const filename = r2Client.extractFilename(key);
      
      expect(filename).toBe('nested-file.csv');
    });
  });

  describe('objectExists', () => {
    it('should return true when object exists', async () => {
      mockSend.mockResolvedValue({}); // Successful response means object exists
      
      const exists = await r2Client.objectExists('existing-key');
      
      expect(exists).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should return false when object does not exist', async () => {
      const error = new Error('NoSuchKey');
      error.name = 'NoSuchKey';
      mockSend.mockRejectedValue(error);
      
      const exists = await r2Client.objectExists('non-existing-key');
      
      expect(exists).toBe(false);
    });

    it('should return false for 404 errors', async () => {
      const error = new Error('Not Found');
      error.$metadata = { httpStatusCode: 404 };
      mockSend.mockRejectedValue(error);
      
      const exists = await r2Client.objectExists('not-found-key');
      
      expect(exists).toBe(false);
    });

    it('should throw for other errors', async () => {
      const error = new Error('Access Denied');
      error.name = 'AccessDenied';
      mockSend.mockRejectedValue(error);
      
      await expect(r2Client.objectExists('forbidden-key')).rejects.toThrow('Access Denied');
    });
  });
});
