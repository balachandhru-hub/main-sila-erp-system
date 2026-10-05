import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ScreenHeader from '../../components/ScreenHeader';
import { useGo } from '../../navigation';
import MyTasks from './MyTasks';
import { CloudApprovals, GrnExceptions, ItoApprovals } from './TaskTabs';

type TabKey = 'mine' | 'ito' | 'approvals' | 'exceptions';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'mine', label: 'My tasks' },
  { key: 'ito', label: 'ITO approvals' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'exceptions', label: 'Exceptions' },
];

const isTab = (value: string | null): value is TabKey => TABS.some((tab) => tab.key === value);

const TasksScreen: React.FC = () => {
  const go = useGo();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: TabKey = isTab(requested) ? requested : 'mine';

  return (
    <>
      <ScreenHeader title="Tasks" eyebrow="Operations" />
      <div className="sm-screen">
        <div className="sm-tabs sm-tabs--wrap" role="group" aria-label="Task lists">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="sm-tab"
              aria-pressed={item.key === tab}
              onClick={() => setParams({ tab: item.key }, { replace: true })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="sm-btn sm-btn--block" onClick={() => go('tasks/alerts')}>
          Alerts / inventory actions
        </button>
        {tab === 'mine' && <MyTasks />}
        {tab === 'ito' && <ItoApprovals />}
        {tab === 'approvals' && <CloudApprovals />}
        {tab === 'exceptions' && <GrnExceptions />}
      </div>
    </>
  );
};

export default TasksScreen;
