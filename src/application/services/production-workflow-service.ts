import type { Asset, BoardPrompt, ProjectGraph, ScreenplayVersion, ShotGroup } from "../../domain/models";
import { AssetExtractionService } from "./asset-extraction-service";
import { BoardPromptService } from "./board-prompt-service";
import { ShotGroupService } from "./shot-group-service";
import { exportProject, type ProjectExport } from "./export-service";

export interface ProductionResult { assets: Asset[]; boardPrompts: BoardPrompt[]; shotGroups: ShotGroup[]; warnings: string[]; }

export class ProductionWorkflowService {
  extract(version: ScreenplayVersion): ProductionResult {
    const extracted = new AssetExtractionService().extract(version);
    const boards = new BoardPromptService().generate(extracted.assets);
    const shots: ShotGroup[] = [];
    const warnings = [...extracted.warnings, ...boards.errors];
    for (const scene of version.scenes) {
      try { shots.push(new ShotGroupService().generate(scene, { projectId: version.projectId, episode: 1, assets: extracted.assets })); }
      catch (error) { warnings.push(error instanceof Error ? error.message : String(error)); }
    }
    return { assets: extracted.assets, boardPrompts: boards.prompts, shotGroups: shots, warnings };
  }

  export(graph: ProjectGraph): ProjectExport { return exportProject(graph); }
}

