import React from 'react';
import { useAppContext } from './AppContext';

export function AppNameBadge() {
  const { appName, projectName } = useAppContext();
  if (!appName && !projectName) {
    return null;
  }

  return (
    <div className="cext-context-badges">
      {projectName && (
        <span className="cext-app-badge cext-app-badge--project">
          <i className="fa fa-folder-open" />
          {projectName}
        </span>
      )}
      {appName && (
        <span className="cext-app-badge">
          <i className="fa fa-cube" />
          {appName}
        </span>
      )}
    </div>
  );
}
