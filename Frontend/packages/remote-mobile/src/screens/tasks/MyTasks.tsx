import React from 'react';
import { getStockCountTasks, type SilaStockCountTask } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { getPhysicalInventories } from '../../../../remote-buyer/src/api/silaMe/silaControlApi';
import { getOpenSubstitutionTasks } from '../../../../remote-buyer/src/api/silaMe/silaSubstitutionApi';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

type Group = 'STOCK_COUNT' | 'RECOUNT_REQUIRED' | 'SHORTAGE_ENQUIRY' | 'INFORMATION_REQUESTED';

const GROUPS: { key: Group; label: string }[] = [
  { key: 'STOCK_COUNT', label: 'Stock count' },
  { key: 'SHORTAGE_ENQUIRY', label: 'Shortage enquiry' },
  { key: 'RECOUNT_REQUIRED', label: 'Recount required' },
  { key: 'INFORMATION_REQUESTED', label: 'Information requested' },
];

/** The prototype's four stock task groups, from the task type and status the API returns. */
const groupOf = (task: SilaStockCountTask): Group => {
  if (task.taskType === 'SHORTAGE_ENQUIRY') return task.status === 'MORE_INFORMATION_REQUIRED' ? 'INFORMATION_REQUESTED' : 'SHORTAGE_ENQUIRY';
  return task.detail.toLowerCase().startsWith('recount') ? 'RECOUNT_REQUIRED' : 'STOCK_COUNT';
};

const OPEN_PI = ['SCHEDULED', 'IN_PROGRESS'];

/** "My tasks": counts, recounts, enquiries (also when more information is asked), physical inventories, recipe changes. */
const MyTasks: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const tasks = useLoad(getStockCountTasks, can.manageCount ? 'stock-tasks' : null);
  const inventories = useLoad(() => getPhysicalInventories('', '', { index: 0, limit: 50 }), can.manageCount ? 'physical-inventories' : null);
  const changes = useLoad(() => getOpenSubstitutionTasks(20), 'substitutions');
  const openInventories = (inventories.data ?? []).filter((item) => OPEN_PI.includes(item.status));

  const open = (task: SilaStockCountTask) => {
    if (task.taskType === 'SHORTAGE_ENQUIRY') go(`tasks/enquiries/${task.referenceId}`);
    else go(`inventory/counts/${task.stockCountId}`);
  };

  return (
    <>
      {tasks.loading && <Loading />}
      {tasks.error && <ErrorNotice message={tasks.error} onRetry={tasks.reload} />}
      {tasks.data &&
        GROUPS.map((group) => {
          const items = (tasks.data ?? []).filter((task) => groupOf(task) === group.key);
          return (
            <section key={group.key} className="sm-card" aria-label={group.label}>
              <strong className="sm-title">
                {group.label} · {items.length}
              </strong>
              {items.map((task) => (
                <button key={`${task.taskType}-${task.referenceId}`} type="button" className="sm-list-btn" onClick={() => open(task)}>
                  <span className="sm-row">
                    <strong>{task.number}</strong>
                    <StatusBadge status={task.status} />
                  </span>
                  <span className="sm-meta">
                    {task.locationName ?? '—'} · {task.detail}
                  </span>
                  <span className="sm-meta">{formatDate(task.dateCreated)}</span>
                </button>
              ))}
            </section>
          );
        })}

      {can.manageCount && (
        <section className="sm-section" aria-labelledby="sm-pi-tasks">
          <h2 id="sm-pi-tasks">Physical inventory at my locations · {inventories.loading ? '…' : openInventories.length}</h2>
          {inventories.error && <ErrorNotice message={inventories.error} onRetry={inventories.reload} />}
          {!inventories.loading && !inventories.error && openInventories.length === 0 && <Empty text="No physical inventory scheduled." />}
          <ul className="sm-list">
            {openInventories.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="sm-list-btn"
                  disabled={!item.stockCountId}
                  onClick={() => item.stockCountId && go(`inventory/counts/${item.stockCountId}`)}
                >
                  <span className="sm-row">
                    <strong>{item.requestNumber}</strong>
                    <StatusBadge status={item.status} />
                  </span>
                  <span className="sm-meta">
                    {item.locationName ?? '—'} · scheduled {formatDate(item.scheduledDate)}
                    {item.countNumber ? ` · count ${item.countNumber}` : ' · count starts on the scheduled day'}
                  </span>
                  <span className="sm-meta">{item.alertTitle ?? item.reason}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recipe change suggestions; hidden for users who may not see recipes (null). */}
      {(changes.loading || changes.error || (changes.data && changes.data.length > 0)) && (
        <section className="sm-section" aria-labelledby="sm-recipe-changes">
          <h2 id="sm-recipe-changes">Recipe changes</h2>
          {changes.loading && <Loading />}
          {changes.error && <ErrorNotice message={changes.error} onRetry={changes.reload} />}
          <ul className="sm-list">
            {(changes.data ?? []).map((item) => (
              <li key={item.id}>
                <button type="button" className="sm-list-btn" onClick={() => go(`tasks/substitutions/${item.id}`)}>
                  <span className="sm-row">
                    <strong>
                      {item.recipeCode} {item.recipeName}
                    </strong>
                    <StatusBadge status={item.status} />
                  </span>
                  <span>
                    Replace {item.ingredientName} with {item.suggestedName}
                  </span>
                  <span className="sm-meta">
                    {item.locationName ?? '—'} · {formatDate(item.dateCreated)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

export default MyTasks;
