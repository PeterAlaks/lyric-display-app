import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle, XCircle, FileText, User, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useControlSocket } from '../context/ControlSocketProvider';
import { useLyricsState } from '../hooks/useStoreSelectors';
import useToast from '../hooks/useToast';
import { processRawTextToLines } from '../utils/parseLyrics';

const DraftApprovalModal = ({ darkMode }) => {
    const [draftQueue, setDraftQueue] = useState([]);
    const [currentDraft, setCurrentDraft] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const processedDraftsRef = useRef(new Set());

    const { emitLyricsDraftApprove, emitLyricsDraftReject } = useControlSocket();
    const { setLyrics, setRawLyricsContent, setLyricsFileName, selectLine } = useLyricsState();
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

    const handleApprove = useCallback(async () => {
        if (!currentDraft || isProcessing) return;

        setIsProcessing(true);

        try {
            const processedLines = currentDraft.processedLines || processRawTextToLines(currentDraft.rawText);

            setLyrics(processedLines);
            setRawLyricsContent(currentDraft.rawText);
            setLyricsFileName(currentDraft.title);
            selectLine(null);

            const success = emitLyricsDraftApprove({
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
    }, [currentDraft, isProcessing, emitLyricsDraftApprove, setLyrics, setRawLyricsContent, setLyricsFileName, selectLine, showToast]);

    const handleReject = useCallback(() => {
        if (!currentDraft || isProcessing) return;

        setIsProcessing(true);

        try {
            const success = emitLyricsDraftReject({
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

    if (!currentDraft) return null;

    const previewLines = currentDraft.processedLines || processRawTextToLines(currentDraft.rawText);
    const lineCount = previewLines.length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                onClick={handleDismiss}
            />

            {/* Modal */}
            <div className={`
        relative w-full max-w-2xl mx-4 max-h-[90vh] rounded-xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
      `}>
                {/* Header */}
                <div className={`
          px-6 py-4 border-b flex items-center justify-between
          ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}
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
          ${darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}
        `}>
                    <h3 className="text-lg font-semibold mb-2">{currentDraft.title}</h3>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                            <User className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                                {currentDraft.submittedBy?.clientType || 'Unknown'} controller
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Clock className={`w-4 h-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                                {formatTimestamp(currentDraft.submittedBy?.timestamp)}
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
                            return <div key={index} className="mb-1">{line}</div>;
                        })}
                    </div>
                </div>

                {/* Reject Reason Input */}
                {showRejectInput && (
                    <div className="px-6 py-4 border-t">
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
          ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}
        `}>
                    <Button
                        onClick={handleDismiss}
                        variant="outline"
                        disabled={isProcessing}
                        className={darkMode ? 'border-gray-600 hover:bg-gray-700' : ''}
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
                                        ? 'border-red-600 text-red-400 hover:bg-red-900/20'
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
                                    variant="outline"
                                    disabled={isProcessing}
                                    className={darkMode ? 'border-gray-600' : ''}
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