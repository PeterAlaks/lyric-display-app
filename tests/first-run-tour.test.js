import test from 'node:test';
import assert from 'node:assert/strict';
import { getTourCardPosition, shouldShowTelemetryConsent } from '../src/utils/firstRunTour.js';

test('centers tour cards without a target', () => {
  const position = getTourCardPosition({
    targetRect: null,
    cardWidth: 400,
    cardHeight: 280,
    viewportWidth: 1200,
    viewportHeight: 800,
  });

  assert.deepEqual(position, { left: 400, top: 260, placement: 'center' });
});

test('uses the preferred side when enough space is available', () => {
  const position = getTourCardPosition({
    targetRect: { left: 100, top: 200, right: 300, bottom: 260, width: 200, height: 60 },
    cardWidth: 320,
    cardHeight: 220,
    viewportWidth: 1200,
    viewportHeight: 800,
    preferred: 'right',
  });

  assert.equal(position.placement, 'right');
  assert.equal(position.left, 318);
  assert.equal(position.top, 120);
});

test('falls back to a side that fits and keeps the card in the viewport', () => {
  const position = getTourCardPosition({
    targetRect: { left: 900, top: 300, right: 1100, bottom: 360, width: 200, height: 60 },
    cardWidth: 360,
    cardHeight: 260,
    viewportWidth: 1200,
    viewportHeight: 800,
    preferred: 'right',
  });

  assert.equal(position.placement, 'left');
  assert.equal(position.left, 522);
  assert.ok(position.top >= 16);
  assert.ok(position.left + 360 <= 1184);
});

test('clamps oversized cards to the safe viewport margin', () => {
  const position = getTourCardPosition({
    targetRect: null,
    cardWidth: 500,
    cardHeight: 400,
    viewportWidth: 420,
    viewportHeight: 320,
  });

  assert.equal(position.left, 16);
  assert.equal(position.top, 16);
});

test('existing installations see telemetry consent without replaying the welcome tour', () => {
  assert.equal(shouldShowTelemetryConsent({
    consentDecided: false,
    hasSeenWelcome: true,
    isControlPanel: true,
    tourActive: false,
  }), true);
});

test('new installations wait until the first-run tour has ended', () => {
  assert.equal(shouldShowTelemetryConsent({
    consentDecided: false,
    hasSeenWelcome: false,
    isControlPanel: true,
    tourActive: true,
  }), false);
  assert.equal(shouldShowTelemetryConsent({
    consentDecided: false,
    hasSeenWelcome: true,
    isControlPanel: true,
    tourActive: false,
  }), true);
});

test('replaying the welcome tour never repeats a completed telemetry choice', () => {
  assert.equal(shouldShowTelemetryConsent({
    consentDecided: true,
    hasSeenWelcome: true,
    isControlPanel: true,
    tourActive: true,
  }), false);
  assert.equal(shouldShowTelemetryConsent({
    consentDecided: true,
    hasSeenWelcome: true,
    isControlPanel: true,
    tourActive: false,
  }), false);
});
