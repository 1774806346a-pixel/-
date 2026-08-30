import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../domain/models";
import { InMemoryProjectRepository, TauriProjectRepository } from "../infrastructure/project-repository";
import { ProjectService } from "../application/services/project-service";
import { getActiveModelProfileId, loadModelProfiles, setActiveModelProfileId, type ModelProfile } from "../application/model/model-profile";
import { ModelSettingsWorkspace } from "../features/settings/ModelSettingsWorkspace";
import { secretStorageMode } from "../infrastructure/secret-store";
import { EpisodicWorkspace } from "../features/episodic/EpisodicWorkspace";

export type EntryType = "creative" | "source";

export function App() {
  const projectService = useMemo(() => new ProjectService(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window ? new TauriProjectRepository(invoke) : new InMemoryProjectRepository()), []);
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [projectName, setProjectName] = useState("我的短剧项目");
  const [showSettings, setShowSettings] = useState(false);
  const [profiles, setProfiles] = useState<ModelProfile[]>(loadModelProfiles);
  const [activeId, setActiveId] = useState(getActiveModelProfileId);
  const active = profiles.find((profile) => profile.id === activeId) ?? profiles[0];
  useEffect(() => { void projectService.list().then(setProjects).catch(() => undefined); }, [projectService]);
  async function createProject(kind: EntryType) { const project = await projectService.create(projectName.trim() || "我的短剧项目"); setProjects(await projectService.list()); setCurrentProject(project); setEntryType(kind); }
  async function openProject(project: Project) { await projectService.load(project.id); setCurrentProject(project); setEntryType("source"); }
  async function deleteProject(project: Project) {
    if (!window.confirm(`永久删除项目“${project.name}”及其全部内容？此操作无法撤销。`)) return;
    try {
      await projectService.deletePermanently(project.id);
      setProjects(await projectService.list());
      if (currentProject?.id === project.id) { setCurrentProject(null); setEntryType(null); }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "永久删除失败");
    }
  }
  return <main className="workspace">
    <header className="topbar"><div><span className="eyebrow">LOCAL CREATIVE WORKSPACE</span><h1>戏匠</h1></div><div className="model-status"><span className="status-dot" />{active?.name ?? "未配置模型"}<button className="quiet-button" type="button" onClick={() => setShowSettings(true)}>模型设置</button></div></header>
    {!currentProject || !entryType ? <>
      <section className="home-hero"><p className="section-label">按集创作工作台</p><h2>从一句话或原文，直接写成短剧</h2><p className="muted">选择入口后，按集保存剧本；后续集会自动参考主体大纲与前集内容。</p><div className="project-entry"><input aria-label="项目名称" value={projectName} onChange={(event) => setProjectName(event.target.value)} /><span className="muted">新建项目名称</span></div></section>
      <section className="entry-grid" aria-label="创作入口"><button className="entry-card" type="button" onClick={() => void createProject("creative")}><span className="entry-kicker">01</span><strong>创意中心</strong><span>一句话创意，生成分集短剧本</span><em>开始创作 →</em></button><button className="entry-card" type="button" onClick={() => void createProject("source")}><span className="entry-kicker">02</span><strong>剧本演练</strong><span>小说、章节或原文，按模板改编</span><em>导入原文 →</em></button></section>
      <section className="project-list" aria-label="项目列表"><div className="section-heading"><p className="section-label">最近项目</p><span>{projects.length} 个项目</span></div>{projects.length === 0 ? <p className="empty">还没有项目，从上方入口开始。</p> : projects.map((project) => <div className="project-row" key={project.id}><button type="button" onClick={() => void openProject(project)}><strong>{project.name}</strong><span>打开项目 →</span></button><button type="button" className="danger-button" aria-label={`永久删除 ${project.name}`} onClick={() => void deleteProject(project)}>删除</button></div>)}</section>
    </> : <EpisodicWorkspace project={currentProject} entryType={entryType} projectService={projectService} activeProfile={active} onBack={() => { setCurrentProject(null); setEntryType(null); }} onProjectsRefresh={() => void projectService.list().then(setProjects)} />}
    <footer className="workspace-footer"><span>本地工作区已就绪</span><span>数据仅保存在本机</span></footer>
    {showSettings && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowSettings(false); }}><section className="model-panel" role="dialog" aria-modal="true" aria-labelledby="model-settings-title"><div className="panel-heading"><h2 id="model-settings-title">模型设置</h2><button className="icon-button" type="button" aria-label="关闭" onClick={() => setShowSettings(false)}>×</button></div><ModelSettingsWorkspace profiles={profiles} activeId={activeId} storageMode={secretStorageMode} onSelect={(id) => { setActiveId(id); setActiveModelProfileId(id); setProfiles(loadModelProfiles()); }} /></section></div>}
  </main>;
}
