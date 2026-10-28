import React from 'react';
import { useLocation } from 'react-router-dom';
import useLyricsStore from '../../context/LyricsStore';
import { readPreferredSongEditor, resolveSongEditorKind } from '../../utils/songDocumentEditing.js';

const NewSongCanvas = React.lazy(() => import('../NewSongCanvas'));
const SongEditor = React.lazy(() => import('../SongEditor'));

// /new-song hosts both editors: structured (.ldsong) and the classic text canvas.
export default function SongEditorRoute() {
  const location = useLocation();
  const lyricsFileType = useLyricsStore((state) => state.lyricsSource?.fileType);
  const params = new URLSearchParams(location.search);
  const kind = resolveSongEditorKind({
    editorParam: params.get('editor'),
    mode: params.get('mode') || 'new',
    origin: params.get('origin'),
    lyricsFileType,
    preferred: readPreferredSongEditor(),
  });

  return kind === 'structured'
    ? <SongEditor key={location.key} />
    : <NewSongCanvas />;
}
