import React, { useState } from 'react';
import {
  identifyStockCountPhoto,
  type SilaStockCountPhotoCandidate,
} from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { errorText } from '../../useLoad';

interface CountPhotoIdentifyProps {
  stockCountId: string;
  onConfirm: (candidate: SilaStockCountPhotoCandidate) => void;
}

/**
 * Take a photo to suggest a material. The photo is not uploaded and inventory is not changed.
 * A candidate is used only after the user confirms it.
 */
const CountPhotoIdentify: React.FC<CountPhotoIdentifyProps> = ({ stockCountId, onConfirm }) => {
  const [busy, setBusy] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const [candidates, setCandidates] = useState<SilaStockCountPhotoCandidate[]>([]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    setCandidates([]);
    try {
      const result = await identifyStockCountPhoto(stockCountId);
      setCandidates(result.candidates);
      setNotice({
        tone: result.configured && result.candidates.length > 0 ? 'success' : 'warning',
        text: result.message || 'Search the material. Inventory was not changed.',
      });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Photo identification is not available. Search the material.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sm-section" aria-label="Photo identification">
      <label className="sm-btn sm-btn--block">
        {busy ? 'Checking photo…' : 'Take photo'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void onFile(file);
          }}
        />
      </label>
      <Notice notice={notice} />
      {candidates.map((candidate) => (
        <button
          key={candidate.materialId}
          type="button"
          className="sm-btn sm-btn--primary sm-btn--block"
          onClick={() => onConfirm(candidate)}
        >
          Confirm {candidate.materialName}
          <span className="sm-meta"> Material {candidate.materialCode}</span>
        </button>
      ))}
    </section>
  );
};

export default CountPhotoIdentify;
