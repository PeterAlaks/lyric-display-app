import React from 'react';
import { useLyricsState } from '../hooks/useStoreSelectors';

const SongInfoModal = ({ darkMode }) => {
  const { songMetadata, lyrics } = useLyricsState();

  const InfoRow = ({ label, value, isLast = false }) => (
    <div className={`flex justify-between py-3 ${isLast ? '' : `border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`
      }`}>
      <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
        {label}:
      </span>
      <span className={`text-right ml-4 font-medium ${darkMode ? 'text-gray-100' : 'text-gray-900'
        }`}>
        {value || <span className={`font-normal ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Not Available</span>}
      </span>
    </div>
  );

  return (
    <div className="space-y-0">
      <InfoRow label="Song Title" value={songMetadata.title} />
      <InfoRow
        label="Artist(s)"
        value={songMetadata.artists?.length > 0
          ? songMetadata.artists.join(', ')
          : null
        }
      />
      <InfoRow label="Album" value={songMetadata.album} />
      <InfoRow label="Year" value={songMetadata.year} />
      <InfoRow label="Lyric Lines" value={lyrics.length || null} />
      <InfoRow label="Origin" value={songMetadata.origin} isLast={true} />
    </div>
  );
};

export default SongInfoModal;