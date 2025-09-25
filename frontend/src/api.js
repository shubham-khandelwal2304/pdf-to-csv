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
 * @returns {Promise<{jobId: string, message: string, filename: string}>}
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

  return apiRequest('/api/jobs', {
    method: 'POST',
    body: formData
  });
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

export { ApiError };
