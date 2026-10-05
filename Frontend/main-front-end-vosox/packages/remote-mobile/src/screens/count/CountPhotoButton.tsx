import React, { useEffect, useRef, useState } from 'react';
import { addCountPhoto } from '../../../../remote-buyer/src/api/silaMe/silaControlApi';
import { errorText } from '../../useLoad';

/** The backend accepts JPEG or PNG up to 8 MB. */
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png'];

interface CountPhotoButtonProps {
  stockCountId: string;
  itemId: string;
  /** Photos already on the line. */
  existing: number;
  disabled?: boolean;
  onAdded: () => void;
}

/** Takes a photo with the camera (or picks one) and attaches it to the count line. */
const CountPhotoButton: React.FC<CountPhotoButtonProps> = ({ stockCountId, itemId, existing, disabled, onAdded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const urlsRef = useRef<string[]>([]);
  urlsRef.current = previews;

  // Releases the local previews when the line closes.
  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const upload = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setError('Use a JPEG or PNG photo.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('The photo is larger than 8 MB.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addCountPhoto(stockCountId, itemId, file);
      setPreviews((current) => [...current, URL.createObjectURL(file)]);
      onAdded();
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const total = existing + previews.length;
  return (
    <div className="sm-section">
      <input
        ref={inputRef}
        className="sm-visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => upload(event.target.files?.[0])}
      />
      <button type="button" className="sm-btn sm-btn--small" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Uploading photo…' : 'Take photo'}
      </button>
      {total > 0 && (
        <span className="sm-meta">
          {total} photo{total === 1 ? '' : 's'} on this line
        </span>
      )}
      {previews.length > 0 && (
        <div className="sm-photos">
          {previews.map((url, index) => (
            <img key={url} src={url} alt={`Photo ${index + 1} just added`} />
          ))}
        </div>
      )}
      {error && (
        <p className="sm-notice sm-notice--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default CountPhotoButton;
