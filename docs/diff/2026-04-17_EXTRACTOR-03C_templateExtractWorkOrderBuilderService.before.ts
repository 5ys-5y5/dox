import type {
  TemplateExtractEngineVersion,
  TemplateExtractPdfLayoutModel,
  TemplateExtractPdfRuleModel,
  TemplateExtractPdfTopologyModel,
} from '../lib/templateExtractDtos';
import { TemplateExtractPdfTopologyService } from './templateExtractPdfTopologyService';
import { TemplateExtractWorkOrderTopologyBuilderService } from './templateExtractWorkOrderTopologyBuilderService';

export const TemplateExtractWorkOrderBuilderService = {
  buildFromTopology(
    sourceTitle: string,
    topology: TemplateExtractPdfTopologyModel,
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ) {
    return TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(sourceTitle, topology, version);
  },

  buildFromDigitalLayout(
    sourceTitle: string,
    layout: TemplateExtractPdfLayoutModel,
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ) {
    return TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(
      sourceTitle,
      TemplateExtractPdfTopologyService.buildFromDigitalLayout(layout),
      version
    );
  },

  buildFromRuleModel(
    sourceTitle: string,
    _fileName: string,
    ruleModel: TemplateExtractPdfRuleModel,
    version: Extract<TemplateExtractEngineVersion, '20'> = '20'
  ) {
    return TemplateExtractWorkOrderTopologyBuilderService.buildCloneHtml(
      sourceTitle,
      TemplateExtractPdfTopologyService.buildFromScannedRuleModel(ruleModel),
      version
    );
  },
};
