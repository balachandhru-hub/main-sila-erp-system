import React from 'react';
import Card from '../../components/Card';
import LocationPicker from '../../components/LocationPicker';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { useOnline } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useMyLocation } from '../../location';

/** Connectivity and working context; the working location can be changed here as on Home. */
const SettingsScreen: React.FC = () => {
  const { person } = useAccess();
  const { locations, location, setLocationId } = useMyLocation();
  const online = useOnline();

  return (
    <>
      <ScreenHeader title="Settings" eyebrow="More" back />
      <div className="sm-screen">
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
