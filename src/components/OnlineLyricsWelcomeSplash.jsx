import React, { useState, useEffect } from 'react';
import { X, Music, Globe, Key, CheckCircle2, ExternalLink, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OnlineLyricsWelcomeSplash = ({ isOpen, onClose, darkMode }) => {
    const [visible, setVisible] = useState(false);
    const [entering, setEntering] = useState(false);
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
            setEntering(true);
            const timer = setTimeout(() => setEntering(false), 50);
            return () => clearTimeout(timer);
        }

        if (!isOpen && visible) {
            setExiting(true);
            const timer = setTimeout(() => {
                setExiting(false);
                setVisible(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, visible]);

    const handleClose = () => {
        onClose?.();
    };

    if (!visible) return null;

    const overlayClasses = `fixed inset-0 z-[2000] flex items-center justify-center p-4 transition-all duration-300 ${entering || exiting ? 'opacity-0' : 'opacity-100'
        }`;

    const contentClasses = `relative w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl transform transition-all duration-300 ${darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
        } ${entering || exiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`;

    const providers = [
        {
            name: 'LRCLIB',
            description: 'Free synced lyrics database with nearly 3 million lyrics',
            requiresKey: false,
            icon: '/logos/lrclib-icon.png',
            color: 'blue',
            link: 'https://lrclib.net/',
        },
        {
            name: 'Lyrics.ovh',
            description: 'General pop/rock catalog powered by Deezer',
            requiresKey: false,
            icon: '/logos/lyricsovh-icon.png',
            color: 'emerald',
            link: 'https://lyricsovh.docs.apiary.io/',
        },
        {
            name: 'ChartLyrics',
            description: 'Free lyrics API with good coverage of popular songs',
            requiresKey: false,
            icon: '/logos/chartlyrics-icon.png',
            color: 'blue',
            link: 'http://api.chartlyrics.com/apiv1.asmx',
        },
        {
            name: 'Vagalume',
            description: 'International catalog with strong Brazilian coverage',
            requiresKey: true,
            icon: '/logos/vagalume-icon.png',
            color: 'blue',
            link: 'https://auth.vagalume.com.br/applications',
            keySteps: [
                'Visit auth.vagalume.com.br/applications',
                'Create a free account',
                'Register a new application',
                'Copy your API key from the dashboard',
                'Paste it in LyricDisplay settings',
            ],
        },
        {
            name: 'Hymnary.org',
            description: 'Historic hymn database with 20,000+ public domain texts',
            requiresKey: true,
            icon: '/logos/hymnaryorg-icon.png',
            color: 'purple',
            link: 'https://hymnary.org/help/api',
            keySteps: [
                'Visit hymnary.org/help/api',
                'Fill out the API key request form',
                'Wait 1-2 days for approval email',
                'Copy your API key from the email',
                'Paste it in LyricDisplay settings',
            ],
        },
        {
            name: 'Open Hymnal',
            description: 'Bundled collection of beloved traditional hymns (offline)',
            requiresKey: false,
            icon: '/logos/openhymnal-icon.png',
            color: 'amber',
            link: 'https://openhymnal.org/',
        },
    ];

    return (
        <div className={overlayClasses}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${entering || exiting ? 'opacity-0' : 'opacity-100'
                    }`}
                onClick={handleClose}
            />

            {/* Content Card */}
            <div className={contentClasses}>
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className={`absolute top-4 right-4 p-2 rounded-full transition-colors z-10 ${darkMode
                        ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    aria-label="Close welcome screen"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Scrollable Content */}
                <div className="overflow-y-auto max-h-[90vh] custom-scrollbar">
                    {/* Header Section */}
                    <div className={`px-8 pt-8 pb-6 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-center mb-4">
                            <div
                                className={`w-16 h-16 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20' : 'bg-gradient-to-br from-blue-100 to-purple-100'
                                    }`}
                            >
                                <Search className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                            </div>
                        </div>
                        <h1 className={`text-3xl font-bold text-center mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            Welcome to Online Lyrics Search
                        </h1>
                        <p className={`text-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>by LyricDisplay</p>
                    </div>

                    {/* How It Works Section */}
                    <div className="px-8 py-6">
                        <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            How It Works
                        </h2>
                        <div className="space-y-3">
                            {[
                                'Search across different lyrics providers simultaneously',
                                'Get live suggestions as you type or run a full catalog search',
                                'Click any result to import lyrics directly into your control panel',
                                'Providers without API keys still work with limited features',
                                'All searches are cached locally for faster performance',
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div
                                        className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${darkMode ? 'bg-blue-400' : 'bg-blue-600'
                                            }`}
                                    />
                                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Provider Cards */}
                    <div className={`px-8 py-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            <Globe className="w-5 h-5 text-blue-500" />
                            Available Providers
                        </h2>
                        <div className="grid gap-4">
                            {providers.map((provider) => {
                                const colorClasses = {
                                    emerald: darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700',
                                    blue: darkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700',
                                    purple: darkMode ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-700',
                                    amber: darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700',
                                };

                                return (
                                    <div
                                        key={provider.name}
                                        className={`rounded-lg border p-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="flex items-center gap-3">
                                                <img src={provider.icon} alt={provider.name} className="w-6 h-6 object-contain" />
                                                <div>
                                                    <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                                                        {provider.name}
                                                    </h3>
                                                    <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {provider.description}
                                                    </p>
                                                </div>
                                            </div>
                                            <a
                                                href={provider.link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className={`p-1.5 rounded-md transition-colors ${darkMode
                                                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                aria-label={`Visit ${provider.name} website`}
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3">
                                            {provider.requiresKey ? (
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700'
                                                        }`}
                                                >
                                                    <Key className="w-3 h-3" />
                                                    API Key Required
                                                </span>
                                            ) : (
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${darkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700'
                                                        }`}
                                                >
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Ready to Use
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* How to Get API Keys */}
                    <div className={`px-8 py-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                            <Key className="w-5 h-5 text-amber-500" />
                            Getting API Keys
                        </h2>
                        <div className="space-y-6">
                            {providers
                                .filter((p) => p.requiresKey)
                                .map((provider) => (
                                    <div key={provider.name}>
                                        <h3 className={`font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {provider.name}
                                        </h3>
                                        <ol className="space-y-2">
                                            {provider.keySteps.map((step, idx) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <span
                                                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'
                                                            }`}
                                                    >
                                                        {idx + 1}
                                                    </span>
                                                    <p className={`text-sm pt-0.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{step}</p>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                ))}
                        </div>
                        <div
                            className={`mt-6 p-4 rounded-lg border ${darkMode ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                                }`}
                        >
                            <p className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                                <strong>💡 Tip:</strong> API keys are stored securely on your device and never shared. You can manage them
                                anytime in the "Provider access keys" section of the Online Lyrics Search modal.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={`px-8 py-6 border-t ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex justify-end">
                            <Button onClick={handleClose} className="px-8">
                                Get Started
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: ${darkMode ? '#1f2937' : '#f3f4f6'};
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: ${darkMode ? '#4b5563' : '#d1d5db'};
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: ${darkMode ? '#6b7280' : '#9ca3af'};
  }
`}</style>
        </div>
    );
};

export default OnlineLyricsWelcomeSplash;