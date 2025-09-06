import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from "@/components/ui/input";

const OnlineLyricsSearchModal = ({ isOpen, onClose, darkMode }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = () => {
        if (!searchQuery.trim()) return;

        // Check if query already contains "lyrics" (case insensitive)
        const queryLower = searchQuery.toLowerCase();
        const hasLyrics = queryLower.includes('lyrics');

        // Construct search query - only append "lyrics" if not already present
        const finalQuery = hasLyrics ? searchQuery : `${searchQuery} lyrics`;

        // Open Google search in new tab
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(finalQuery)}`;
        window.open(googleSearchUrl, '_blank');

        // Close modal and clear input
        setSearchQuery('');
        onClose();
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`rounded-lg shadow-xl w-96 max-w-[90vw] mx-4 ${darkMode ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
                }`}>
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