import React from 'react';

export function WelcomeSplash({ darkMode, onOpenIntegration }) {
    return (
        <div className="space-y-8">
            {/* Hero Section with App Icon */}
            <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                    <img
                        src="/LyricDisplay-icon.png"
                        alt="LyricDisplay"
                        className="h-20 w-20"
                    />
                </div>

                <div className="space-y-2">
                    <h2 className={`text-2xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        Welcome to LyricDisplay
                    </h2>
                    <p className={`text-sm max-w-md mx-auto ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Professional real-time lyric display for live events, worship services, and streaming production
                    </p>
                </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 gap-3">
                <FeatureCard
                    icon="🎬"
                    title="Multi-Output Display"
                    description="Two independent outputs with custom styling for flexible production setups"
                    darkMode={darkMode}
                />
                <FeatureCard
                    icon="✍️"
                    title="Advanced Lyric Management"
                    description="Smart formatting, live editing canvas, and translation support"
                    darkMode={darkMode}
                />
                <FeatureCard
                    icon="🔗"
                    title="Streaming Integration"
                    description="Browser source compatibility with OBS, vMix, Wirecast or basically any software that supports web sources"
                    darkMode={darkMode}
                />
            </div>

            {/* Quick Actions */}
            <div className={`p-4 rounded-lg space-y-3 ${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                <div className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    QUICK START
                </div>
                <div className="space-y-2 text-sm">
                    <QuickAction darkMode={darkMode}>
                        Load lyrics with <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>Ctrl+O</kbd>
                    </QuickAction>
                    <QuickAction darkMode={darkMode}>
                        Configure output settings in the side panel
                    </QuickAction>
                    <QuickAction darkMode={darkMode}>
                        Integrate with your streaming software
                        {onOpenIntegration && (
                            <button
                                onClick={onOpenIntegration}
                                className={`ml-2 text-xs underline hover:no-underline ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}
                            >
                                View guide
                            </button>
                        )}
                    </QuickAction>
                </div>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, description, darkMode }) {
    return (
        <div className={`flex gap-3 p-3 rounded-lg border ${darkMode ? 'bg-gray-800/30 border-gray-700/50' : 'bg-white border-gray-200'}`}>
            <div className="text-2xl flex-shrink-0">{icon}</div>
            <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                    {title}
                </h3>
                <p className={`text-xs leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {description}
                </p>
            </div>
        </div>
    );
}

function QuickAction({ children, darkMode }) {
    return (
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${darkMode ? 'bg-blue-400' : 'bg-blue-600'}`} />
            <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                {children}
            </span>
        </div>
    );
}