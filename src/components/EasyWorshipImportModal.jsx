import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Search, CheckCircle2, AlertCircle, Loader2, ChevronRight, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { EASYWORSHIP_VERSIONS, STEPS } from '../constants/easyWorship';

export default function EasyWorshipImportModal({ isOpen, onClose, darkMode }) {
    const [currentStep, setCurrentStep] = useState(STEPS.INTRO);
    const [isVisible, setIsVisible] = useState(isOpen);
    const [isMounted, setIsMounted] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState('7');
    const [databasePath, setDatabasePath] = useState(EASYWORSHIP_VERSIONS[0].defaultPath);
    const [isValidating, setIsValidating] = useState(false);
    const [isValid, setIsValid] = useState(null);
    const [validationError, setValidationError] = useState('');
    const [discoveredSongs, setDiscoveredSongs] = useState([]);
    const [selectedSongs, setSelectedSongs] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('title');
    const [destinationPath, setDestinationPath] = useState('');
    const [duplicateHandling, setDuplicateHandling] = useState('skip');
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [currentImportingSong, setCurrentImportingSong] = useState('');
    const [importResults, setImportResults] = useState({
        successful: 0,
        skipped: 0,
        failed: 0,
        errors: []
    });

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
        const versionConfig = EASYWORSHIP_VERSIONS.find(v => v.version === selectedVersion);
        if (versionConfig) {
            setDatabasePath(versionConfig.defaultPath);
        }
    }, [selectedVersion]);

    useEffect(() => {
        if (isOpen && !destinationPath) {
            if (window?.electronAPI?.easyWorship?.getUserHome) {
                window.electronAPI.easyWorship.getUserHome().then(result => {
                    if (result.success && result.homedir) {
                        const platform = window.electronAPI.getPlatform();
                        const separator = platform === 'win32' ? '\\' : '/';
                        const docsPath = `${result.homedir}${separator}Documents${separator}Imported Songs from EW`;
                        setDestinationPath(docsPath);
                    }
                }).catch(err => {
                    console.error('Failed to get user home directory:', err);
                });
            }
        }
    }, [isOpen, destinationPath]);

    const validatePath = useCallback(async () => {
        if (!databasePath.trim()) {
            setIsValid(false);
            setValidationError('Please enter a database path');
            return false;
        }

        setIsValidating(true);
        setValidationError('');

        try {
            const result = await window.electronAPI.easyWorship.validatePath(databasePath);

            if (result.success) {
                setIsValid(true);
                setDiscoveredSongs(result.songs || []);
                return true;
            } else {
                setIsValid(false);
                setValidationError(result.error || 'Invalid database path');
                return false;
            }
        } catch (error) {
            setIsValid(false);
            setValidationError('Failed to validate path: ' + error.message);
            return false;
        } finally {
            setIsValidating(false);
        }
    }, [databasePath]);

    const handleBrowseFolder = async () => {
        try {
            const result = await window.electronAPI.easyWorship.browseForPath();
            if (result && !result.canceled) {
                setDatabasePath(result.path);
                setIsValid(null);
            }
        } catch (error) {
            console.error('Failed to browse folder:', error);
        }
    };

    const handleNext = async () => {
        if (currentStep === STEPS.INTRO) {
            const valid = await validatePath();
            if (valid && discoveredSongs.length > 0) {
                setCurrentStep(STEPS.SELECT_SONGS);
            }
        } else if (currentStep === STEPS.SELECT_SONGS) {
            if (selectedSongs.size > 0) {
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

    const handleBrowseDestination = async () => {
        try {
            const result = await window.electronAPI.easyWorship.browseForDestination();
            if (result && !result.canceled) {
                setDestinationPath(result.path);
            }
        } catch (error) {
            console.error('Failed to browse destination:', error);
        }
    };

    const toggleSong = (songId) => {
        setSelectedSongs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(songId)) {
                newSet.delete(songId);
            } else {
                newSet.add(songId);
            }
            return newSet;
        });
    };

    const toggleAll = () => {
        if (selectedSongs.size === filteredSongs.length) {
            setSelectedSongs(new Set());
        } else {
            setSelectedSongs(new Set(filteredSongs.map(s => s.id)));
        }
    };

    const filteredSongs = React.useMemo(() => {
        let filtered = discoveredSongs;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(song =>
                song.title?.toLowerCase().includes(query) ||
                song.author?.toLowerCase().includes(query)
            );
        }

        const sorted = [...filtered].sort((a, b) => {
            if (sortBy === 'title') {
                return (a.title || '').localeCompare(b.title || '');
            } else if (sortBy === 'author') {
                return (a.author || '').localeCompare(b.author || '');
            }
            return 0;
        });

        return sorted;
    }, [discoveredSongs, searchQuery, sortBy]);

    const performImport = async () => {
        setIsImporting(true);
        const songsToImport = discoveredSongs.filter(s => selectedSongs.has(s.id));
        const results = {
            successful: 0,
            skipped: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < songsToImport.length; i++) {
            const song = songsToImport[i];
            setCurrentImportingSong(song.title || 'Untitled');
            setImportProgress(Math.round(((i + 1) / songsToImport.length) * 100));

            try {
                const result = await window.electronAPI.easyWorship.importSong({
                    song,
                    destinationPath,
                    duplicateHandling
                });

                if (result.success) {
                    if (result.skipped) {
                        results.skipped++;
                    } else {
                        results.successful++;
                    }
                } else {
                    results.failed++;
                    results.errors.push({ title: song.title, error: result.error });
                }
            } catch (error) {
                results.failed++;
                results.errors.push({ title: song.title, error: error.message });
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        setImportResults(results);
        setIsImporting(false);
        setCurrentStep(STEPS.COMPLETE);
    };

    const resetModal = () => {
        setCurrentStep(STEPS.INTRO);
        setIsValid(null);
        setValidationError('');
        setDiscoveredSongs([]);
        setSelectedSongs(new Set());
        setSearchQuery('');
        setImportProgress(0);
        setImportResults({ successful: 0, skipped: 0, failed: 0, errors: [] });
    };

    const handleClose = () => {
        if (currentStep === STEPS.PROGRESS && isImporting) {
            return;
        }
        resetModal();
        onClose();
    };

    if (!isVisible) return null;

    const topMenuHeight = typeof document !== 'undefined'
        ? (getComputedStyle(document.body).getPropertyValue('--top-menu-height')?.trim() || '0px')
        : '0px';

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-[1400] flex items-center justify-center p-4"
            style={{ top: topMenuHeight }}>
            {/* Backdrop */}
            <div
                className={cn(
                    "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
                    isMounted ? 'opacity-100' : 'opacity-0'
                )}
                onClick={currentStep !== STEPS.PROGRESS ? handleClose : undefined}
            />

            {/* Modal */}
            <div
                className={cn(
                    'relative w-full max-w-3xl rounded-2xl border shadow-2xl flex flex-col',
                    'h-[650px]',
                    'transform transition-all duration-200',
                    isMounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95',
                    darkMode ? 'bg-gray-900 text-gray-50 border-gray-800' : 'bg-white text-gray-900 border-gray-200'
                )}
            >
                {/* Header with Progress */}
                <div className={cn(
                    'px-6 py-5 border-b flex-shrink-0',
                    darkMode ? 'border-gray-800' : 'border-gray-200'
                )}>
                    <div className="flex items-center gap-3 mb-3">
                        <div className={cn(
                            'flex h-11 w-11 items-center justify-center rounded-xl',
                            darkMode ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-500/10 text-blue-600'
                        )}>
                            <Database className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">Import Songs from EasyWorship</h2>
                            <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                Step {currentStep + 1} of 5
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((step) => (
                            <div
                                key={step}
                                className={cn(
                                    'h-1 flex-1 rounded-full transition-colors',
                                    step <= currentStep
                                        ? 'bg-blue-500'
                                        : darkMode ? 'bg-gray-700' : 'bg-gray-200'
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* Step 0: Intro & Path Selection */}
                    {currentStep === STEPS.INTRO && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Welcome to EasyWorship Song Import</h3>
                                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                    This wizard will help you import songs from your EasyWorship library. We'll convert them to plain text files that work perfectly with LyricDisplay.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className={cn('block text-sm font-medium mb-2', darkMode ? 'text-gray-300' : 'text-gray-700')}>
                                        EasyWorship Version
                                    </label>
                                    <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                                        <SelectTrigger className={darkMode ? 'bg-gray-800 border-gray-700' : ''}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="z-[1450]">
                                            {EASYWORSHIP_VERSIONS.map(v => (
                                                <SelectItem key={v.version} value={v.version}>{v.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className={cn('block text-sm font-medium mb-2', darkMode ? 'text-gray-300' : 'text-gray-700')}>
                                        Database Path
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={databasePath}
                                            onChange={(e) => {
                                                setDatabasePath(e.target.value);
                                                setIsValid(null);
                                            }}
                                            placeholder="Enter path to EasyWorship database folder"
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
                                            {isValidating ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                'Verify'
                                            )}
                                        </Button>
                                    </div>

                                    {isValid === true && (
                                        <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Found {discoveredSongs.length} song{discoveredSongs.length !== 1 ? 's' : ''} in database
                                        </p>
                                    )}

                                    {isValid === false && validationError && (
                                        <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {validationError}
                                        </p>
                                    )}
                                </div>

                                {isValid === true && (
                                    <div className={cn(
                                        'p-4 rounded-lg',
                                        darkMode ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'
                                    )}>
                                        <p className={cn('text-sm', darkMode ? 'text-blue-300' : 'text-blue-700')}>
                                            ✓ Database validated successfully! Click "Next" to select songs to import.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 1: Song Selection */}
                    {currentStep === STEPS.SELECT_SONGS && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Select Songs to Import</h3>
                                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                    Choose which songs you'd like to import. You can search and filter the list below.
                                </p>
                            </div>

                            {/* Controls */}
                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <Search className={cn(
                                        'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                                        darkMode ? 'text-gray-500' : 'text-gray-400'
                                    )} />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search songs by title or author..."
                                        className={cn('pl-10', darkMode ? 'bg-gray-800 border-gray-700' : '')}
                                    />
                                </div>
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger className={cn('w-40', darkMode ? 'bg-gray-800 border-gray-700' : '')}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="z-[1450]">
                                        <SelectItem value="title">Sort by Title</SelectItem>
                                        <SelectItem value="author">Sort by Author</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Select All */}
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={selectedSongs.size === filteredSongs.length && filteredSongs.length > 0}
                                        onCheckedChange={toggleAll}
                                    />
                                    <span className="text-sm font-medium">
                                        Select All ({selectedSongs.size} of {filteredSongs.length} selected)
                                    </span>
                                </label>
                            </div>

                            {/* Songs List */}
                            <div className={cn(
                                'border rounded-lg max-h-96 overflow-y-auto',
                                darkMode ? 'border-gray-700' : 'border-gray-200'
                            )}>
                                {filteredSongs.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        {searchQuery ? 'No songs match your search' : 'No songs found'}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {filteredSongs.map((song) => (
                                            <label
                                                key={song.id}
                                                className={cn(
                                                    'flex items-center gap-3 p-3 cursor-pointer transition-colors',
                                                    darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                                                )}
                                            >
                                                <Checkbox
                                                    checked={selectedSongs.has(song.id)}
                                                    onCheckedChange={() => toggleSong(song.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{song.title || 'Untitled'}</p>
                                                    {song.author && (
                                                        <p className={cn('text-sm truncate', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                                            {song.author}
                                                        </p>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Destination */}
                    {currentStep === STEPS.DESTINATION && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Choose Destination</h3>
                                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                    Select where you'd like to save the converted song files.
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
                                            placeholder="Select folder to save imported songs"
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

                                {destinationPath && selectedSongs.size > 0 && (
                                    <div className={cn(
                                        'p-4 rounded-lg',
                                        darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
                                    )}>
                                        <p className="text-sm">
                                            <span className="font-medium">Ready to import:</span> {selectedSongs.size} song{selectedSongs.size !== 1 ? 's' : ''}
                                        </p>
                                        <p className={cn('text-sm mt-1', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                            Files will be saved to: {destinationPath}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Progress */}
                    {currentStep === STEPS.PROGRESS && (
                        <div className="space-y-6 py-8">
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" />
                                <h3 className="text-lg font-semibold mb-2">Importing Songs...</h3>
                                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                    Converting: {currentImportingSong}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Progress value={importProgress} className="h-2" />
                                <p className="text-sm text-center text-gray-500">
                                    {importProgress}% complete
                                </p>
                            </div>

                            <div className={cn(
                                'p-4 rounded-lg text-sm',
                                darkMode ? 'bg-gray-800' : 'bg-gray-50'
                            )}>
                                <p className={cn(darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                    Please wait while we convert your songs. This may take a few moments...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Complete */}
                    {currentStep === STEPS.COMPLETE && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className={cn(
                                    'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
                                    importResults.failed === 0
                                        ? 'bg-green-500/10 text-green-500'
                                        : 'bg-yellow-500/10 text-yellow-500'
                                )}>
                                    {importResults.failed === 0 ? (
                                        <CheckCircle2 className="w-8 h-8" />
                                    ) : (
                                        <AlertCircle className="w-8 h-8" />
                                    )}
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
                                <p className={cn('text-sm', darkMode ? 'text-gray-400' : 'text-gray-600')}>
                                    Your songs have been imported and are ready to use.
                                </p>
                            </div>

                            {/* Statistics */}
                            <div className={cn(
                                'grid grid-cols-3 gap-4 p-4 rounded-lg',
                                darkMode ? 'bg-gray-800' : 'bg-gray-50'
                            )}>
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

                            {/* Errors */}
                            {importResults.errors.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Failed Imports:</h4>
                                    <div className={cn(
                                        'max-h-40 overflow-y-auto rounded-lg border',
                                        darkMode ? 'border-gray-700' : 'border-gray-200'
                                    )}>
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

                            {/* Next Steps */}
                            <div className={cn(
                                'p-4 rounded-lg',
                                darkMode ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-100'
                            )}>
                                <h4 className={cn('text-sm font-medium mb-2', darkMode ? 'text-blue-300' : 'text-blue-700')}>
                                    What's Next?
                                </h4>
                                <ul className={cn('text-sm space-y-1', darkMode ? 'text-blue-300/80' : 'text-blue-600')}>
                                    <li>• Click "Load Imported Songs" to open the first imported song</li>
                                    <li>• Or use File → Load Lyrics File to browse your imported songs</li>
                                    <li>• All files are saved as .txt files compatible with LyricDisplay</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
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
                                            await window.electronAPI.easyWorship.openFolder(destinationPath);
                                        } catch (error) {
                                            console.error('Failed to open folder:', error);
                                        }
                                    }}
                                    className={darkMode ? 'border-gray-700 hover:bg-gray-800' : ''}
                                >
                                    Open Folder
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleClose}
                                >
                                    Done
                                </Button>
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
                                        (currentStep === STEPS.SELECT_SONGS && selectedSongs.size === 0) ||
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