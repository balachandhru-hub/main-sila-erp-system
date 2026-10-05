import React, { useState } from 'react';
import { identifyBarcode, type SilaStockCountBarcode } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { errorText } from '../../useLoad';

interface BarcodeEntryProps {
  stockCountId: string;
  onFound: (found: SilaStockCountBarcode) => void;
}

/** Barcode or material code field; keyboard-wedge scanners type the code and press Enter. */
const BarcodeEntry: React.FC<BarcodeEntryProps> = ({ stockCountId, onFound }) => {
  const [code, setCode] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const found = await identifyBarcode(stockCountId, code);
      setCode('');
      onFound(found);
    } catch (caught: unknown) {
      setError(errorText(caught, 'Barcode not recognised.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="sm-section" onSubmit={submit}>
      <div className="sm-field">
        <label htmlFor="sm-barcode">Scan or type barcode</label>
        <div className="sm-row">
          <input
            id="sm-barcode"
            className="sm-input"
            inputMode="text"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="submit" className="sm-btn sm-btn--primary" disabled={busy || !code.trim()}>
            {busy ? '…' : 'Find'}
          </button>
        </div>
      </div>
      {error && (
        <p className="sm-notice sm-notice--error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};

export default BarcodeEntry;
