/**
 * API client for PDF2CSV backend
 */

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Make HTTP request with error handling
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
async function apiRequest(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers
      }
    });

    // Handle non-JSON responses (like presigned URLs)
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const error = data?.error || {};
      throw new ApiError(
        error.message || `HTTP ${response.status}`,
        response.status,
        error.code || 'HTTP_ERROR'
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Network or other errors
    throw new ApiError(
      error.message || 'Network error',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Upload PDF file and start conversion
 * @param {File} file - PDF file to upload
 * @returns {Promise<{jobId: string, message: string, filename: string, execution?: object}>}
 */
export async function uploadPdf(file) {
  if (!file) {
    throw new ApiError('No file provided', 400, 'NO_FILE');
  }

  if (file.type !== 'application/pdf') {
    throw new ApiError('Only PDF files are allowed', 400, 'INVALID_FILE_TYPE');
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new ApiError('File too large (max 20MB)', 400, 'FILE_TOO_LARGE');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await apiRequest('/api/jobs', {
    method: 'POST',
    body: formData
  });

  // Store job details in local storage for persistence
  if (response.jobId) {
    const jobData = {
      jobId: response.jobId,
      filename: response.filename,
      status: 'processing',
      createdAt: new Date().toISOString(),
      execution: response.execution || null
    };
    localStorage.setItem(`job_${response.jobId}`, JSON.stringify(jobData));
    
    // Also store in a list for easy retrieval
    const jobList = getStoredJobList();
    if (!jobList.find(id => id === response.jobId)) {
      jobList.unshift(response.jobId); // Add to front
      // Keep only last 10 jobs
      if (jobList.length > 10) {
        const removedJob = jobList.pop();
        localStorage.removeItem(`job_${removedJob}`);
      }
      localStorage.setItem('pdf_csv_jobs', JSON.stringify(jobList));
    }
  }

  return response;
}

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise<{jobId: string, status: string, ready: boolean, filename: string}>}
 */
export async function getJobStatus(jobId) {
  if (!jobId) {
    throw new ApiError('Job ID is required', 400, 'NO_JOB_ID');
  }

  return apiRequest(`/api/jobs/${jobId}/status`);
}

/**
 * Get download URL for completed job
 * @param {string} jobId - Job ID
 * @returns {Promise<{url: string, filename: string, expiresInSeconds: number}>}
 */
export async function getDownloadUrl(jobId) {
  if (!jobId) {
    throw new ApiError('Job ID is required', 400, 'NO_JOB_ID');
  }

  return apiRequest(`/api/jobs/${jobId}/download-url`);
}

/**
 * Get n8n execution details for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<{jobId: string, execution: object, jobStatus: string}>}
 */
export async function getExecutionDetails(jobId) {
  if (!jobId) {
    throw new ApiError('Job ID is required', 400, 'NO_JOB_ID');
  }

  return apiRequest(`/api/jobs/${jobId}/execution`);
}

/**
 * Get all files from MongoDB
 * @returns {Promise<{files: Array, totalFiles: number, totalSize: number, formattedTotalSize: string}>}
 */
export async function getAllFiles() {
  return apiRequest('/api/files');
}

/**
 * Delete a file from MongoDB
 * @param {string} fileId - File ID to delete
 * @returns {Promise<{success: boolean, message: string, fileId: string, filename: string}>}
 */
export async function deleteFile(fileId) {
  if (!fileId) {
    throw new ApiError('File ID is required', 400, 'NO_FILE_ID');
  }

  return apiRequest(`/api/files/${fileId}`, {
    method: 'DELETE'
  });
}

/**
 * Poll job status until completion
 * @param {string} jobId - Job ID
 * @param {function} onStatusUpdate - Callback for status updates
 * @param {number} intervalMs - Polling interval in milliseconds
 * @returns {Promise<object>} Final job status
 */
export async function pollJobStatus(jobId, onStatusUpdate = null, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 150; // 5 minutes max (150 * 2 seconds)

    const poll = async () => {
      try {
        attempts++;
        
        if (attempts > maxAttempts) {
          reject(new ApiError('Job polling timeout', 408, 'POLLING_TIMEOUT'));
          return;
        }

        const status = await getJobStatus(jobId);
        
        // Update local storage with latest status
        updateStoredJob(jobId, {
          status: status.status,
          ready: status.ready,
          execution: status.execution || null,
          error: status.error || null,
          downloadUrl: status.downloadUrl || null,
          updatedAt: new Date().toISOString()
        });
        
        if (onStatusUpdate) {
          onStatusUpdate(status);
        }

        if (status.ready || status.status === 'error') {
          resolve(status);
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

/**
 * Check API health
 * @returns {Promise<{status: string, timestamp: string}>}
 */
export async function checkHealth() {
  return apiRequest('/health');
}

/**
 * Get stored job list from local storage
 * @returns {string[]} Array of job IDs
 */
function getStoredJobList() {
  try {
    const stored = localStorage.getItem('pdf_csv_jobs');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to parse stored job list:', error);
    return [];
  }
}

/**
 * Get stored job data from local storage
 * @param {string} jobId - Job ID
 * @returns {object|null} Job data or null if not found
 */
export function getStoredJob(jobId) {
  try {
    const stored = localStorage.getItem(`job_${jobId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to parse stored job data:', error);
    return null;
  }
}

/**
 * Update stored job data in local storage
 * @param {string} jobId - Job ID
 * @param {object} updates - Updates to apply
 */
export function updateStoredJob(jobId, updates) {
  try {
    const existing = getStoredJob(jobId) || {};
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    localStorage.setItem(`job_${jobId}`, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to update stored job data:', error);
  }
}

/**
 * Get all stored jobs
 * @returns {object[]} Array of job data objects
 */
export function getAllStoredJobs() {
  const jobList = getStoredJobList();
  return jobList.map(jobId => getStoredJob(jobId)).filter(Boolean);
}

/**
 * Clear old completed jobs from local storage
 * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
 */
export function cleanupStoredJobs(maxAge = 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - maxAge);
  const jobList = getStoredJobList();
  const activeJobs = [];

  jobList.forEach(jobId => {
    const job = getStoredJob(jobId);
    if (job && new Date(job.createdAt) > cutoff) {
      activeJobs.push(jobId);
    } else {
      localStorage.removeItem(`job_${jobId}`);
    }
  });

  localStorage.setItem('pdf_csv_jobs', JSON.stringify(activeJobs));
}

export { ApiError };
