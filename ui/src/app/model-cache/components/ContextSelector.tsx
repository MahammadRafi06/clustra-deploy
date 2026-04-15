import React, { useEffect, useMemo, useState } from "react";
import { listArgoApplications, listArgoProjects } from "../api/client";
import type { Application, ApplicationSource, Project } from "../api/types";

export interface SelectedAppTarget {
  appName: string;
  appNamespace: string;
  projectName: string;
  application: Application;
}

interface ContextSelectorProps {
  value: SelectedAppTarget | null;
  onChange: (target: SelectedAppTarget | null) => void;
}

function applicationKey(application: Application): string {
  return `${application.metadata.namespace ?? "argocd"}:${application.metadata.name}`;
}

function toTarget(application: Application, projectName: string): SelectedAppTarget {
  return {
    appName: application.metadata.name,
    appNamespace: application.metadata.namespace ?? "argocd",
    projectName,
    application,
  };
}

function primarySource(application: Application): ApplicationSource | undefined {
  return application.spec.source ?? application.spec.sources?.[0];
}

export const ContextSelector: React.FC<ContextSelectorProps> = ({ value, onChange }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState(value?.projectName ?? "");
  const [applications, setApplications] = useState<Application[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const selectedKey = value ? `${value.appNamespace}:${value.appName}` : "";

  useEffect(() => {
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);

    listArgoProjects()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setProjects(items);
        if (!projectName && items.length > 0) {
          const defaultProject = items.find((item) => item.metadata.name === "default")?.metadata.name ?? items[0].metadata.name;
          setProjectName(defaultProject);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setProjectsError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!projectName) {
      setApplications([]);
      setApplicationsLoading(false);
      setApplicationsError(null);
      return;
    }

    setApplicationsLoading(true);
    setApplicationsError(null);

    listArgoApplications(projectName)
      .then((items) => {
        if (cancelled) {
          return;
        }

        const filtered = items.filter((item) => (item.spec.project ?? "") === projectName);
        setApplications(filtered);

        const currentSelection = filtered.find((item) => applicationKey(item) === selectedKey);

        if (currentSelection) {
          if (value?.projectName !== projectName) {
            onChange(toTarget(currentSelection, projectName));
          }
          return;
        }

        if (filtered.length === 1) {
          if (applicationKey(filtered[0]) !== selectedKey || value?.projectName !== projectName) {
            onChange(toTarget(filtered[0], projectName));
          }
          return;
        }

        if (value !== null) {
          onChange(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setApplicationsError(error instanceof Error ? error.message : String(error));
          setApplications([]);
          if (value !== null) {
            onChange(null);
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setApplicationsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onChange, projectName, selectedKey, value]);

  const applicationValue = value ? `${value.appNamespace}:${value.appName}` : "";
  const selectedSource = useMemo(() => (value ? primarySource(value.application) : undefined), [value]);

  function handleProjectChange(nextProjectName: string) {
    setProjectName(nextProjectName);
    setApplications([]);
    setApplicationsError(null);
    onChange(null);
  }

  function handleApplicationChange(nextApplication: string) {
    const selectedApplication = applications.find((item) => applicationKey(item) === nextApplication);
    if (!selectedApplication || !projectName) {
      onChange(null);
      return;
    }
    onChange(toTarget(selectedApplication, projectName));
  }

  return (
    <div className="model-cache-context">
      <div className="model-cache-panel__header">
        <div>
          <div className="model-cache-panel__eyebrow">Target Context</div>
          <div className="model-cache-panel__title">Select the Argo CD scope for this workspace</div>
          <div className="model-cache-panel__subtitle">
            Proxy requests inherit Argo CD auth, but they still need a project and application context to be authorized safely.
          </div>
        </div>
      </div>

      <div className="model-cache-context__grid">
        <div className="model-cache-field">
          <label htmlFor="model-cache-project">Project</label>
          <select
            id="model-cache-project"
            className="model-cache-input"
            value={projectName}
            onChange={(event) => handleProjectChange(event.target.value)}
            disabled={projectsLoading || projects.length === 0}
          >
            <option value="">{projectsLoading ? "Loading projects..." : "Select a project"}</option>
            {projects.map((project) => (
              <option key={project.metadata.name} value={project.metadata.name}>
                {project.metadata.name}
              </option>
            ))}
          </select>
          <p className="model-cache-field__hint">Choose an existing Argo CD project visible to the current user.</p>
        </div>

        <div className="model-cache-field">
          <label htmlFor="model-cache-application">Application</label>
          <select
            id="model-cache-application"
            className="model-cache-input"
            value={applicationValue}
            onChange={(event) => handleApplicationChange(event.target.value)}
            disabled={!projectName || applicationsLoading || applications.length === 0}
          >
            <option value="">
              {!projectName
                ? "Select a project first"
                : applicationsLoading
                  ? "Loading applications..."
                  : "Select an application"}
            </option>
            {applications.map((application) => (
              <option key={applicationKey(application)} value={applicationKey(application)}>
                {(application.metadata.namespace ?? "argocd")}/{application.metadata.name}
              </option>
            ))}
          </select>
          <p className="model-cache-field__hint">The selected application becomes the authorization scope for this system page.</p>
        </div>
      </div>

      {projectsError && <div className="model-cache-inline-alert model-cache-inline-alert--error">Unable to load Argo CD projects: {projectsError}</div>}
      {applicationsError && <div className="model-cache-inline-alert model-cache-inline-alert--error">Unable to load Argo CD applications: {applicationsError}</div>}

      {!projectsLoading && projects.length === 0 && (
        <div className="model-cache-inline-alert model-cache-inline-alert--warning">
          No Argo CD projects are visible to the current user.
        </div>
      )}

      {!applicationsLoading && projectName && applications.length === 0 && !applicationsError && (
        <div className="model-cache-inline-alert model-cache-inline-alert--warning">
          No applications are currently available in project "{projectName}".
        </div>
      )}

      {value && (
        <div className="model-cache-context__summary">
          <div className="model-cache-context__summary-title">Selected Target</div>
          <div className="model-cache-context__row">
            <span>Application</span>
            <strong>{value.appNamespace}/{value.appName}</strong>
          </div>
          <div className="model-cache-context__row">
            <span>Project</span>
            <strong>{value.projectName}</strong>
          </div>
          {selectedSource?.repoURL && (
            <div className="model-cache-context__row">
              <span>Repository</span>
              <strong>{selectedSource.repoURL}</strong>
            </div>
          )}
          {selectedSource?.path && (
            <div className="model-cache-context__row">
              <span>Path</span>
              <strong>{selectedSource.path}</strong>
            </div>
          )}
          {selectedSource?.targetRevision && (
            <div className="model-cache-context__row">
              <span>Revision</span>
              <strong>{selectedSource.targetRevision}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
