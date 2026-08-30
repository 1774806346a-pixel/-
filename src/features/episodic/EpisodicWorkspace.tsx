import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset, BoardPrompt, Project, ScreenplayVersion } from "../../domain/models";
import type { GenerateEpisodeRequest, ProjectService } from "../../application/services/project-service";
import type { ModelProfile } from "../../application/model/model-profile";
import { createAdapterForProfile } from "../../application/model/model-profile";
import { describeModelError } from "../../application/model/model-errors";
import { runGeneration } from "../../application/model/generation-runner";
import { createStoryOutlinePromptLayers } from "../../application/prompts/screenplay-prompts";
import { mergePromptLayers } from "../../application/prompts/prompt-layers";
import { generateBoardPrompts } from "../../application/services/board-prompt-service";
import { analyzeProjectAssets } from "../../application/services/model-asset-analysis-service";
import { AssetsWorkspace } from "../assets/AssetsWorkspace";

type EntryType = "creative" | "source";

interface Props {
  project: Project;
  entryType: EntryType;
  projectService: ProjectService;
  activeProfile?: ModelProfile;
  onBack: () => void;
  onProjectsRefresh: () => void;
}

export interface EpisodicGenerationWithOutlineOptions {
  readonly projectService: ProjectService;
  readonly request: GenerateEpisodeRequest;
  readonly onOutline?: (outline: string) => void;
  readonly onStatus?: (status: string) => void;
}

export async function generateEpisodeWithOutline(
  options: EpisodicGenerationWithOutlineOptions,
) {
  const { request, projectService } = options;
  const episodeNumber = request.episodeNumber ?? 1;
  let outline = request.outline?.trim() ?? "";
  if (episodeNumber === 1 && !outline) {
    options.onStatus?.("正在生成故事大纲...");
    const merged = mergePromptLayers(createStoryOutlinePromptLayers({
      source: request.source,
      metadata: request.metadata,
      entryType: request.entryType,
    }));
    const generated = await runGeneration(
      request.adapter,
      { taskType: "custom", systemPrompt: merged.systemPrompt, userPrompt: merged.userPrompt, timeoutMs: 120_000 },
      { signal: request.signal },
    );
    outline = generated.text.trim() || (typeof generated.value === "string" ? generated.value.trim() : generated.value ? JSON.stringify(generated.value) : "");
    if (!outline) throw new Error("故事大纲生成结果为空");
    options.onOutline?.(outline);
  }
  options.onStatus?.(`正在生成第 ${episodeNumber} 集...`);
  const generated = await projectService.generateEpisode({ ...request, outline });
  return { ...generated, outline };
}

export function EpisodicWorkspace({ project, entryType, projectService, activeProfile, onBack, onProjectsRefresh }: Props) {
  const [source, setSource] = useState("");
  const [outline, setOutline] = useState("");
  const [duration, setDuration] = useState(90);
  const [episode, setEpisode] = useState(1);
  const [episodes, setEpisodes] = useState<ScreenplayVersion[]>([]);
  const [result, setResult] = useState<ScreenplayVersion | null>(null);
  const [status, setStatus] = useState("准备就绪");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [selectedRefs, setSelectedRefs] = useState<number[]>([]);
  const [showAssets, setShowAssets] = useState(false);
  const [assetResult, setAssetResult] = useState<{ assets: Asset[]; boardPrompts: BoardPrompt[]; warnings: string[]; usedModel: boolean }>({ assets: [], boardPrompts: [], warnings: [], usedModel: false });
  const [assetRunning, setAssetRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const assetAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const graph = await projectService.load(project.id);
        if (cancelled) return;
        const versions = [...(graph?.screenplayVersions ?? [])].filter((v) => typeof v.episodeNumber === "number").sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
        setEpisodes(versions);
        const latest = versions.at(-1);
        if (latest) { setOutline(latest.generationContext?.outline ?? ""); setSource(latest.generationContext?.source ?? ""); }
        try {
          const persistedAssets = await projectService.loadProjectAssets(project.id);
          if (!cancelled) setAssetResult({ assets: persistedAssets.assets, boardPrompts: persistedAssets.boardPrompts, warnings: [], usedModel: false });
        } catch {
          // Asset persistence was added after the screenplay workflow; an empty library is valid.
        }
      } catch {
        // Loading the screenplay remains usable when an older backend has no asset rows yet.
      }
    })();
    return () => { cancelled = true; };
  }, [project.id, projectService]);
  const prior = useMemo(() => episodes.filter((item) => (item.episodeNumber ?? 0) < episode), [episodes, episode]);
  useEffect(() => { setSelectedRefs(prior.length ? [prior.at(-1)!.episodeNumber!] : []); const existing = episodes.find((item) => item.episodeNumber === episode); setResult(existing ?? null); }, [episode, episodes, prior.length]);

  async function generate() {
    if (!activeProfile) { setError("请先在模型设置中配置模型"); return; }
    if (!source.trim()) { setError(entryType === "creative" ? "请输入一句话创意" : "请输入原文"); return; }
    setRunning(true); setError(""); setStatus(`正在生成第 ${episode} 集…`); abortRef.current = new AbortController();
    try {
      const adapter = await createAdapterForProfile(activeProfile);
      const generated = await generateEpisodeWithOutline({ projectService, onOutline: setOutline, onStatus: setStatus, request: { projectId: project.id, adapter, signal: abortRef.current.signal, source, outline, episodeNumber: episode, entryType, referenceEpisodeNumbers: selectedRefs, metadata: { genre: "短剧", episodeCount: Math.max(episode, episodes.length), episodeDurationSeconds: duration, audience: "大众" } } });
      setResult(generated.version); setEpisodes((current) => [...current.filter((item) => item.episodeNumber !== episode), generated.version].sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0))); setStatus(`第 ${episode} 集已生成`); onProjectsRefresh();
    } catch (cause) {
      if (abortRef.current?.signal.aborted) setStatus("已取消生成");
      else {
        const message = describeModelError(cause);
        setError(message);
        setStatus(`生成失败：${message}`);
      }
    }
    finally { setRunning(false); abortRef.current = null; }
  }
  function cancel() { abortRef.current?.abort(); }
  function addEpisode() { setEpisode((current) => Math.max(current + 1, episodes.length + 1)); setResult(null); }
  async function extractProductionAssets() {
    if (!activeProfile) { setError("请先在模型设置中配置模型"); return; }
    if (!episodes.length) { setError("请先生成至少一集剧本"); return; }
    setAssetRunning(true); setError(""); setStatus("正在分析全部剧本并合并资产...");
    assetAbortRef.current = new AbortController();
    try {
      const adapter = await createAdapterForProfile(activeProfile);
      const analyzed = await analyzeProjectAssets(adapter, episodes, assetResult.assets, assetAbortRef.current.signal);
      const generatedPrompts = generateBoardPrompts(analyzed.assets);
      const warnings = [...analyzed.warnings, ...generatedPrompts.errors];
      await projectService.saveProjectAssets(project.id, analyzed.assets, generatedPrompts.prompts);
      setAssetResult({ assets: analyzed.assets, boardPrompts: generatedPrompts.prompts, warnings, usedModel: analyzed.usedModel });
      setShowAssets(true);
      setStatus(analyzed.usedModel ? `已分析 ${episodes.length} 集并保存资产` : "模型分析失败，已保留规则提取结果");
    } catch (cause) {
      const message = describeModelError(cause);
      setError(message);
      setStatus(`资产提取失败：${message}`);
    } finally {
      setAssetRunning(false);
      assetAbortRef.current = null;
    }
  }

  return <section className="episodic-workspace" aria-label="按集剧本工作台">
    <div className="workspace-heading"><div><button className="secondary-button" type="button" onClick={onBack}>← 返回入口</button><p className="section-label">{entryType === "creative" ? "创意中心" : "剧本演练"}</p><h2>{project.name}</h2></div><span className="workspace-chip">按集创作</span></div>
    <div className="episodic-layout">
      <aside className="episodic-sidebar">
        <label className="field-label">目标集数<select aria-label="目标集数" value={episode} onChange={(event) => setEpisode(Number(event.target.value))}>{Array.from({ length: Math.max(episodes.length, episode, 1) }, (_, index) => index + 1).map((number) => <option key={number} value={number}>第 {number} 集</option>)}</select></label>
        <button className="secondary-button" type="button" onClick={addEpisode}>＋ 创建下一集</button>
        <label className="field-label">单集时长（秒）<input aria-label="单集时长" type="number" min={30} max={600} value={duration} onChange={(event) => setDuration(Number(event.target.value) || 90)} /></label>
        <label className="field-label">主体大纲<textarea aria-label="主体大纲" value={outline} onChange={(event) => setOutline(event.target.value)} placeholder="项目级大纲，供所有集参考" /></label>
        {prior.length > 0 && <fieldset className="reference-list"><legend>参考前集剧本</legend>{prior.map((item) => <label key={item.id}><input type="checkbox" checked={selectedRefs.includes(item.episodeNumber!)} onChange={(event) => setSelectedRefs((current) => event.target.checked ? [...current, item.episodeNumber!] : current.filter((number) => number !== item.episodeNumber))} />第 {item.episodeNumber} 集</label>)}</fieldset>}
      </aside>
      <div className="episodic-main">
        <label className="field-label">{entryType === "creative" ? "一句话创意" : "原文"}<textarea className="source-input" aria-label={entryType === "creative" ? "一句话创意" : "原文"} value={source} onChange={(event) => setSource(event.target.value)} placeholder={entryType === "creative" ? "例如：落魄女掌柜在婚礼当天发现新郎是仇人之子" : "粘贴小说、章节、大纲或已有剧本"} /></label>
        <div className="generation-actions">{running ? <button type="button" className="secondary-button" onClick={cancel}>取消生成</button> : <button type="button" onClick={() => void generate()}>生成第 {episode} 集</button>}<button type="button" className="secondary-button" onClick={() => void extractProductionAssets()} disabled={assetRunning}>{assetRunning ? "正在提取资产..." : "提取资产"}</button><span className="generation-status" role="status">{status}</span></div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <section className="screenplay-result" aria-label="剧本结果"><div className="section-heading"><p className="section-label">第 {episode} 集剧本</p>{result && <span>{result.scenes.length} 场</span>}</div>{result ? <pre>{result.bodyMarkdown ?? ""}</pre> : <p className="empty">生成结果会显示在这里。</p>}</section>
      </div>
    </div>
    {showAssets && <div className="asset-panel"><div className="panel-heading"><h3>场景 / 人物 / 道具</h3><button type="button" className="secondary-button" onClick={() => setShowAssets(false)}>关闭</button></div><AssetsWorkspace assets={assetResult.assets} boardPrompts={assetResult.boardPrompts} warnings={assetResult.warnings} /></div>}
  </section>;
}
