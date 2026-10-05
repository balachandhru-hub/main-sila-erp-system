import React, { useEffect, useRef, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { addCountPhoto, getCountPhoto, type SilaStockCountPhoto } from "../../../api/silaMe/silaControlApi";

interface CountLinePhotosProps {
  stockCountId: string;
  itemId: string;
  materialName: string;
  photos: SilaStockCountPhoto[];
  /** Show the "Add photo" button (count not approved or cancelled). */
  canUpload: boolean;
  /** Called after an upload so the sheet reloads. */
  onUploaded: () => void;
}

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png"];

/** Thumbnail of a stored photo; the image is loaded through the API (cookie authentication) as a blob URL. */
const PhotoThumb: React.FC<{ stockCountId: string; photo: SilaStockCountPhoto; onOpen: (url: string) => void }> = ({
  stockCountId,
  photo,
  onOpen,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    getCountPhoto(stockCountId, photo.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [stockCountId, photo.id]);

  if (failed) return <span className="sctl-thumb sctl-thumb--missing" title={photo.fileName}>!</span>;
  if (!url) return <span className="sctl-thumb sctl-thumb--loading" aria-label={`Loading ${photo.fileName}`} />;
  return (
    <button type="button" className="sctl-thumb" aria-label={`Open photo ${photo.fileName}`} onClick={() => onOpen(url)}>
      <img src={url} alt={photo.fileName} />
    </button>
  );
};

/** Photos of a count line: thumbnails, a larger view, and upload from the computer or the device camera. */
const CountLinePhotos: React.FC<CountLinePhotosProps> = ({ stockCountId, itemId, materialName, photos, canUpload, onUploaded }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toastService.error("Upload the photo as a JPEG or PNG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toastService.error("Upload a photo of at most 8 MB.");
      return;
    }
    setUploading(true);
    try {
      await addCountPhoto(stockCountId, itemId, file);
      toastService.success(`Photo added to ${materialName}.`);
      onUploaded();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not upload the photo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="sctl-photos">
      {photos.map((photo) => (
        <PhotoThumb key={photo.id} stockCountId={stockCountId} photo={photo} onOpen={setViewUrl} />
      ))}
      {canUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="sila-visually-hidden"
            aria-label={`Photo of ${materialName}`}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <button
            type="button"
            className="sila-btn sila-btn--ghost sila-btn--sm"
            aria-label={`Add a photo of ${materialName}`}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading..." : "Add photo"}
          </button>
        </>
      )}
      {photos.length === 0 && !canUpload && <span className="sc-sub">—</span>}

      <Modal
        isOpen={viewUrl !== null}
        onClose={() => setViewUrl(null)}
        headerProps={{ heading: materialName }}
        footerProps={{ primaryButton: { text: "Close", onClick: () => setViewUrl(null) } }}
      >
        {viewUrl && <img className="sctl-photo-full" src={viewUrl} alt={`Photo of ${materialName}`} />}
      </Modal>
    </div>
  );
};

export default CountLinePhotos;
