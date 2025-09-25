const fs = require('fs');
const path = require('path');

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = {
    ...originalEnv,
    BASE_URL: 'http://localhost:8080'
  };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('LocalStorageClient', () => {
  let localStorageClient;
  let testStorageDir;

  beforeEach(() => {
    // Create a temporary test directory
    testStorageDir = path.join(__dirname, '../tmp/test-storage');
    
    // Mock the storage directory
    jest.doMock('../src/services/localStorageClient', () => {
      const LocalStorageClient = require('../src/services/localStorageClient');
      // Override storage directory for testing
      LocalStorageClient.storageDir = testStorageDir;
      return LocalStorageClient;
    });
    
    localStorageClient = require('../src/services/localStorageClient');
    
    // Ensure test directory exists
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testStorageDir)) {
      const files = fs.readdirSync(testStorageDir, { recursive: true });
      files.forEach(file => {
        const filePath = path.join(testStorageDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  describe('putCsv', () => {
    it('should store CSV data successfully', async () => {
      const testKey = 'jobs/test-job/123456.csv';
      const testData = 'col1,col2\nval1,val2';

      const result = await localStorageClient.putCsv({
        key: testKey,
        body: testData,
        contentType: 'text/csv'
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe(testKey);
      expect(result.url).toBe(`http://localhost:8080/api/files/download/${encodeURIComponent(testKey)}`);

      // Check file was created
      const filePath = localStorageClient.getFilePath(testKey);
      expect(fs.existsSync(filePath)).toBe(true);
      
      // Check file content
      const savedContent = fs.readFileSync(filePath, 'utf8');
      expect(savedContent).toBe(testData);
    });

    it('should create directories if they do not exist', async () => {
      const testKey = 'jobs/new-job/nested/deep/file.csv';
      const testData = 'header1,header2\ndata1,data2';

      await localStorageClient.putCsv({
        key: testKey,
        body: testData
      });

      const filePath = localStorageClient.getFilePath(testKey);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(testData);
    });

    it('should handle Buffer data', async () => {
      const testKey = 'jobs/buffer-test/file.csv';
      const testData = Buffer.from('col1,col2\nval1,val2', 'utf8');

      const result = await localStorageClient.putCsv({
        key: testKey,
        body: testData
      });

      expect(result.success).toBe(true);
      
      const filePath = localStorageClient.getFilePath(testKey);
      const savedContent = fs.readFileSync(filePath);
      expect(savedContent.equals(testData)).toBe(true);
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate download URL for existing file', async () => {
      const testKey = 'jobs/download-test/file.csv';
      const testData = 'test,data';

      // Create file first
      await localStorageClient.putCsv({ key: testKey, body: testData });

      const downloadUrl = await localStorageClient.getDownloadUrl({ key: testKey });
      
      expect(downloadUrl).toBe(`http://localhost:8080/api/files/download/${encodeURIComponent(testKey)}`);
    });

    it('should throw error for non-existent file', async () => {
      const testKey = 'jobs/non-existent/file.csv';

      await expect(localStorageClient.getDownloadUrl({ key: testKey }))
        .rejects.toThrow('Download URL generation failed: File not found: jobs/non-existent/file.csv');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const testKey = 'jobs/exists-test/file.csv';
      await localStorageClient.putCsv({ key: testKey, body: 'test' });

      const exists = await localStorageClient.fileExists(testKey);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const exists = await localStorageClient.fileExists('jobs/does-not-exist/file.csv');
      expect(exists).toBe(false);
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      const testKey = 'jobs/delete-test/file.csv';
      await localStorageClient.putCsv({ key: testKey, body: 'test' });

      const deleted = await localStorageClient.deleteFile(testKey);
      expect(deleted).toBe(true);

      const exists = await localStorageClient.fileExists(testKey);
      expect(exists).toBe(false);
    });

    it('should return false for non-existent file', async () => {
      const deleted = await localStorageClient.deleteFile('jobs/does-not-exist/file.csv');
      expect(deleted).toBe(false);
    });
  });

  describe('generateKey', () => {
    it('should generate key with job ID and timestamp', () => {
      const jobId = 'test-job-123';
      const key = localStorageClient.generateKey(jobId);
      
      expect(key).toMatch(/^jobs\/test-job-123\/\d+-converted\.csv$/);
    });

    it('should use original filename when provided', () => {
      const jobId = 'test-job-456';
      const originalFilename = 'my-document.pdf';
      const key = localStorageClient.generateKey(jobId, originalFilename);
      
      expect(key).toMatch(/^jobs\/test-job-456\/\d+-my-document\.csv$/);
    });

    it('should remove .pdf extension from original filename', () => {
      const jobId = 'test-job-789';
      const originalFilename = 'Report.PDF';
      const key = localStorageClient.generateKey(jobId, originalFilename);
      
      expect(key).toMatch(/^jobs\/test-job-789\/\d+-Report\.csv$/);
    });
  });

  describe('extractFilename', () => {
    it('should extract filename from key', () => {
      const key = 'jobs/test-job/123456-report.csv';
      const filename = localStorageClient.extractFilename(key);
      
      expect(filename).toBe('123456-report.csv');
    });

    it('should add .csv extension if missing', () => {
      const key = 'jobs/test-job/123456-report';
      const filename = localStorageClient.extractFilename(key);
      
      expect(filename).toBe('123456-report.csv');
    });

    it('should handle nested paths', () => {
      const key = 'jobs/test-job/subfolder/nested-file.csv';
      const filename = localStorageClient.extractFilename(key);
      
      expect(filename).toBe('nested-file.csv');
    });
  });

  describe('getFilePath', () => {
    it('should return correct local file path', () => {
      const key = 'jobs/test-job/file.csv';
      const filePath = localStorageClient.getFilePath(key);
      
      expect(filePath).toBe(path.join(testStorageDir, key));
    });

    it('should sanitize key to prevent directory traversal', () => {
      const maliciousKey = '../../../etc/passwd';
      const filePath = localStorageClient.getFilePath(maliciousKey);
      
      expect(filePath).toBe(path.join(testStorageDir, 'etc/passwd'));
      expect(filePath).not.toContain('..');
    });

    it('should remove leading slashes', () => {
      const key = '///jobs/test-job/file.csv';
      const filePath = localStorageClient.getFilePath(key);
      
      expect(filePath).toBe(path.join(testStorageDir, 'jobs/test-job/file.csv'));
    });
  });

  describe('getPublicUrl', () => {
    it('should generate correct public URL', () => {
      const key = 'jobs/test-job/file.csv';
      const url = localStorageClient.getPublicUrl(key);
      
      expect(url).toBe(`http://localhost:8080/api/files/download/${encodeURIComponent(key)}`);
    });

    it('should URL encode special characters', () => {
      const key = 'jobs/test job/file with spaces.csv';
      const url = localStorageClient.getPublicUrl(key);
      
      expect(url).toBe(`http://localhost:8080/api/files/download/${encodeURIComponent(key)}`);
      expect(url).toContain('test%20job');
      expect(url).toContain('with%20spaces');
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy storage', async () => {
      const healthy = await localStorageClient.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Create some test files
      await localStorageClient.putCsv({ key: 'jobs/job1/file1.csv', body: 'data1' });
      await localStorageClient.putCsv({ key: 'jobs/job2/file2.csv', body: 'longer data content' });

      const stats = await localStorageClient.getStats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
      expect(parseFloat(stats.totalSizeMB)).toBeGreaterThan(0);
      expect(stats.storageDir).toBe(testStorageDir);
    });

    it('should handle empty storage', async () => {
      const stats = await localStorageClient.getStats();

      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.totalSizeMB).toBe('0.00');
    });
  });
});
