import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { X, CheckCircle, XCircle, FileText, User, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useControlSocket } from '../context/ControlSocketProvider';
import { useLyricsState } from '../hooks/useStoreSelectors';
import useToast from '../hooks/useToast';
import { processRawTextToLines } from '../utils/parseLyrics';
import { parseLrc } from '../utils/parseLrc';

const animationDuration = 220;

const DraftApprovalModal = ({ darkMode }) => {
    const [draftQueue, setDraftQueue] = useState([]);
    const [currentDraft, setCurrentDraft] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [entering, setEntering] = useState(false);

    const processedDraftsRef = useRef(new Set());
    const displayDraftRef = useRef(null);

    const { emitLyricsDraftApprove, emitLyricsDraftReject } = useControlSocket();
    const { setLyrics, setRawLyricsContent, setLyricsFileName, setLyricsTimestamps, selectLine } = useLyricsState();
    const { showToast } = useToast();

    useEffect(() => {
        const handleDraftReceived = (event) => {
            const draft = event.detail;
            if (!draft) return;

            const draftId = `${draft.title}_${draft.submittedBy?.timestamp || Date.now()}`;
            if (processedDraftsRef.current.has(draftId)) {
                console.log('Duplicate draft detected, ignoring:', draftId);
                return;
            }
            processedDraftsRef.current.add(draftId);

            setDraftQueue(prev => [...prev, draft]);

            showToast({
                title: 'New lyrics draft',
                message: `"${draft.title}" from ${draft.submittedBy?.clientType || 'controller'}`,
                variant: 'info',
                duration: 5000,
            });

            setTimeout(() => {
                processedDraftsRef.current.delete(draftId);
            }, 300000);
        };

        window.addEventListener('lyrics-draft-received', handleDraftReceived);
        return () => window.removeEventListener('lyrics-draft-received', handleDraftReceived);
    }, [showToast]);

    useEffect(() => {
        if (!currentDraft && draftQueue.length > 0) {
            setCurrentDraft(draftQueue[0]);
        }
    }, [draftQueue, currentDraft]);

    useLayoutEffect(() => {
        if (currentDraft) {
            displayDraftRef.current = currentDraft;
            setVisible(true);
            setExiting(false);
            setEntering(true);
            const raf = requestAnimationFrame(() => setEntering(false));
            return () => cancelAnimationFrame(raf);
        } else if (visible) {
            setEntering(false);
            setExiting(true);
            const t = setTimeout(() => {
                setExiting(false);
                setVisible(false);
                displayDraftRef.current = null;
            }, animationDuration);
            return () => clearTimeout(t);
        }
    }, [currentDraft, visible]);

    const handleApprove = useCallback(async () => {
        if (!currentDraft || isProcessing) return;

        setIsProcessing(true);

        try {
            const processedLines = currentDraft.processedLines || processRawTextToLines(currentDraft.rawText);

            const hasLrcTimestamps = /^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/.test((currentDraft.rawText || '').trim());
            let timestamps = [];

            if (hasLrcTimestamps) {
                try {
                    const parsed = parseLrc(currentDraft.rawText);
                    timestamps = parsed.timestamps || [];
                } catch (error) {
                    console.warn('Failed to parse LRC timestamps from draft:', error);
                }
            }

            setLyrics(processedLines);
            setRawLyricsContent(currentDraft.rawText);
            setLyricsFileName(currentDraft.title);
            setLyricsTimestamps(timestamps);
            selectLine(null);

            const success = emitLyricsDraftApprove({
                draftId: currentDraft.draftId,
                title: currentDraft.title,
                rawText: currentDraft.rawText,
                processedLines
            });

            if (success) {
                showToast({
                    title: 'Draft approved',
                    message: `"${currentDraft.title}" loaded successfully`,
                    variant: 'success'
                });

                setDraftQueue(prev => prev.slice(1));
                setCurrentDraft(null);
                setShowRejectInput(false);
                setRejectReason('');
            } else {
                throw new Error('Failed to emit approval');
            }
        } catch (error) {
            console.error('Draft approval error:', error);
            showToast({
                title: 'Approval failed',
                message: 'Could not approve draft. Please try again.',
                variant: 'error'
            });
        } finally {
            setIsProcessing(false);
        }
    }, [currentDraft, isProcessing, emitLyricsDraftApprove, setLyrics, setRawLyricsContent, setLyricsFileName, setLyricsTimestamps, selectLine, showToast]);

    const handleReject = useCallback(() => {
        if (!currentDraft || isProcessing) return;

        setIsProcessing(true);

        try {
            const success = emitLyricsDraftReject({
                draftId: currentDraft.draftId,
                title: currentDraft.title,
                reason: rejectReason.trim() || 'No reason provided'
            });

            if (success) {
                showToast({
                    title: 'Draft rejected',
                    message: `"${currentDraft.title}" was rejected`,
                    variant: 'info'
                });

                setDraftQueue(prev => prev.slice(1));
                setCurrentDraft(null);
                setShowRejectInput(false);
                setRejectReason('');
            } else {
                throw new Error('Failed to emit rejection');
            }
        } catch (error) {
            console.error('Draft rejection error:', error);
            showToast({
                title: 'Rejection failed',
                message: 'Could not reject draft. Please try again.',
                variant: 'error'
            });
        } finally {
            setIsProcessing(false);
        }
    }, [currentDraft, isProcessing, rejectReason, emitLyricsDraftReject, showToast]);

    const handleDismiss = useCallback(() => {
        setDraftQueue(prev => prev.slice(1));
        setCurrentDraft(null);
        setShowRejectInput(false);
        setRejectReason('');
    }, []);

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown time';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    if (!visible) return null;

    const draft = displayDraftRef.current;
    if (!draft) return null;

    const previewLines = draft.processedLines || processRawTextToLines(draft.rawText);
    const lineCount = previewLines.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${exiting || entering ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleDismiss}
            />

            {/* Modal */}
            <div className={`
        relative w-full max-w-2xl mx-4 max-h-[90vh] rounded-2xl border shadow-2xl ring-1 overflow-hidden
        ${darkMode ? 'bg-gray-900 text-gray-50 border-gray-800 ring-blue-500/35' : 'bg-white text-gray-900 border-gray-200 ring-blue-500/20'}
        transition-all duration-200 ease-out
        ${(exiting || entering) ? 'opacity-0 translate-y-8 scale-95' : 'opacity-100 translate-y-0 scale-100'}
      `}>
                {/* Header */}
                <div className={`
          px-6 py-4 border-b flex items-center justify-between
          ${darkMode ? 'border-gray-800' : 'border-gray-200'}
        `}>
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-blue-500" />
                        <div>
                            <h2 className="text-xl font-bold">Lyrics Draft Approval</h2>
                            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                {draftQueue.length > 1 ? `${draftQueue.length} drafts pending` : 'Review and approve'}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleDismiss}
                        variant="ghost"
                        size="icon"
                        disabled={isProcessing}
                        className={darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
                    >
                        <X className="w-6 h-6" />
                    </Button>
                </div>

                {/* Draft Info */}
                <div className={`
          px-6 py-4 border-b
          ${darkMode ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}
        `}>
                    <h3 className="text-lg font-semibold mb-2">{draft.title}</h3>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                            <User className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                                {draft.submittedBy?.clientType || 'Unknown'} controller
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                                {formatTimestamp(draft.submittedBy?.timestamp)}
                            </span>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-xs font-medium ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                            }`}>
                            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                        </div>
                    </div>
                </div>

                {/* Preview Content */}
                <div className="px-6 py-4 max-h-80 overflow-y-auto">
                    <h4 className={`text-sm font-semibold mb-3 uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                        Preview
                    </h4>
                    <div className={`
            p-4 rounded-lg border font-mono text-sm whitespace-pre-wrap
            ${darkMode ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}
          `}>
                        {previewLines.map((line, index) => {
                            if (line && line.type === 'group') {
                                return (
                                    <div key={index} className="mb-2">
                                        <div>{line.mainLine}</div>
                                        <div className={`text-sm italic ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {line.translation}
                                        </div>
                                    </div>
                                );
                            }
                            const displayText = typeof line === 'string' ? line : (line?.displayText || line?.line1 || '');
                            return <div key={index} className="mb-1">{displayText}</div>;
                        })}
                    </div>
                </div>

                {/* Reject Reason Input */}
                {showRejectInput && (
                    <div className={`px-6 py-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                        <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                            Reason for rejection (optional)
                        </label>
                        <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Explain why this draft was rejected..."
                            className={`w-full ${darkMode
                                ? 'bg-gray-700 border-gray-600 text-gray-200'
                                : 'bg-white border-gray-300'
                                }`}
                            rows={3}
                        />
                    </div>
                )}

                {/* Actions */}
                <div className={`
          px-6 py-4 border-t flex items-center justify-between gap-3
          ${darkMode ? 'border-gray-800' : 'border-gray-200'}
        `}>
                    <Button
                        onClick={handleDismiss}
                        variant="ghost"
                        disabled={isProcessing}
                        className={darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : ''}
                    >
                        Dismiss
                    </Button>

                    <div className="flex items-center gap-3">
                        {!showRejectInput ? (
                            <>
                                <Button
                                    onClick={() => setShowRejectInput(true)}
                                    variant="outline"
                                    disabled={isProcessing}
                                    className={`flex items-center gap-2 ${darkMode
                                        ? 'border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-white'
                                        : 'border-red-300 text-red-600 hover:bg-red-50'
                                        }`}
                                >
                                    <XCircle className="w-4 h-4" />
                                    Reject
                                </Button>
                                <Button
                                    onClick={handleApprove}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    {isProcessing ? 'Approving...' : 'Approve & Load'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    onClick={() => {
                                        setShowRejectInput(false);
                                        setRejectReason('');
                                    }}
                                    variant="ghost"
                                    disabled={isProcessing}
                                    className={darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : ''}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleReject}
                                    disabled={isProcessing}
                                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                                >
                                    <XCircle className="w-4 h-4" />
                                    {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DraftApprovalModal;