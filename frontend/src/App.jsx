import React, { useState, useCallback, useEffect } from 'react';
import Uploader from './components/Uploader';
import StatusBar from './components/StatusBar';
import Sidebar from './components/Sidebar';
import { 
  uploadPdf, 
  pollJobStatus, 
  getDownloadUrl, 
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
      setJobId(processingJob.jobId);
      setFilename(processingJob.filename);
      setStatus(processingJob.status);
      setExecution(processingJob.execution);
      
      // Resume polling
      if (processingJob.status === 'processing') {
        setIsPolling(true);
        resumeJobPolling(processingJob.jobId);
      }
    }
  }, []);

  // Resume polling for an existing job
  const resumeJobPolling = useCallback(async (resumeJobId) => {
    try {
      console.log('Resuming polling for job:', resumeJobId);
      
      const finalStatus = await pollJobStatus(
        resumeJobId,
        (statusUpdate) => {
          console.log('Status update:', statusUpdate);
          setStatus(statusUpdate.status);
          setExecution(statusUpdate.execution);
        }
      );

      console.log('Final status:', finalStatus);
      setStatus(finalStatus.status);
      setExecution(finalStatus.execution);
      setIsPolling(false);

      if (finalStatus.status === 'done') {
        // Check if download URL is already in the status response
        if (finalStatus.downloadUrl) {
          setDownloadUrl(finalStatus.downloadUrl);
          
          // Update local storage
          updateStoredJob(resumeJobId, { 
            status: 'done', 
            downloadUrl: finalStatus.downloadUrl,
            ready: true
          });
        } else {
          // Fallback: Get download URL separately
          const downloadData = await getDownloadUrl(resumeJobId);
          setDownloadUrl(downloadData.url);
          
          // Update local storage
          updateStoredJob(resumeJobId, { 
            status: 'done', 
            downloadUrl: downloadData.url,
            ready: true
          });
        }
      }

    } catch (error) {
      console.error('Resume polling failed:', error);
      setError(error.message);
      setIsPolling(false);
      
      // Update local storage
      updateStoredJob(resumeJobId, { 
        status: 'error', 
        error: error.message 
      });
    }
  }, []);

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

      // Start polling for status
      const finalStatus = await pollJobStatus(
        response.jobId,
        (statusUpdate) => {
          console.log('Status update:', statusUpdate);
          setStatus(statusUpdate.status);
          setExecution(statusUpdate.execution);
        }
      );

      console.log('Final status:', finalStatus);
      setStatus(finalStatus.status);
      setIsPolling(false);

      if (finalStatus.status === 'done') {
        // Check if download URL is already in the status response
        if (finalStatus.downloadUrl) {
          setDownloadUrl(finalStatus.downloadUrl);
          console.log('Download URL ready from status:', finalStatus.downloadUrl);
        } else {
          // Fallback: Get download URL separately
          try {
            const downloadResponse = await getDownloadUrl(response.jobId);
            setDownloadUrl(downloadResponse.url);
            console.log('Download URL ready:', downloadResponse.filename);
          } catch (downloadError) {
            console.error('Failed to get download URL:', downloadError);
            setError(`Conversion completed but download failed: ${downloadError.message}`);
          }
        }
      } else if (finalStatus.status === 'error') {
        setError(finalStatus.error || 'Conversion failed');
      }

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

  const handleDownload = useCallback(() => {
    if (downloadUrl) {
      console.log('Opening download URL:', downloadUrl);
      window.open(downloadUrl, '_blank');
    }
  }, [downloadUrl]);

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
                                  resumeJobPolling(job.jobId);
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
