import React from 'react';
import Card from '../../components/Card';
import LocationPicker from '../../components/LocationPicker';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { useOnline } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useMyLocation } from '../../location';
import { useInstallApp } from '../../pwa';

/** Connectivity and working context; the working location can be changed here as on Home. */
const SettingsScreen: React.FC = () => {
  const { person } = useAccess();
  const { locations, location, setLocationId } = useMyLocation();
  const online = useOnline();
  const { installed, canInstall, iosHint, install } = useInstallApp();

  return (
    <>
      <ScreenHeader title="Settings" eyebrow="More" back />
      <div className="sm-screen">
        <Card title="App" aside={installed ? <StatusBadge status="ACTIVE" label="Installed" /> : undefined}>
          {installed ? (
            <p className="sm-meta">SILA Store is installed on this device. Open it from your home screen.</p>
          ) : canInstall ? (
            <>
              <p className="sm-meta">Install SILA Store so it opens on its own, without the browser bar.</p>
              <button type="button" className="sm-btn sm-btn--primary" onClick={install}>Install SILA Store</button>
            </>
          ) : iosHint ? (
            <p className="sm-meta">In Safari, tap Share, then Add to Home Screen.</p>
          ) : (
            <p className="sm-meta">Use the browser menu and choose Install app, or Add to Home Screen.</p>
          )}
        </Card>
        <Card title="Connectivity" aside={<StatusBadge status={online ? 'ACTIVE' : 'FAILED'} label={online ? 'Online' : 'Offline'} />}>
          <p className="sm-meta">{online ? 'Connected. Postings go straight to SILA ME.' : 'No connection. Posting needs a connection.'}</p>
        </Card>
        <Card title="Working context">
          <p className="sm-meta">
            {person?.organizationName ?? '—'} · {location ? `${location.locationName} (${location.locationCode})` : 'No location'}
          </p>
          {location && locations.length > 1 && (
            <LocationPicker label="My location" locations={locations} value={location.id} onChange={setLocationId} />
          )}
        </Card>
      </div>
    </>
  );
};

export default SettingsScreen;
