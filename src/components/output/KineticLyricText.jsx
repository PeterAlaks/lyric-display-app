import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  getKineticLoopPosition,
  getKineticReplayKey,
  kineticSampleToStyle,
  planKineticLine,
  sampleKineticExit,
  sampleKineticHold,
  sampleKineticLive,
} from '../../../shared/kineticTypography.js';

const MAX_EXITING_SLOTS = 2;
const MAX_OVERLAP_DELAY_MS = 180;
const KEY_SEPARATOR = '␟';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const writeStyle = (node, sample) => {
  if (!node) return;
  const style = kineticSampleToStyle(sample);
  node.style.opacity = style.opacity;
  node.style.transform = style.transform;
  node.style.filter = style.filter;
};

const tokenNodeStyle = (textDecoration) => ({
  display: 'inline-block',
  whiteSpace: 'pre',
  textDecoration,
});

/**
 * Renders a lyric line as kinetic typography: each word or letter animates on its own, the
 * outgoing line leaves while the incoming one arrives, and the held line drifts slowly.
 *
 * Animated values are written straight to the DOM from a frame clock, so React re-renders (font
 * autosizing, settings edits) never restart or fight the motion. Each line keeps its plan for
 * its whole life on screen; settings changes replay the current line with the new plan. With
 * replay enabled, a live line keeps cycling through its own recipe until it is replaced.
 */
export default function KineticLyricText({
  text,
  lineStyles = [],
  lineKey,
  songKey = '',
  section = null,
  settings,
  containerRef,
  style,
}) {
  const [slots, setSlots] = useState([]);
  const runtimesRef = useRef(new Map());
  const slotCounterRef = useRef(0);
  const frameRef = useRef(null);
  const lastContentKeyRef = useRef(null);

  const replayKey = getKineticReplayKey(settings);
  const sectionKey = section ? `${section.key}:${section.ordinal}` : '';
  const contentKey = text
    ? [lineKey, text, sectionKey, songKey, replayKey].join(KEY_SEPARATOR)
    : '';

  const latestInputsRef = useRef({});
  latestInputsRef.current = { text, lineKey, songKey, section, settings };

  const applyFrame = useCallback((timeMs) => {
    const finished = [];
    let needsAnotherFrame = false;

    runtimesRef.current.forEach((runtime, id) => {
      const { plan } = runtime;
      const enterElapsed = Math.max(0, timeMs - runtime.enterAt);
      const position = getKineticLoopPosition(plan, enterElapsed);
      const hold = sampleKineticHold(plan, position.cycleElapsedMs);
      writeStyle(runtime.holdNode, { ...hold, opacity: 1, rotate: 0, blur: 0 });
      if (plan.holdId !== 'none') needsAnotherFrame = true;

      if (runtime.exitAt !== null) {
        const exitElapsed = timeMs - runtime.exitAt;
        plan.tokens.forEach((_, index) => {
          writeStyle(runtime.tokenNodes[index], sampleKineticExit(plan, index, exitElapsed, runtime.exitFrom[index]));
        });
        if (exitElapsed >= plan.exitDurationMs) finished.push(id);
        else needsAnotherFrame = true;
        return;
      }

      if (plan.loopHoldMs !== null) needsAnotherFrame = true;

      // Tokens rest during the hold phase, so it is written once per cycle.
      if (position.phase === 'hold') {
        if (runtime.restingCycle === position.cycle) return;
        runtime.restingCycle = position.cycle;
      } else {
        needsAnotherFrame = true;
      }

      plan.tokens.forEach((_, index) => {
        writeStyle(runtime.tokenNodes[index], sampleKineticLive(plan, index, enterElapsed));
      });
    });

    if (finished.length > 0) {
      finished.forEach((id) => runtimesRef.current.delete(id));
      setSlots((previous) => previous.filter((slot) => !finished.includes(slot.id)));
    }

    return needsAnotherFrame;
  }, []);

  const startLoop = useCallback(() => {
    if (frameRef.current !== null || typeof window === 'undefined') return;
    const tick = () => {
      frameRef.current = null;
      if (applyFrame(now())) {
        frameRef.current = window.requestAnimationFrame(tick);
      }
    };
    frameRef.current = window.requestAnimationFrame(tick);
  }, [applyFrame]);

  useLayoutEffect(() => {
    // StrictMode replays effects on mount; only a real content change should swap lines.
    if (lastContentKeyRef.current === contentKey) return;
    lastContentKeyRef.current = contentKey;

    const timeMs = now();
    const runtimes = runtimesRef.current;
    const leaving = [];

    runtimes.forEach((runtime) => {
      if (runtime.exitAt === null) {
        // Leave from wherever each token currently is, even mid-entry.
        const enterElapsed = Math.max(0, timeMs - runtime.enterAt);
        runtime.exitFrom = runtime.plan.tokens.map((_, index) => sampleKineticLive(runtime.plan, index, enterElapsed));
        runtime.exitAt = timeMs;
      }
      leaving.push(runtime);
    });

    // Rapid advancing: keep only the most recent outgoing lines on screen.
    leaving.slice(0, Math.max(0, leaving.length - MAX_EXITING_SLOTS)).forEach((runtime) => {
      runtimes.delete(runtime.id);
    });

    if (contentKey) {
      const inputs = latestInputsRef.current;
      const plan = planKineticLine({
        text: inputs.text,
        lineKey: inputs.lineKey,
        songKey: inputs.songKey,
        section: inputs.section,
        settings: inputs.settings,
      });

      if (plan) {
        const longestExit = leaving.reduce((longest, runtime) => (
          runtimes.has(runtime.id) ? Math.max(longest, runtime.plan.exitDurationMs) : longest
        ), 0);
        slotCounterRef.current += 1;
        const id = `kinetic-${slotCounterRef.current}`;
        runtimes.set(id, {
          id,
          plan,
          enterAt: timeMs + Math.min(MAX_OVERLAP_DELAY_MS, longestExit * 0.5),
          exitAt: null,
          exitFrom: [],
          restingCycle: -1,
          tokenNodes: [],
          holdNode: null,
        });
      }
    }

    setSlots(Array.from(runtimes.values(), ({ id, plan }) => ({ id, plan })));
  }, [contentKey]);

  // Runs after new spans mount but before the browser paints, so nothing flashes at rest.
  useLayoutEffect(() => {
    if (applyFrame(now())) startLoop();
  }, [applyFrame, slots, startLoop]);

  useEffect(() => () => {
    if (frameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
  }, []);

  const textDecoration = style?.textDecoration;

  const renderSlot = ({ id, plan }) => {
    const runtime = runtimesRef.current.get(id);
    const isLeaving = runtime ? runtime.exitAt !== null : true;

    return (
      <div
        key={id}
        ref={(node) => { if (runtime) runtime.holdNode = node; }}
        aria-hidden={isLeaving || undefined}
        data-kinetic-slot={isLeaving ? 'leaving' : 'active'}
        style={{ gridArea: '1 / 1', minWidth: 0, transformOrigin: 'center center' }}
      >
        {plan.lines.map((line, lineIndex) => (
          <div
            key={lineIndex}
            style={{
              ...(lineStyles[lineIndex] || {}),
              marginTop: lineIndex > 0 ? '0.25rem' : undefined,
            }}
          >
            {line.words.map((word, wordIndex) => (
              <React.Fragment key={wordIndex}>
                {wordIndex > 0 ? ' ' : null}
                {plan.unit === 'letter' ? (
                  <span style={{ display: 'inline-block', whiteSpace: 'nowrap', textDecoration }}>
                    {word.letters.map((letter, letterIndex) => (
                      <span
                        key={letterIndex}
                        ref={(node) => { if (runtime) runtime.tokenNodes[word.firstToken + letterIndex] = node; }}
                        style={tokenNodeStyle(textDecoration)}
                      >
                        {letter}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span
                    ref={(node) => { if (runtime) runtime.tokenNodes[word.firstToken] = node; }}
                    style={tokenNodeStyle(textDecoration)}
                  >
                    {word.text}
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      data-kinetic-lyric-text="true"
      style={{
        ...style,
        // Outgoing and incoming lines share one grid cell so they overlap in place.
        display: 'grid',
        WebkitBoxOrient: undefined,
        WebkitLineClamp: undefined,
        overflow: 'visible',
        textOverflow: undefined,
      }}
    >
      {slots.map(renderSlot)}
    </div>
  );
}
