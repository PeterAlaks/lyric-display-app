import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Search, CheckCircle2, AlertCircle, Loader2, ChevronRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { PRESENTATION_IMPORT_STEPS as STEPS } from '../constants/presentationImport';

const LAST_PRESENTATION_FOLDER_STORAGE_KEY = 'lyricdisplay_presentation_import_last_folder';

export default function PresentationImportModal({ isOpen, onClose, darkMode }) {
  const [currentStep, setCurrentStep] = useState(STEPS.INTRO);
  const [isVisible, setIsVisible] = useState(isOpen);
  const [isMounted, setIsMounted] = useState(false);

  const [folderPath, setFolderPath] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(null);
  const [validationError, setValidationError] = useState('');

  const [discoveredPresentations, setDiscoveredPresentations] = useState([]);
  const [selectedPresentations, setSelectedPresentations] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('title');

  const [destinationPath, setDestinationPath] = useState('');
  const [duplicateHandling, setDuplicateHandling] = useState('skip');

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [currentImportingFile, setCurrentImportingFile] = useState('');
  const [importResults, setImportResults] = useState({
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: []
  });

  const getStoredFolderPath = useCallback(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return '';
      }
      return window.localStorage.getItem(LAST_PRESENTATION_FOLDER_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }, []);

  const persistFolderPath = useCallback((nextPath) => {
    const normalized = String(nextPath || '').trim();
    if (!normalized) {
      return;
    }
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      window.localStorage.setItem(LAST_PRESENTATION_FOLDER_STORAGE_KEY, normalized);
    } catch { }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsMounted(false);
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsMounted(true);
        });
      });
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isOpen || folderPath.trim()) {
      return;
    }
    const storedPath = getStoredFolderPath();
    if (storedPath) {
      setFolderPath(storedPath);
      setIsValid(null);
    }
  }, [isOpen, folderPath, getStoredFolderPath]);

  useEffect(() => {
    if (isOpen && !destinationPath && window?.electronAPI?.presentation?.getUserHome) {
      window.electronAPI.presentation.getUserHome().then((result) => {
        if (result?.success && result.homedir) {
          const platform = window.electronAPI.getPlatform();
          const separator = platform === 'win32' ? '\\' : '/';
          setDestinationPath(`${result.homedir}${separator}Documents${separator}Imported Lyrics from Presentations`);
        }
      }).catch((err) => {
        console.error('Failed to get user home directory:', err);
      });
    }
  }, [isOpen, destinationPath]);

  const validatePath = useCallback(async () => {
    if (!folderPath.trim()) {
      setIsValid(false);
      setValidationError('Please enter a folder path');
      return false;
    }

    setIsValidating(true);
    setValidationError('');

    try {
      const result = await window.electronAPI.presentation.validatePath(folderPath);
      if (result.success) {
        const resolvedPath = result.resolvedPath || folderPath;
        if (result.resolvedPath && result.resolvedPath !== folderPath) {
          setFolderPath(result.resolvedPath);
        }
        persistFolderPath(resolvedPath);

        setIsValid(true);
        setDiscoveredPresentations(result.presentations || []);
        return true;
      }

      setIsValid(false);
      setValidationError(result.error || 'Invalid folder path');
      return false;
    } catch (error) {
      setIsValid(false);
      setValidationError('Failed to validate folder: ' + error.message);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [folderPath, persistFolderPath]);

  const handleBrowseFolder = async () => {
    try {
      const result = await window.electronAPI.presentation.browseForPath();
      if (result && !result.canceled) {
        setFolderPath(result.path);
        persistFolderPath(result.path);
        setIsValid(null);
      }
    } catch (error) {
      console.error('Failed to browse folder:', error);
    }
  };

  const handleBrowseDestination = async () => {
    try {
      const result = await window.electronAPI.presentation.browseForDestination();
      if (result && !result.canceled) {
        setDestinationPath(result.path);
      }
    } catch (error) {
      console.error('Failed to browse destination:', error);
    }
  };

  const handleNext = async () => {
    if (currentStep === STEPS.INTRO) {
      const valid = await validatePath();
      if (valid && discoveredPresentations.length > 0) {
        setCurrentStep(STEPS.SELECT_FILES);
      }
    } else if (currentStep === STEPS.SELECT_FILES) {
      if (selectedPresentations.size > 0) {
        setCurrentStep(STEPS.DESTINATION);
      }
    } else if (currentStep === STEPS.DESTINATION) {
      if (destinationPath.trim()) {
        setCurrentStep(STEPS.PROGRESS);
        await performImport();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > STEPS.INTRO && currentStep < STEPS.PROGRESS) {
      setCurrentStep(currentStep - 1);
    }
  };

  const togglePresentation = (id) => {
    setSelectedPresentations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredPresentations = React.useMemo(() => {
    let filtered = discoveredPresentations;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        item.title?.toLowerCase().includes(query)
        || item.fileName?.toLowerCase().includes(query)
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return (a.fileName || '').localeCompare(b.fileName || '');
    });

    return sorted;
  }, [discoveredPresentations, searchQuery, sortBy]);

  const toggleAll = () => {
    if (selectedPresentations.size === filteredPresentations.length) {
      setSelectedPresentations(new Set());
    } else {
      setSelectedPresentations(new Set(filteredPresentations.map((item) => item.id)));
    }
  };

  const performImport = async () => {
    setIsImporting(true);

    const filesToImport = discoveredPresentations.filter((item) => selectedPresentations.has(item.id));
    const results = {
      successful: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < filesToImport.length; i++) {
      const presentation = filesToImport[i];
      setCurrentImportingFile(presentation.fileName || 'Untitled');
      setImportProgress(Math.round(((i + 1) / filesToImport.length) * 100));

      try {
        const result = await window.electronAPI.presentation.importFile({
          presentation,
          destinationPath,
          duplicateHandling
        });

        if (result.success) {
          if (result.skipped) {
            results.skipped += 1;
          } else {
            results.successful += 1;
          }
        } else {
          results.failed += 1;
          results.errors.push({ title: presentation.fileName, error: result.error });
        }
      } catch (error) {
        results.failed += 1;
        results.errors.push({ title: presentation.fileName, error: error.message });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setImportResults(results);
    setIsImporting(false);
    setCurrentStep(STEPS.COMPLETE);
  };

  const resetModal = () => {
    setCurrentStep(STEPS.INTRO);
    setIsValid(null);
    setValidationError('');
    setDiscoveredPresentations([]);
    setSelectedPresentations(new Set());
    setSearchQuery('');
    setImportProgress(0);
    setCurrentImportingFile('');
    setImportResults({ successful: 0, skipped: 0, failed: 0, errors: [] });
  };

  const handleClose = () => {
    if (currentStep === STEPS.PROGRESS && isImporting) {
      return;
    }

    resetModal();
    onClose();
  };

  if (!isVisible) {
    return null;
  }

  const topMenuHeight = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--top-menu-height')?.trim() || '0px')
    : '0px';

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1400] flex items-center justify-center p-4"
      style={{ top: topMenuHeight }}
    >
      <div
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          isMounted ? 'opacity-100' : 'opacity-0'
        )}
        onClick={currentStep !== STEPS.PROGRESS ? handleClose : undefined}
      />

      <div
        className={cn(
          'relative w-full max-w-3xl rounded-2xl border shadow-2xl flex flex-col',
          'h-[650px]',
          'transform transition-all duration-200',
          isMounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95',
          darkMode ? 'bg-gray-900 text-gray-50 border-gray-800' : 'bg-white text-gray-900 border-gray-200'
        )}
      >
        <div className={cn('px-6 py-5 border-b flex-shrink-0', darkMode ? 'border-gray-800' : 'border-gray-200')}>
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl',
              darkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-500/10 text-blue-600'
            )}>
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Import Lyrics from PowerPoint</h2>
              <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                Step {currentStep + 1} of 5
              </p>
            </div>
          </div>

          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  step <= currentStep ? 'bg-blue-500' : darkMode ? 'bg-gray-700' : 'bg-gray-200'
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentStep === STEPS.INTRO && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Choose PowerPoint Source Folder</h3>
                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                  Select a folder containing PowerPoint `.pptx` presentation files.
                </p>
              </div>

              <div>
                <label className={cn('block text-sm font-medium mb-2', darkMode ? 'text-gray-300' : 'text-gray-700')}>
                  Presentation Folder
                </label>
                <div className="flex gap-2">
                  <Input
                    value={folderPath}
                    onChange={(e) => {
                      setFolderPath(e.target.value);
                      setIsValid(null);
                    }}
                    placeholder="Enter path to folder containing .pptx files"
                    className={cn(
                      'flex-1',
                      darkMode ? 'bg-gray-800 border-gray-700' : '',
                      isValid === true && 'border-green-500',
                      isValid === false && 'border-red-500'
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBrowseFolder}
                    className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
                  >
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={validatePath}
                    disabled={isValidating}
                    className={darkMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
                  >
                    {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                  </Button>
                </div>

                {isValid === true && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Found {discoveredPresentations.length} presentation file{discoveredPresentations.length !== 1 ? 's' : ''}
                  </p>
                )}

                {isValid === false && validationError && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {validationError}
                  </p>
                )}
              </div>

              {isValid === true && discoveredPresentations.length === 0 && (
                <div className={cn(
                  'p-4 rounded-lg',
                  darkMode ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-100'
                )}>
                  <p className={cn('text-sm', darkMode ? 'text-yellow-300' : 'text-yellow-700')}>
                    Folder is valid, but no `.pptx` files were found.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === STEPS.SELECT_FILES && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Presentations to Import</h3>
                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                  Choose one or more presentation files to convert into lyric text files.
                </p>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className={cn(
                    'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                    darkMode ? 'text-gray-500' : 'text-gray-400'
                  )} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search files by title or filename..."
                    className={cn('pl-10', darkMode ? 'bg-gray-800 border-gray-700' : '')}
                  />
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className={cn('w-40', darkMode ? 'bg-gray-800 border-gray-700' : '')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[1450]">
                    <SelectItem value="title">Sort by Title</SelectItem>
                    <SelectItem value="filename">Sort by Filename</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedPresentations.size === filteredPresentations.length && filteredPresentations.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-sm font-medium">
                    Select All ({selectedPresentations.size} of {filteredPresentations.length} selected)
                  </span>
                </label>
              </div>

              <div className={cn('border rounded-lg max-h-96 overflow-y-auto', darkMode ? 'border-gray-700' : 'border-gray-200')}>
                {filteredPresentations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {searchQuery ? 'No files match your search' : 'No presentation files found'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredPresentations.map((item) => (
                      <label
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                          darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                        )}
                      >
                        <Checkbox
                          checked={selectedPresentations.has(item.id)}
                          onCheckedChange={() => togglePresentation(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.title || 'Untitled'}</p>
                          <p className={cn('text-sm truncate', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                            {item.fileName}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === STEPS.DESTINATION && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Choose Destination</h3>
                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                  Select where to save the converted text files.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={cn('block text-sm font-medium mb-2', darkMode ? 'text-gray-300' : 'text-gray-700')}>
                    Save Location
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={destinationPath}
                      onChange={(e) => setDestinationPath(e.target.value)}
                      placeholder="Select folder to save imported lyrics"
                      className={cn('flex-1', darkMode ? 'bg-gray-800 border-gray-700' : '')}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBrowseDestination}
                      className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Browse
                    </Button>
                  </div>
                </div>

                <div>
                  <label className={cn('block text-sm font-medium mb-2', darkMode ? 'text-gray-300' : 'text-gray-700')}>
                    Duplicate Handling
                  </label>
                  <Select value={duplicateHandling} onValueChange={setDuplicateHandling}>
                    <SelectTrigger className={darkMode ? 'bg-gray-800 border-gray-700' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[1450]">
                      <SelectItem value="skip">Skip existing files</SelectItem>
                      <SelectItem value="overwrite">Overwrite existing files</SelectItem>
                      <SelectItem value="rename">Create new with (1), (2) suffix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {destinationPath && selectedPresentations.size > 0 && (
                  <div className={cn(
                    'p-4 rounded-lg',
                    darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
                  )}>
                    <p className="text-sm">
                      <span className="font-medium">Ready to import:</span> {selectedPresentations.size} presentation file{selectedPresentations.size !== 1 ? 's' : ''}
                    </p>
                    <p className={cn('text-sm mt-1', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                      Files will be saved to: {destinationPath}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === STEPS.PROGRESS && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
                <h3 className="text-lg font-semibold mb-2">Importing Presentations...</h3>
                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                  Converting: {currentImportingFile}
                </p>
              </div>

              <div className="space-y-2">
                <Progress value={importProgress} className="h-2" />
                <p className="text-sm text-center text-gray-500">{importProgress}% complete</p>
              </div>

              <div className={cn('p-4 rounded-lg text-sm', darkMode ? 'bg-gray-800' : 'bg-gray-50')}>
                <p className={cn(darkMode ? 'text-gray-400' : 'text-gray-600')}>
                  Please wait while we convert your presentations. This may take a few moments...
                </p>
              </div>
            </div>
          )}

          {currentStep === STEPS.COMPLETE && (
            <div className="space-y-6">
              <div className="text-center">
                <div className={cn(
                  'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
                  importResults.failed === 0 ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                )}>
                  {importResults.failed === 0 ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                </div>
                <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                  Your presentation lyrics have been imported and are ready to use.
                </p>
              </div>

              <div className={cn('grid grid-cols-3 gap-4 p-4 rounded-lg', darkMode ? 'bg-gray-800' : 'bg-gray-50')}>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500">{importResults.successful}</p>
                  <p className="text-sm text-gray-500">Successful</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-500">{importResults.skipped}</p>
                  <p className="text-sm text-gray-500">Skipped</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{importResults.failed}</p>
                  <p className="text-sm text-gray-500">Failed</p>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Failed Imports:</h4>
                  <div className={cn('max-h-40 overflow-y-auto rounded-lg border', darkMode ? 'border-gray-700' : 'border-gray-200')}>
                    {importResults.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'p-3 text-sm border-b last:border-b-0',
                          darkMode ? 'border-gray-700' : 'border-gray-200'
                        )}
                      >
                        <p className="font-medium">{err.title}</p>
                        <p className="text-red-500 text-xs mt-1">{err.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={cn(
          'px-6 py-4 border-t flex items-center justify-between flex-shrink-0',
          darkMode ? 'border-gray-800' : 'border-gray-200'
        )}>
          <div>
            {currentStep > STEPS.INTRO && currentStep < STEPS.PROGRESS && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-3">
            {currentStep === STEPS.COMPLETE ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await window.electronAPI.presentation.openFolder(destinationPath);
                    } catch (error) {
                      console.error('Failed to open folder:', error);
                    }
                  }}
                  className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
                >
                  Open Folder
                </Button>
                <Button type="button" onClick={handleClose}>Done</Button>
              </>
            ) : currentStep !== STEPS.PROGRESS ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    (currentStep === STEPS.INTRO && isValid !== true) ||
                    (currentStep === STEPS.SELECT_FILES && selectedPresentations.size === 0) ||
                    (currentStep === STEPS.DESTINATION && !destinationPath.trim())
                  }
                  className={darkMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
                >
                  {currentStep === STEPS.DESTINATION ? 'Start Import' : 'Next'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}