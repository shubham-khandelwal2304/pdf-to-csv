import React from 'react';

const StatusBar = ({ 
  status, 
  filename, 
  error, 
  onDownload, 
  onReset, 
  isPolling,
  downloadUrl,
  execution 
}) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'processing':
        return {
          icon: downloadUrl ? '✅' : '⏳',
          text: downloadUrl ? 'Conversion completed!' : 'Converting PDF to CSV...',
          className: downloadUrl ? 'status-success' : 'status-processing'
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
        return downloadUrl ? 'border-l-4 border-green-500 bg-green-50/80' : 'border-l-4 border-blue-500 bg-blue-50/80';
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

        {execution && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">🔄 n8n Workflow Execution</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-medium">ID:</span> {execution.id}
                </div>
                <div>
                  <span className="font-medium">Status:</span> 
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                    execution.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                    execution.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {execution.status}
                  </span>
                </div>
                {execution.message && (
                  <div className="md:col-span-2">
                    <span className="font-medium">Message:</span> {execution.message}
                  </div>
                )}
                {execution.mode && (
                  <div>
                    <span className="font-medium">Mode:</span> {execution.mode}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {status === 'processing' && isPolling && (
          <div className="mb-6">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-progress"></div>
            </div>
            <p className="text-sm text-gray-600 italic">
              {downloadUrl ? 'Processing complete! Download is ready.' : 'Please wait while we process your PDF...'}
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
          {(status === 'done' || downloadUrl) && (
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
