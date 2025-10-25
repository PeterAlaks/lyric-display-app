import React, { useState, useEffect } from 'react';
import { Monitor, RefreshCw, ExternalLink } from 'lucide-react';

const PreviewOutputsModal = ({ darkMode }) => {
    const [output1Url, setOutput1Url] = useState('');
    const [output2Url, setOutput2Url] = useState('');
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0);

    useEffect(() => {
        const isDev = window.location.port === '5173';

        if (isDev) {
            setOutput1Url('http://localhost:5173/output1');
            setOutput2Url('http://localhost:5173/output2');
        } else {
            const baseUrl = window.location.origin;
            setOutput1Url(`${baseUrl}/#/output1`);
            setOutput2Url(`${baseUrl}/#/output2`);
        }

        const timer = setTimeout(() => setLoading(false), 1000);
        return () => clearTimeout(timer);
    }, []);

    const handleRefresh = () => {
        setLoading(true);
        setKey(prev => prev + 1);
        setTimeout(() => setLoading(false), 1000);
    };

    const handleOpenOutput = (outputNumber) => {
        if (window?.electronAPI?.openOutputWindow) {
            window.electronAPI.openOutputWindow(outputNumber);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header with refresh button */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Monitor className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        Live preview of both output displays
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
                        }`}
                    title="Refresh both previews"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Preview Grid */}
            <div className="grid grid-cols-2 gap-3">
                {/* Output 1 Preview */}
                <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                    }`}>
                    <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'
                        }`}>
                        <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'
                            }`}>
                            Output 1
                        </h3>
                        <button
                            onClick={() => handleOpenOutput(1)}
                            className={`p-1 rounded hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-100'
                                }`}
                            title="Open in window"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="relative bg-black" style={{ height: '240px' }}>
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                        )}
                        <iframe
                            key={`output1-${key}`}
                            src={output1Url}
                            className="w-full h-full"
                            title="Output 1 Preview"
                            style={{ border: 'none' }}
                        />
                    </div>
                </div>

                {/* Output 2 Preview */}
                <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                    }`}>
                    <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'
                        }`}>
                        <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'
                            }`}>
                            Output 2
                        </h3>
                        <button
                            onClick={() => handleOpenOutput(2)}
                            className={`p-1 rounded hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            title="Open in window"
                        >
                            <ExternalLink className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="relative bg-black" style={{ height: '240px' }}>
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                        )}
                        <iframe
                            key={`output2-${key}`}
                            src={output2Url}
                            className="w-full h-full"
                            title="Output 2 Preview"
                            style={{ border: 'none' }}
                        />
                    </div>
                </div>
            </div>

            {/* Info Note */}
            <div className={`rounded-lg p-3 text-xs ${darkMode ? 'bg-blue-900/20 border border-blue-700/30 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'
                }`}>
                <p className="font-medium mb-1">💡 Preview Tips:</p>
                <ul className="space-y-1 ml-4 list-disc">
                    <li>Live previews update in real-time as you make changes</li>
                    <li>Click the <ExternalLink className="w-3 h-3 inline" /> icon to open full window</li>
                    <li>Use the refresh button if previews don't update</li>
                    <li>Previews show exactly how style is rendered on your streaming/production software</li>
                </ul>
            </div>
        </div>
    );
};

export default PreviewOutputsModal;
