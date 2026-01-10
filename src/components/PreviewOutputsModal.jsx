import React, { useState, useEffect, useRef } from 'react';
import { Monitor, RefreshCw, ExternalLink } from 'lucide-react';

const RESOLUTION_OPTIONS = [
    { label: '1920×1080 (Full HD)', width: 1920, height: 1080 },
    { label: '1280×720 (HD)', width: 1280, height: 720 },
    { label: '1024×768 (XGA)', width: 1024, height: 768 },
    { label: '1366×768 (WXGA)', width: 1366, height: 768 },
    { label: '1440×900 (WXGA+)', width: 1440, height: 900 },
    { label: '1600×900 (HD+)', width: 1600, height: 900 },
];

const PreviewOutputsModal = ({ darkMode }) => {
    const [output1Url, setOutput1Url] = useState('');
    const [output2Url, setOutput2Url] = useState('');
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0);

    const [output1Resolution, setOutput1Resolution] = useState(RESOLUTION_OPTIONS[0]);
    const [output2Resolution, setOutput2Resolution] = useState(RESOLUTION_OPTIONS[0]);
    const [output1MockImage, setOutput1MockImage] = useState(false);
    const [output2MockImage, setOutput2MockImage] = useState(false);

    const output1ContainerRef = useRef(null);
    const output2ContainerRef = useRef(null);
    const [output1Dimensions, setOutput1Dimensions] = useState({ width: 0, height: 0 });
    const [output2Dimensions, setOutput2Dimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (entry.target === output1ContainerRef.current) {
                    setOutput1Dimensions({ width, height });
                } else if (entry.target === output2ContainerRef.current) {
                    setOutput2Dimensions({ width, height });
                }
            }
        });

        if (output1ContainerRef.current) {
            resizeObserver.observe(output1ContainerRef.current);
        }
        if (output2ContainerRef.current) {
            resizeObserver.observe(output2ContainerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

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

    const getIframeTransform = (resolution, containerDimensions) => {
        const containerWidth = containerDimensions.width;
        const containerHeight = containerDimensions.height;

        if (!containerWidth || !containerHeight) {
            return null;
        }

        const scaleX = containerWidth / resolution.width;
        const scaleY = containerHeight / resolution.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = resolution.width * scale;
        const scaledHeight = resolution.height * scale;

        return {
            wrapper: {
                width: `${scaledWidth}px`,
                height: `${scaledHeight}px`,
            },
            iframe: {
                width: `${resolution.width}px`,
                height: `${resolution.height}px`,
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
            }
        };
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

                    {/* Resolution and Mock Image Controls */}
                    <div className={`px-2.5 py-2 border-b flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'
                        }`}>
                        <div className="flex items-center gap-2">
                            <label className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                Resolution:
                            </label>
                            <select
                                value={RESOLUTION_OPTIONS.findIndex(r => r.width === output1Resolution.width && r.height === output1Resolution.height)}
                                onChange={(e) => setOutput1Resolution(RESOLUTION_OPTIONS[parseInt(e.target.value)])}
                                className={`text-xs px-2 py-1 rounded border flex-1 ${darkMode
                                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                                    : 'bg-white border-gray-300 text-gray-800'
                                    }`}
                            >
                                {RESOLUTION_OPTIONS.map((res, idx) => (
                                    <option key={idx} value={idx}>
                                        {res.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="output1-mock"
                                checked={output1MockImage}
                                onChange={(e) => setOutput1MockImage(e.target.checked)}
                                className="w-3 h-3"
                            />
                            <label
                                htmlFor="output1-mock"
                                className={`text-xs cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                            >
                                Add Mock IMAG
                            </label>
                        </div>
                    </div>

                    <div
                        ref={output1ContainerRef}
                        className="relative bg-black overflow-hidden w-full flex items-center justify-center"
                        style={{
                            aspectRatio: '16 / 9',
                        }}
                    >
                        {(() => {
                            const transform = getIframeTransform(output1Resolution, output1Dimensions);
                            if (!transform) return null;
                            return (
                                <>
                                    {output1MockImage && (
                                        <div
                                            className="absolute z-0"
                                            style={{
                                                ...transform.wrapper,
                                                backgroundImage: 'url(/images/congregation-image.jpg)',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                            }}
                                        />
                                    )}
                                    <div
                                        className="z-10"
                                        style={transform.wrapper}
                                    >
                                        <iframe
                                            key={`output1-${key}`}
                                            src={output1Url || null}
                                            title="Output 1 Preview"
                                            style={{
                                                ...transform.iframe,
                                                border: 'none',
                                                display: 'block',
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    </div>
                                </>
                            );
                        })()}
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                        )}
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

                    {/* Resolution and Mock Image Controls */}
                    <div className={`px-2.5 py-2 border-b flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'
                        }`}>
                        <div className="flex items-center gap-2">
                            <label className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                Resolution:
                            </label>
                            <select
                                value={RESOLUTION_OPTIONS.findIndex(r => r.width === output2Resolution.width && r.height === output2Resolution.height)}
                                onChange={(e) => setOutput2Resolution(RESOLUTION_OPTIONS[parseInt(e.target.value)])}
                                className={`text-xs px-2 py-1 rounded border flex-1 ${darkMode
                                    ? 'bg-gray-700 border-gray-600 text-gray-200'
                                    : 'bg-white border-gray-300 text-gray-800'
                                    }`}
                            >
                                {RESOLUTION_OPTIONS.map((res, idx) => (
                                    <option key={idx} value={idx}>
                                        {res.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="output2-mock"
                                checked={output2MockImage}
                                onChange={(e) => setOutput2MockImage(e.target.checked)}
                                className="w-3 h-3"
                            />
                            <label
                                htmlFor="output2-mock"
                                className={`text-xs cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                            >
                                Add Mock IMAG
                            </label>
                        </div>
                    </div>

                    <div
                        ref={output2ContainerRef}
                        className="relative bg-black overflow-hidden w-full flex items-center justify-center"
                        style={{
                            aspectRatio: '16 / 9',
                        }}
                    >
                        {(() => {
                            const transform = getIframeTransform(output2Resolution, output2Dimensions);
                            if (!transform) return null;
                            return (
                                <>
                                    {output2MockImage && (
                                        <div
                                            className="absolute z-0"
                                            style={{
                                                ...transform.wrapper,
                                                backgroundImage: 'url(/images/congregation-image.jpg)',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                            }}
                                        />
                                    )}
                                    <div
                                        className="z-10"
                                        style={transform.wrapper}
                                    >
                                        <iframe
                                            key={`output2-${key}`}
                                            src={output2Url || null}
                                            title="Output 2 Preview"
                                            style={{
                                                ...transform.iframe,
                                                border: 'none',
                                                display: 'block',
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    </div>
                                </>
                            );
                        })()}
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                        )}
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