import React, { useState } from 'react';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useMyLocation } from '../../location';
import { signOut } from '../../person';
import { errorText } from '../../useLoad';

const ProfileScreen: React.FC = () => {
  const { person: data, loading, error, reload } = useAccess();
  const { locations, location } = useMyLocation();
  const [leaving, setLeaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const logOut = async () => {
    setLeaving(true);
    setNotice(null);
    try {
      await signOut();
    } catch (caught: unknown) {
      // The session is closed on this device anyway (session:expired was raised).
      setNotice({ tone: 'warning', text: errorText(caught, 'Signed out on this device.') });
      setLeaving(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Profile" eyebrow="Account" back />
      <div className="sm-screen">
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <Card title={data.name} aside={<StatusBadge status="ACTIVE" />}>
            <dl className="sm-kv">
              <dt>Email</dt>
              <dd>{data.email || '—'}</dd>
              <dt>Application</dt>
              <dd>Mobile</dd>
              <dt>Role</dt>
              <dd>{data.roleName || '—'}</dd>
              <dt>Organization</dt>
              <dd>{data.organizationName || '—'}</dd>
              <dt>Operating unit</dt>
              <dd>{location ? location.locationName : '—'}</dd>
            </dl>
          </Card>
        )}
        {locations.length > 0 && (
          <Card title="My locations">
            <ul className="sm-list">
              {locations.map((item) => (
                <li key={item.id} className="sm-meta">
                  <strong>{item.locationName}</strong> · {item.locationCode} · {item.propertyName}
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Notice notice={notice} />
        <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={leaving} onClick={logOut}>
          {leaving ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </>
  );
};

export default ProfileScreen;
