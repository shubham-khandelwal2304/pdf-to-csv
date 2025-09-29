import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useJobEvents } from '../hooks/useJobEvents';

const Uploader = ({ onUpload, disabled }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setIsDragActive(false);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      let errorMessage = 'File rejected';
      
      if (rejection.errors.some(e => e.code === 'file-too-large')) {
        errorMessage = 'File too large (max 20MB)';
      } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
        errorMessage = 'Only PDF files are allowed';
      } else if (rejection.errors.some(e => e.code === 'too-many-files')) {
        errorMessage = 'Only one file at a time';
      }
      
      onUpload(null, new Error(errorMessage));
      return;
    }

    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0], null);
    }
  }, [onUpload]);

  const onDragEnter = useCallback(() => {
    if (!disabled) {
      setIsDragActive(true);
    }
  }, [disabled]);

  const onDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    onDragEnter,
    onDragLeave,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024, // 20MB
    disabled,
    noClick: true, // We'll handle clicks manually
    noKeyboard: true
  });

  return (
    <div className="my-8">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-300 min-h-[200px] flex items-center justify-center
          bg-white/80 backdrop-blur-sm
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50/80 scale-105 border-solid' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-white/90 hover:-translate-y-1 hover:shadow-lg'
          }
          ${disabled 
            ? 'opacity-60 cursor-not-allowed bg-gray-200/50' 
            : ''
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-6 opacity-70">
            📄
          </div>
          
          <h3 className="text-xl font-semibold mb-4 text-gray-800">
            Upload PDF File
          </h3>
          
          <p className="text-gray-600 text-lg mb-6 leading-relaxed">
            {isDragActive ? (
              <span className="text-blue-600 font-medium">
                Drop your PDF file here...
              </span>
            ) : (
              <>
                Drag and drop a PDF file here, or{' '}
                <button
                  type="button"
                  className="text-blue-600 underline hover:text-blue-700 font-medium 
                           transition-colors duration-200 disabled:text-gray-400 
                           disabled:no-underline disabled:cursor-not-allowed"
                  onClick={open}
                  disabled={disabled}
                >
                  browse files
                </button>
              </>
            )}
          </p>
          
          <div className="pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-500 leading-relaxed">
              <div>• PDF files only</div>
              <div>• Maximum size: 20MB</div>
              <div>• One file at a time</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Uploader;
