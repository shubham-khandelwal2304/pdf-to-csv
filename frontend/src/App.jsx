import React, { useState, useCallback, useEffect } from 'react';
import Uploader from './components/Uploader';
import StatusBar from './components/StatusBar';
import Sidebar from './components/Sidebar';
import { useJobEvents } from './hooks/useJobEvents';
import { 
  uploadPdf, 
  getDownloadUrl, 
  getJobStatus,
  ApiError, 
  getAllStoredJobs, 
  cleanupStoredJobs,
  updateStoredJob 
} from './api';

function App() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [filename, setFilename] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [execution, setExecution] = useState(null);
  const [storedJobs, setStoredJobs] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize from local storage on component mount
  useEffect(() => {
    // Clean up old jobs
    cleanupStoredJobs();
    
    // Load stored jobs
    const jobs = getAllStoredJobs();
    setStoredJobs(jobs);
    
    // If there's a processing job, resume it
    const processingJob = jobs.find(job => job.status === 'processing');
    if (processingJob && !jobId) {
      console.log('Resuming processing job:', processingJob.jobId);
      setJobId(processingJob.jobId);
      setFilename(processingJob.filename);
      setStatus(processingJob.status);
      setExecution(processingJob.execution);
      
      // Resume real-time updates
      if (processingJob.status === 'processing') {
        setIsPolling(true);
      }
    }
  }, []);

  // Handle real-time job updates
  const handleJobUpdate = useCallback(async (data) => {
    console.log('Job update received:', data);
    
    if (data.type === 'update') {
      setStatus(data.status);
      
      if (data.status === 'completed') {
        setIsPolling(false);
        setDownloadUrl(data.downloadUrl);
        
        // Automatically trigger download like sidebar does
        if (data.downloadUrl) {
          window.open(data.downloadUrl, '_blank');
        }
        
        updateStoredJob(data.jobId, {
          status: 'done',
          downloadUrl: data.downloadUrl,
          ready: true
        });
      } else if (data.status === 'error') {
        setIsPolling(false);
        setError(data.error);
        
        updateStoredJob(data.jobId, {
          status: 'error',
          error: data.error
        });
      }
    }
  }, []);

  // Fallback polling mechanism in case SSE fails
  useEffect(() => {
    if (!jobId || !isPolling || status !== 'processing') return;

    const pollInterval = setInterval(async () => {
      try {
        console.log('Fallback polling job status for:', jobId);
        const jobStatus = await getJobStatus(jobId);
        
        if (jobStatus.ready && jobStatus.status === 'done') {
          console.log('Job completed via fallback polling');
          setStatus('done');
          setIsPolling(false);
          
          // Get download URL and trigger automatic download
          try {
            const downloadData = await getDownloadUrl(jobId);
            setDownloadUrl(downloadData.url);
            
            // Automatically trigger download like sidebar does
            window.open(downloadData.url, '_blank');
            
            updateStoredJob(jobId, {
              status: 'done',
              downloadUrl: downloadData.url,
              ready: true
            });
          } catch (downloadError) {
            console.error('Failed to get download URL:', downloadError);
          }
        } else if (jobStatus.status === 'error') {
          console.log('Job failed via fallback polling');
          setStatus('error');
          setIsPolling(false);
          setError(jobStatus.error || 'Job failed');
          
          updateStoredJob(jobId, {
            status: 'error',
            error: jobStatus.error || 'Job failed'
          });
        }
      } catch (error) {
        console.error('Fallback polling error:', error);
        
        // If job not found (404), stop polling and clean up
        if (error instanceof ApiError && error.status === 404) {
          console.log('Job not found, cleaning up and stopping polling');
          setIsPolling(false);
          
          // Clean up invalid job from localStorage
          localStorage.removeItem(`job_${jobId}`);
          const jobList = JSON.parse(localStorage.getItem('pdf_csv_jobs') || '[]');
          const updatedJobList = jobList.filter(id => id !== jobId);
          localStorage.setItem('pdf_csv_jobs', JSON.stringify(updatedJobList));
          
          // Try to get download URL as fallback
          try {
            const downloadData = await getDownloadUrl(jobId);
            setDownloadUrl(downloadData.url);
            setStatus('done');
            window.open(downloadData.url, '_blank');
          } catch (downloadError) {
            // If download also fails, reset to allow new upload
            console.log('Download not available, resetting state');
            resetState();
            setError('Job not found. It may have expired. Please upload again.');
          }
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [jobId, isPolling, status]);

  // Use SSE for real-time updates
  useJobEvents(jobId, handleJobUpdate);

  const resetState = useCallback(() => {
    setJobId(null);
    setStatus(null);
    setFilename(null);
    setError(null);
    setIsUploading(false);
    setIsPolling(false);
    setDownloadUrl(null);
    setExecution(null);
  }, []);

  const handleUpload = useCallback(async (file, uploadError) => {
    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    if (!file) {
      setError('No file selected');
      return;
    }

    setError(null);
    setIsUploading(true);
    setFilename(file.name);

    try {
      console.log('Uploading PDF:', file.name);
      const response = await uploadPdf(file);
      
      console.log('Upload successful, starting polling:', response.jobId);
      setJobId(response.jobId);
      setStatus('processing');
      setExecution(response.execution);
      setIsUploading(false);
      setIsPolling(true);

      // Log execution details if available
      if (response.execution) {
        console.log('n8n execution started:', response.execution);
      }

      // Real-time updates will be handled by useJobEvents hook

    } catch (err) {
      console.error('Upload/polling error:', err);
      setIsUploading(false);
      setIsPolling(false);
      
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (downloadUrl) {
      console.log('Opening download URL:', downloadUrl);
      window.open(downloadUrl, '_blank');
    } else if (jobId) {
      // Fallback: try to get download URL if not available
      try {
        const downloadData = await getDownloadUrl(jobId);
        window.open(downloadData.url, '_blank');
        setDownloadUrl(downloadData.url);
      } catch (error) {
        console.error('Failed to get download URL:', error);
        setError('Failed to download file. Please try again.');
      }
    }
  }, [downloadUrl, jobId]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const handleFileSelect = useCallback((file) => {
    console.log('File selected from sidebar:', file);
    // You can add additional logic here, like showing file details
    // or setting it as the current file
  }, []);

  const isDisabled = isUploading || isPolling;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Sidebar Component */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        onFileSelect={handleFileSelect}
      />
      
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white text-shadow">
            PDF to CSV Converter
          </h1>
          <p className="text-xl text-white/90 text-shadow">
            Convert your PDF files to CSV format quickly and easily
          </p>
        </header>

        <main className="w-full">
          <div className="card p-8 mb-8">
            {!status && (
              <>
                <Uploader 
                  onUpload={handleUpload}
                  disabled={isDisabled}
                />
                
                {storedJobs.length > 0 && (
                  <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent Jobs</h3>
                    <div className="space-y-2">
                      {storedJobs.slice(0, 3).map(job => (
                        <div key={job.jobId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-800">{job.filename}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(job.createdAt).toLocaleString()}
                              {job.execution && (
                                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                                  n8n: {job.execution.id}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              job.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                              job.status === 'done' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {job.status}
                            </span>
                            {job.status === 'processing' && (
                              <button
                                onClick={() => {
                                  setJobId(job.jobId);
                                  setFilename(job.filename);
                                  setStatus(job.status);
                                  setExecution(job.execution);
                                  setIsPolling(true);
                                }}
                                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                              >
                                Resume
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {error && !status && (
              <div className="alert alert-error mb-4">
                <strong>Error:</strong> {error}
                <button 
                  className="btn btn-secondary ml-4 py-2 px-4 text-sm"
                  onClick={() => setError(null)}
                >
                  Try Again
                </button>
              </div>
            )}

            {isUploading && (
              <div className="alert alert-info">
                <div className="flex items-center justify-center gap-4">
                  <span className="text-2xl animate-pulse-slow">📤</span>
                  <span className="font-medium">Uploading {filename}...</span>
                </div>
              </div>
            )}

            {status && (
          <StatusBar
            status={status}
            filename={filename}
            error={error}
            onDownload={handleDownload}
            onReset={resetState}
            isPolling={isPolling}
            downloadUrl={downloadUrl}
            execution={execution}
          />
            )}
          </div>

          <footer className="text-center">
            <p className="text-white/70 text-shadow">
              Powered by n8n workflow automation
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
