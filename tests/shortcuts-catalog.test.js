import assert from 'node:assert/strict';
import test from 'node:test';
import { isAutoplayKeyboardShortcut, SHORTCUTS } from '../src/constants/shortcuts.js';

const entries = SHORTCUTS.flatMap(({ category, items }) => (
  items.map(({ label, combo }) => ({ category, label, combo }))
));

const hasEntry = (label, combo) => entries.some((entry) => (
  entry.label === label && entry.combo === combo
));

test('keyboard shortcut catalog covers every app workspace', () => {
  const categories = new Set(SHORTCUTS.map(({ category }) => category));
  for (const category of [
    'General & Window',
    'Control Panel — Files & Setlist',
    'Control Panel — Search',
    'Control Panel — Live Control',
    'Control Panel — Output Tabs',
    'Song Canvas — File & Search',
    'Song Canvas — Line Editing',
    'Online Lyrics Search',
    'Lyric Video & Timer',
    'First-Run Tour',
  ]) {
    assert.equal(categories.has(category), true, category);
  }
});

test('keyboard shortcut catalog includes non-native commands missing from the old help modal', () => {
  for (const [label, combo] of [
    ['Open native file dialog', 'Ctrl/Cmd + Alt + O'],
    ['Open Timer Control', 'Ctrl/Cmd + Shift + T'],
    ['Open Project Output', 'Ctrl/Cmd + Alt + P'],
    ['Open Online Lyrics Search', 'Ctrl/Cmd + Shift + O'],
    ['Previous / next setlist song', 'Ctrl/Cmd + Shift + ← / →'],
    ['Toggle intelligent autoplay (timestamped lyrics)', 'Ctrl/Cmd + Shift + P'],
    ['Send previewed lyric line', 'Enter'],
    ['Open Find and Replace', 'Ctrl/Cmd + H'],
    ['Play / pause Lyric Video Studio', 'Space'],
    ['Start, pause, resume, or advance timer', 'Space'],
    ['Move through library results', '↑ / ↓'],
    ['Toggle Developer Tools', 'Ctrl/Cmd + Shift + I'],
    ['Toggle fullscreen', 'F11'],
  ]) {
    assert.equal(hasEntry(label, combo), true, `${label}: ${combo}`);
  }
});

test('keyboard shortcut catalog excludes basic text-editing menu commands', () => {
  const excludedLabels = new Set(['Cut', 'Copy', 'Paste', 'Delete', 'Select All', 'Undo', 'Redo']);
  for (const { label } of entries) {
    assert.equal(excludedLabels.has(label), false, label);
  }
});

test('keyboard shortcut catalog has complete, non-duplicate entries', () => {
  const identities = new Set();
  for (const { category, label, combo } of entries) {
    assert.equal(typeof label, 'string');
    assert.equal(typeof combo, 'string');
    assert.notEqual(label.trim(), '');
    assert.notEqual(combo.trim(), '');
    const identity = `${category}:${label}:${combo}`;
    assert.equal(identities.has(identity), false, identity);
    identities.add(identity);
  }
});

test('project output shortcut does not also trigger autoplay', () => {
  assert.equal(isAutoplayKeyboardShortcut({ ctrlKey: true, altKey: true, key: 'p' }), false);
  assert.equal(isAutoplayKeyboardShortcut({ ctrlKey: true, key: 'p' }), true);
  assert.equal(isAutoplayKeyboardShortcut({ metaKey: true, shiftKey: true, key: 'P' }), true);
});
