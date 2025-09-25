import React, { useState, useCallback } from 'react';
import Uploader from './components/Uploader';
import StatusBar from './components/StatusBar';
import { uploadPdf, pollJobStatus, getDownloadUrl, ApiError } from './api';

function App() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [filename, setFilename] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);

  const resetState = useCallback(() => {
    setJobId(null);
    setStatus(null);
    setFilename(null);
    setError(null);
    setIsUploading(false);
    setIsPolling(false);
    setDownloadUrl(null);
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
      setIsUploading(false);
      setIsPolling(true);

      // Start polling for status
      const finalStatus = await pollJobStatus(
        response.jobId,
        (statusUpdate) => {
          console.log('Status update:', statusUpdate);
          setStatus(statusUpdate.status);
        }
      );

      console.log('Final status:', finalStatus);
      setStatus(finalStatus.status);
      setIsPolling(false);

      if (finalStatus.status === 'done') {
        // Get download URL
        try {
          const downloadResponse = await getDownloadUrl(response.jobId);
          setDownloadUrl(downloadResponse.url);
          console.log('Download URL ready:', downloadResponse.filename);
        } catch (downloadError) {
          console.error('Failed to get download URL:', downloadError);
          setError(`Conversion completed but download failed: ${downloadError.message}`);
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

  const isDisabled = isUploading || isPolling;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
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
              <Uploader 
                onUpload={handleUpload}
                disabled={isDisabled}
              />
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
