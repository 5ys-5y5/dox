import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfRuleModel,
  TemplateExtractPdfTopologyModel,
} from '../lib/templateExtractDtos';
import { TemplateExtractPdfLayoutService } from './templateExtractPdfLayoutService';
import { TemplateExtractPdfTextRecoveryService } from './templateExtractPdfTextRecoveryService';
import { TemplateExtractPdfTopologyService } from './templateExtractPdfTopologyService';
import { TemplateExtractWorkOrderTopologyBuilderService } from './templateExtractWorkOrderTopologyBuilderService';

export type TemplateExtractWorkOrderBuildResult = {
  html: string | null;
  cloneBuilder: string;
};

const countValueMarkers = (html: string | null) => html?.match(/data-template-value=/g)?.length || 0;

const shouldPreferLegacyDigital = (topologyHtml: string | null, legacyHtml: string | null) => {
  if (!legacyHtml) {
    return false;
  }

  if (!topologyHtml) {
    return true;
  }

  const topologyValueCount = countValueMarkers(topologyHtml);
  const legacyValueCount = countValueMarkers(legacyHtml);

  if (topologyValueCount === 0) {
    return true;
  }

  if (legacyValueCount < 8) {
    return false;
  }

  return topologyValueCount < Math.ceil(legacyValueCount * 0.6) && legacyValueCount - topologyValueCount >= 8;
};

const shouldPreferScannedFallback = (topology: TemplateExtractPdfTopologyModel, topologyHtml: string | null) => {
  if (!topologyHtml) {
    return true;
  }

  const { textBlockCount, cellCandidateCount } = topology.summary;

  return textBlockCount === 0 || cellCandidateCount === 0;
};

export const TemplateExtractWorkOrderBuilderService = {
  buildFromTopology(
    sourceTitle: string,
    topology: TemplateExtractPdfTopologyModel,
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ): TemplateExtractWorkOrderBuildResult {
    const html = TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(sourceTitle, topology, version);

    return {
      html,
      cloneBuilder: html ? 'work_order_family_topology' : 'work_order_family_topology_failed',
    };
  },

  buildFromDigitalLayout(
    sourceTitle: string,
    layout: TemplateExtractPdfLayoutModel,
    topology: TemplateExtractPdfTopologyModel = TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout),
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ): TemplateExtractWorkOrderBuildResult {
    const topologyHtml = TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(sourceTitle, topology, version);
    const legacyHtml = TemplateExtractPdfLayoutService.buildCloneHtml(sourceTitle, layout.rawText, layout, version);

    if (shouldPreferLegacyDigital(topologyHtml, legacyHtml)) {
      return {
        html: legacyHtml,
        cloneBuilder: 'work_order_family_legacy_digital',
      };
    }

    return {
      html: topologyHtml || legacyHtml,
      cloneBuilder: topologyHtml ? 'work_order_family_topology_digital' : 'work_order_family_legacy_digital',
    };
  },

  buildFromRuleModel(
    sourceTitle: string,
    fileName: string,
    ruleModel: TemplateExtractPdfRuleModel,
    topology: TemplateExtractPdfTopologyModel = TemplateExtractPdfTopologyService.buildFromScannedRuleModel(ruleModel),
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ): TemplateExtractWorkOrderBuildResult {
    const topologyHtml = TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(sourceTitle, topology, version);

    if (!shouldPreferScannedFallback(topology, topologyHtml)) {
      return {
        html: topologyHtml,
        cloneBuilder: 'work_order_family_topology_scanned',
      };
    }

    const fallbackHtml = TemplateExtractPdfTextRecoveryService.buildHtmlFromRuleModel(sourceTitle, fileName, ruleModel, version);

    return {
      html: fallbackHtml || topologyHtml,
      cloneBuilder: fallbackHtml ? 'work_order_family_frame_scanned' : 'work_order_family_topology_scanned',
    };
  },
};
