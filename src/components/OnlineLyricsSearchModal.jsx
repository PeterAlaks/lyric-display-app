import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from "@/components/ui/input";

const OnlineLyricsSearchModal = ({ isOpen, onClose, darkMode }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [entering, setEntering] = useState(false);

    useLayoutEffect(() => {
        if (isOpen) {
            setVisible(true);
            setExiting(false);
            setEntering(true);
            const raf = requestAnimationFrame(() => setEntering(false));
            return () => cancelAnimationFrame(raf);
        } else {
            setEntering(false);
            setExiting(true);
            const t = setTimeout(() => { setExiting(false); setVisible(false); }, 300);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    const handleSearch = () => {
        if (!searchQuery.trim()) return;

        const queryLower = searchQuery.toLowerCase();
        const hasLyrics = queryLower.includes('lyrics');

        const finalQuery = hasLyrics ? searchQuery : `${searchQuery} lyrics`;

        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(finalQuery)}`;
        if (window.electronAPI && window.electronAPI.openInAppBrowser) {
            window.electronAPI.openInAppBrowser(googleSearchUrl);
        } else {
            window.open(googleSearchUrl, '_blank');
        }

        setSearchQuery('');
        onClose();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${(exiting || entering) ? 'opacity-0' : 'opacity-50'}`} onClick={() => onClose()} />
            <div className={`rounded-lg shadow-xl w-96 max-w-[90vw] mx-4 ${darkMode ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
                } transition-all duration-300 ease-out ${(exiting || entering) ? 'opacity-0 translate-y-1 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'border-gray-600' : 'border-gray-200'
                    }`}>
                    <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                        Search Online for Lyrics
                    </h2>
                    <button
                        onClick={onClose}
                        className={`p-1 rounded-md transition-colors ${darkMode
                            ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <Input
                        type="text"
                        placeholder="Enter song name and artist"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className={`w-full mb-4 ${darkMode
                            ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400'
                            : 'border-gray-300 bg-white'
                            }`}
                        autoFocus
                    />

                    <button
                        onClick={handleSearch}
                        disabled={!searchQuery.trim()}
                        className={`w-full py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${!searchQuery.trim()
                            ? darkMode
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-400 to-purple-600 text-white hover:from-blue-500 hover:to-purple-700'
                            }`}
                    >
                        <Search className="w-4 h-4" />
                        Search
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnlineLyricsSearchModal;
