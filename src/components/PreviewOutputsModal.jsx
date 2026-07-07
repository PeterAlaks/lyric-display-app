import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppWindowMac, Monitor, RefreshCw } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import useLyricsStore from '../context/LyricsStore';
import { formatOutputLabel } from '../utils/outputLabels';

const RESOLUTION_OPTIONS = [
  { label: '1920x1080 (Full HD)', width: 1920, height: 1080 },
  { label: '1280x720 (HD)', width: 1280, height: 720 },
  { label: '1024x768 (XGA)', width: 1024, height: 768 },
  { label: '1366x768 (WXGA)', width: 1366, height: 768 },
  { label: '1440x900 (WXGA+)', width: 1440, height: 900 },
  { label: '1600x900 (HD+)', width: 1600, height: 900 },
];

const getPreviewUrl = (outputId) => {
  if (!outputId) return '';
  const isDev = window.location.port === '5173';
  if (isDev) return `http://localhost:5173/${outputId}?preview=true`;
  return `${window.location.origin}/#/${outputId}?preview=true`;
};

const PreviewOutputsModal = ({ darkMode }) => {
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [customPickerOpen, setCustomPickerOpen] = useState(false);

  const customOutputIds = useLyricsStore((state) => state.customOutputIds || []);
  const previewCustomOutputId = useLyricsStore((state) => state.previewCustomOutputId);
  const setPreviewCustomOutputId = useLyricsStore((state) => state.setPreviewCustomOutputId);
  const isOutputOn = useLyricsStore((state) => state.isOutputOn);

  const [output1Resolution, setOutput1Resolution] = useState(RESOLUTION_OPTIONS[0]);
  const [output2Resolution, setOutput2Resolution] = useState(RESOLUTION_OPTIONS[0]);
  const [stageResolution, setStageResolution] = useState(RESOLUTION_OPTIONS[0]);
  const [timeResolution, setTimeResolution] = useState(RESOLUTION_OPTIONS[0]);
  const [customResolution, setCustomResolution] = useState(RESOLUTION_OPTIONS[0]);
  const [output1MockImage, setOutput1MockImage] = useState(false);
  const [output2MockImage, setOutput2MockImage] = useState(false);
  const [customMockImage, setCustomMockImage] = useState(false);

  const output1ContainerRef = useRef(null);
  const output2ContainerRef = useRef(null);
  const stageContainerRef = useRef(null);
  const timeContainerRef = useRef(null);
  const customContainerRef = useRef(null);
  const iframeRefs = useRef(new Set());
  const [output1Dimensions, setOutput1Dimensions] = useState({ width: 0, height: 0 });
  const [output2Dimensions, setOutput2Dimensions] = useState({ width: 0, height: 0 });
  const [stageDimensions, setStageDimensions] = useState({ width: 0, height: 0 });
  const [timeDimensions, setTimeDimensions] = useState({ width: 0, height: 0 });
  const [customDimensions, setCustomDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let frameId = null;
    const pendingDimensions = new Map();
    const setters = new Map([
      [output1ContainerRef, setOutput1Dimensions],
      [output2ContainerRef, setOutput2Dimensions],
      [stageContainerRef, setStageDimensions],
      [timeContainerRef, setTimeDimensions],
      [customContainerRef, setCustomDimensions],
    ]);

    const flushDimensions = () => {
      frameId = null;
      pendingDimensions.forEach((dimensions, ref) => {
        const setter = setters.get(ref);
        if (!setter) return;
        setter((previous) => (
          previous.width === dimensions.width && previous.height === dimensions.height
            ? previous
            : dimensions
        ));
      });
      pendingDimensions.clear();
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const matchedRef = Array.from(setters.keys()).find((ref) => entry.target === ref.current);
        if (!matchedRef) continue;

        const { width, height } = entry.contentRect;
        pendingDimensions.set(matchedRef, {
          width: Math.round(width),
          height: Math.round(height),
        });
      }

      if (!frameId) {
        frameId = window.requestAnimationFrame(flushDimensions);
      }
    });

    if (output1ContainerRef.current) resizeObserver.observe(output1ContainerRef.current);
    if (output2ContainerRef.current) resizeObserver.observe(output2ContainerRef.current);
    if (stageContainerRef.current) resizeObserver.observe(stageContainerRef.current);
    if (timeContainerRef.current) resizeObserver.observe(timeContainerRef.current);
    if (customContainerRef.current) resizeObserver.observe(customContainerRef.current);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => () => {
    iframeRefs.current.forEach((iframe) => {
      try {
        iframe.src = 'about:blank';
      } catch { }
    });
    iframeRefs.current.clear();
  }, []);

  const registerPreviewIframe = useCallback((iframe) => {
    if (iframe) {
      iframeRefs.current.add(iframe);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (previewCustomOutputId && !customOutputIds.includes(previewCustomOutputId)) {
      setPreviewCustomOutputId(null);
    }
  }, [customOutputIds, previewCustomOutputId, setPreviewCustomOutputId]);

  const handleRefresh = () => {
    setLoading(true);
    setKey((prev) => prev + 1);
    setTimeout(() => setLoading(false), 1000);
  };

  const handleOpenOutput = async (outputKey) => {
    if (!outputKey) return;

    if (window?.electronAPI?.display?.openOutputWindow) {
      await window.electronAPI.display.openOutputWindow(outputKey);
      return;
    }

    if (window?.electronAPI?.openOutputWindow) {
      if (outputKey === 'output1') {
        window.electronAPI.openOutputWindow(1);
        return;
      }
      if (outputKey === 'output2') {
        window.electronAPI.openOutputWindow(2);
      }
    }
  };

  const handleSelectCustomPreviewOutput = (outputId) => {
    setPreviewCustomOutputId(outputId);
    setCustomPickerOpen(false);
  };

  const customPreviewTitle = useMemo(() => {
    if (!previewCustomOutputId) return 'Custom Output';
    return formatOutputLabel(previewCustomOutputId);
  }, [previewCustomOutputId]);

  const getIframeTransform = (resolution, containerDimensions) => {
    const containerWidth = containerDimensions.width;
    const containerHeight = containerDimensions.height;

    if (!containerWidth || !containerHeight) return null;

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

  const CustomOutputPickerContent = (
    <div className="w-44">
      <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        Custom Outputs
      </p>
      {customOutputIds.length === 0 ? (
        <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          No custom outputs available yet.
        </p>
      ) : (
        <div className="space-y-1">
          {customOutputIds.map((outputId) => (
            <button
              key={outputId}
              onClick={() => handleSelectCustomPreviewOutput(outputId)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${previewCustomOutputId === outputId
                ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white')
                : (darkMode ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700')
                }`}
            >
              {formatOutputLabel(outputId)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <span className="grid shrink-0">
              <span className="invisible col-start-1 row-start-1 whitespace-nowrap">Display Output is OFF</span>
              <span className="col-start-1 row-start-1 whitespace-nowrap">{isOutputOn ? 'Display Output is ON' : 'Display Output is OFF'}</span>
            </span>
            <span
              className={`h-2 w-2 rounded-full ${isOutputOn
                ? 'bg-emerald-500'
                : darkMode ? 'bg-gray-500' : 'bg-gray-400'
                }`}
              aria-hidden="true"
            />
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors ${darkMode
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
            }`}
          title="Refresh all previews"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'}`}>
            <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Output 1
            </h3>
            <button
              onClick={() => handleOpenOutput('output1')}
              className={`p-1 rounded hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-100'}`}
              title="Open in window"
            >
              <AppWindowMac className="w-3 h-3" />
            </button>
          </div>

          <div className={`px-2.5 py-2 border-b flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Resolution:
              </label>
              <Select
                value={String(RESOLUTION_OPTIONS.findIndex((r) => r.width === output1Resolution.width && r.height === output1Resolution.height))}
                onValueChange={(value) => setOutput1Resolution(RESOLUTION_OPTIONS[parseInt(value, 10)])}
              >
                <SelectTrigger className={`text-xs px-2 py-1 rounded border flex-1 h-6 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300 text-gray-800'
                  }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                  {RESOLUTION_OPTIONS.map((res, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {res.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                Add Mock Image
              </label>
            </div>
          </div>

          <div
            ref={output1ContainerRef}
            className="relative bg-black overflow-hidden w-full flex items-center justify-center"
            style={{ aspectRatio: '16 / 9' }}
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
                  <div className="z-10" style={transform.wrapper}>
                    <iframe
                      ref={registerPreviewIframe}
                      key={`output1-${key}`}
                      src={getPreviewUrl('output1') || null}
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

        <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'}`}>
            <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Output 2
            </h3>
            <button
              onClick={() => handleOpenOutput('output2')}
              className={`p-1 rounded hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              title="Open in window"
            >
              <AppWindowMac className="w-3 h-3" />
            </button>
          </div>

          <div className={`px-2.5 py-2 border-b flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Resolution:
              </label>
              <Select
                value={String(RESOLUTION_OPTIONS.findIndex((r) => r.width === output2Resolution.width && r.height === output2Resolution.height))}
                onValueChange={(value) => setOutput2Resolution(RESOLUTION_OPTIONS[parseInt(value, 10)])}
              >
                <SelectTrigger className={`text-xs px-2 py-1 rounded border flex-1 h-6 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300 text-gray-800'
                  }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                  {RESOLUTION_OPTIONS.map((res, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {res.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                Add Mock Image
              </label>
            </div>
          </div>

          <div
            ref={output2ContainerRef}
            className="relative bg-black overflow-hidden w-full flex items-center justify-center"
            style={{ aspectRatio: '16 / 9' }}
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
                  <div className="z-10" style={transform.wrapper}>
                    <iframe
                      ref={registerPreviewIframe}
                      key={`output2-${key}`}
                      src={getPreviewUrl('output2') || null}
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

        <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'}`}>
            <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Stage
            </h3>
            <button
              onClick={() => handleOpenOutput('stage')}
              className={`p-1 rounded hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              title="Open in window"
            >
              <AppWindowMac className="w-3 h-3" />
            </button>
          </div>
          <div className={`px-2.5 py-2 border-b flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Resolution:
              </label>
              <Select
                value={String(RESOLUTION_OPTIONS.findIndex((r) => r.width === stageResolution.width && r.height === stageResolution.height))}
                onValueChange={(value) => setStageResolution(RESOLUTION_OPTIONS[parseInt(value, 10)])}
              >
                <SelectTrigger className={`text-xs px-2 py-1 rounded border flex-1 h-6 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300 text-gray-800'
                  }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                  {RESOLUTION_OPTIONS.map((res, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {res.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div
            ref={stageContainerRef}
            className="relative bg-black overflow-hidden w-full flex items-center justify-center"
            style={{ aspectRatio: '16 / 9' }}
          >
            {(() => {
              const transform = getIframeTransform(stageResolution, stageDimensions);
              if (!transform) return null;
              return (
                <div className="z-10" style={transform.wrapper}>
                  <iframe
                    ref={registerPreviewIframe}
                    key={`stage-${key}`}
                    src={getPreviewUrl('stage') || null}
                    title="Stage Preview"
                    style={{
                      ...transform.iframe,
                      border: 'none',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'}`}>
            <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Time
            </h3>
            <button
              onClick={() => handleOpenOutput('time')}
              className={`p-1 rounded hover:bg-gray-700 transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
              title="Open in window"
            >
              <AppWindowMac className="w-3 h-3" />
            </button>
          </div>
          <div className={`px-2.5 py-2 border-b flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Resolution:
              </label>
              <Select
                value={String(RESOLUTION_OPTIONS.findIndex((r) => r.width === timeResolution.width && r.height === timeResolution.height))}
                onValueChange={(value) => setTimeResolution(RESOLUTION_OPTIONS[parseInt(value, 10)])}
              >
                <SelectTrigger className={`text-xs px-2 py-1 rounded border flex-1 h-6 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300 text-gray-800'
                  }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                  {RESOLUTION_OPTIONS.map((res, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {res.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div
            ref={timeContainerRef}
            className="relative bg-black overflow-hidden w-full flex items-center justify-center"
            style={{ aspectRatio: '16 / 9' }}
          >
            {(() => {
              const transform = getIframeTransform(timeResolution, timeDimensions);
              if (!transform) return null;
              return (
                <div className="z-10" style={transform.wrapper}>
                  <iframe
                    ref={registerPreviewIframe}
                    key={`time-${key}`}
                    src={getPreviewUrl('time') || null}
                    title="Time Preview"
                    style={{
                      ...transform.iframe,
                      border: 'none',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              );
            })()}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className={`rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className={`px-2.5 py-1.5 border-b flex items-center justify-between ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-100'}`}>
            <div className="flex items-center gap-2">
              <h3 className={`text-xs font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {customPreviewTitle}
              </h3>
              {previewCustomOutputId && (
                <Popover open={customPickerOpen} onOpenChange={setCustomPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={`text-[11px] underline transition-colors ${darkMode ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-700'}`}
                    >
                      Change
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className={`z-[2100] p-2 ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'}`}
                  >
                    {CustomOutputPickerContent}
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {previewCustomOutputId && (
              <button
                onClick={() => handleOpenOutput(previewCustomOutputId)}
                className={`p-1 rounded transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                title="Open in window"
              >
                <AppWindowMac className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className={`px-2.5 py-2 border-b flex flex-col gap-2 ${darkMode ? 'border-gray-700 bg-gray-850' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2">
              <label className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Resolution:
              </label>
              <Select
                value={String(RESOLUTION_OPTIONS.findIndex((r) => r.width === customResolution.width && r.height === customResolution.height))}
                onValueChange={(value) => setCustomResolution(RESOLUTION_OPTIONS[parseInt(value, 10)])}
              >
                <SelectTrigger className={`text-xs px-2 py-1 rounded border flex-1 h-6 ${darkMode
                  ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-white border-gray-300 text-gray-800'
                  }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={darkMode ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-white border-gray-300'}>
                  {RESOLUTION_OPTIONS.map((res, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {res.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="custom-mock"
                checked={customMockImage}
                onChange={(e) => setCustomMockImage(e.target.checked)}
                className="w-3 h-3"
              />
              <label
                htmlFor="custom-mock"
                className={`text-xs cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
              >
                Add Mock Image
              </label>
            </div>
          </div>

          <div
            ref={customContainerRef}
            className="relative bg-black overflow-hidden w-full flex items-center justify-center"
            style={{ aspectRatio: '16 / 9' }}
          >
            {(() => {
              const transform = getIframeTransform(customResolution, customDimensions);
              if (!transform) return null;
              return (
                <>
                  {customMockImage && (
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
                  <div className="z-10 relative" style={transform.wrapper}>
                    {previewCustomOutputId ? (
                      <iframe
                        ref={registerPreviewIframe}
                        key={`custom-${previewCustomOutputId}-${key}`}
                        src={getPreviewUrl(previewCustomOutputId) || null}
                        title={`${formatOutputLabel(previewCustomOutputId)} Preview`}
                        style={{
                          ...transform.iframe,
                          border: 'none',
                          display: 'block',
                          pointerEvents: 'none',
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center px-4">
                        <Popover open={customPickerOpen} onOpenChange={setCustomPickerOpen}>
                          <PopoverTrigger asChild>
                            <button
                              className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${darkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                }`}
                            >
                              Preview others
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="top"
                            align="center"
                            className={`z-[2100] p-2 ${darkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'}`}
                          >
                            {CustomOutputPickerContent}
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
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

      <div className={`rounded-lg p-3 text-xs ${darkMode ? 'bg-blue-900/20 border border-blue-700/30 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
        <p className="font-medium mb-1">Preview Tips:</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li>Live previews update in real-time as you make changes</li>
          <li>Click the <AppWindowMac className="w-3 h-3 inline" /> icon to open full window</li>
          <li>Use the refresh button if previews do not update</li>
          <li>Custom preview selection is remembered across app restarts</li>
        </ul>
      </div>
    </div>
  );
};

export default PreviewOutputsModal;
