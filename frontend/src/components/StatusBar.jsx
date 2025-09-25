import React from 'react';

const StatusBar = ({ 
  status, 
  filename, 
  error, 
  onDownload, 
  onReset, 
  isPolling,
  downloadUrl 
}) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'processing':
        return {
          icon: '⏳',
          text: 'Converting PDF to CSV...',
          className: 'status-processing'
        };
      case 'done':
        return {
          icon: '✅',
          text: 'Conversion completed!',
          className: 'status-success'
        };
      case 'error':
        return {
          icon: '❌',
          text: 'Conversion failed',
          className: 'status-error'
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

  if (!statusDisplay) {
    return null;
  }

  const getStatusStyles = () => {
    switch (status) {
      case 'processing':
        return 'border-l-4 border-blue-500 bg-blue-50/80';
      case 'done':
        return 'border-l-4 border-green-500 bg-green-50/80';
      case 'error':
        return 'border-l-4 border-red-500 bg-red-50/80';
      default:
        return '';
    }
  };

  return (
    <div className="my-8">
      <div className={`card p-6 ${getStatusStyles()}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{statusDisplay.icon}</span>
          <span className="text-xl font-semibold text-gray-800">
            {statusDisplay.text}
          </span>
        </div>
        
        {filename && (
          <div className="mb-4 text-gray-600">
            <span className="font-medium text-gray-800">File:</span> {filename}
          </div>
        )}
        
        {status === 'processing' && isPolling && (
          <div className="mb-6">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-progress"></div>
            </div>
            <p className="text-sm text-gray-600 italic">
              Please wait while we process your PDF...
            </p>
          </div>
        )}
        
        {status === 'error' && error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-200 rounded-lg">
            <div className="text-red-800">
              <span className="font-medium">Error:</span> {error}
            </div>
          </div>
        )}
        
        <div className="flex flex-wrap gap-3">
          {status === 'done' && (
            <button 
              className="btn btn-success flex items-center gap-2"
              onClick={onDownload}
              disabled={!downloadUrl}
            >
              <span>📥</span>
              Download CSV
            </button>
          )}
          
          <button 
            className="btn btn-secondary flex items-center gap-2"
            onClick={onReset}
          >
            <span>🔄</span>
            Convert Another File
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
