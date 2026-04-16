import { createClient } from '@supabase/supabase-js';
import { DocumentService } from './documentService';
import type {
  RequiredDocumentRuleInput,
  SiteChecklistItemDto,
  SiteChecklistRebuildInput,
  SiteChecklistRebuildResult,
  SiteChecklistRuleDto,
  SiteChecklistSummaryDto,
  SiteCreateInput,
  SiteCreateResult,
  SiteRecordDto,
} from '../lib/siteChecklistDtos';

type SiteRegistryRow = {
  id: string;
  site_name: string;
  trade_keys: string[] | null;
  open_date: string;
  checklist_version: number | null;
  created_at: string;
  updated_at: string;
};

type RequiredDocumentRuleRow = {
  id: string;
  trade_key: string;
  document_type_key: string;
  document_title: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type SiteChecklistSnapshotRow = {
  id: string;
  site_id: string;
  checklist_version: number;
  generated_at: string;
};

type SiteChecklistItemRow = {
  id: string;
  site_id: string;
  checklist_snapshot_id: string;
  checklist_version: number;
  document_type_key: string;
  document_title: string;
  source_trade_keys: string[] | null;
  status: SiteChecklistItemDto['status'];
  linked_document_id: string | null;
  generated_at: string;
};

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase 설정이 .env에 누락되었습니다. (URL 또는 SERVICE_ROLE_KEY)');
  }

  return createClient(supabaseUrl, supabaseKey);
};

const SITES_DB_SCHEMA = 'sites';

// SITES_SCHEMA_BOUNDARY
// 현장 체크리스트 도메인 테이블은 public이 아니라 sites 스키마만 사용합니다.
// 현장 메타데이터, 공종별 필수 서류 규칙, 체크리스트 스냅샷, 체크리스트 항목은
// 각각 sites.site_registry, sites.required_document_rules,
// sites.site_checklist_snapshots, sites.site_checklist_items 가 정본입니다.
//
// SUPABASE_API_SCHEMA_REQUIRED
// server-side service role 로 schema('sites')를 사용하려면 PostgREST/Data API 가
// sites 스키마를 읽을 수 있어야 합니다.
// runtime 에서 Invalid schema: sites 오류가 나오면 pgrst.db_schemas 에 sites 를 추가해야 합니다.
const sitesSchema = (client = getSupabase()) => client.schema(SITES_DB_SCHEMA);

const normalizeTradeKeys = (tradeKeys: string[]) => {
  const normalizedTradeKeys = tradeKeys.map((item) => item.trim()).filter(Boolean);

  if (normalizedTradeKeys.length === 0) {
    throw new Error('현장 생성 실패: tradeKeys에 최소 1개 이상의 공종 키가 필요합니다.');
  }

  return [...new Set(normalizedTradeKeys)];
};

const normalizeRules = (rules: RequiredDocumentRuleInput[]) => {
  return rules.map((rule) => {
    const tradeKey = rule.tradeKey.trim();
    const documentTypeKey = rule.documentTypeKey.trim();
    const documentTitle = rule.documentTitle.trim();

    if (!tradeKey || !documentTypeKey || !documentTitle) {
      throw new Error('체크리스트 규칙 저장 실패: tradeKey, documentTypeKey, documentTitle은 필수입니다.');
    }

    return {
      tradeKey,
      documentTypeKey,
      documentTitle,
      description: rule.description?.trim() || null,
    };
  });
};

const toSiteRecordDto = (row: SiteRegistryRow): SiteRecordDto => ({
  id: row.id,
  siteName: row.site_name,
  tradeKeys: row.trade_keys || [],
  openDate: row.open_date,
  checklistVersion: row.checklist_version || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toRuleDto = (row: RequiredDocumentRuleRow): SiteChecklistRuleDto => ({
  id: row.id,
  tradeKey: row.trade_key,
  documentTypeKey: row.document_type_key,
  documentTitle: row.document_title,
  description: row.description,
  active: row.active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toChecklistItemDto = (row: SiteChecklistItemRow): SiteChecklistItemDto => ({
  id: row.id,
  siteId: row.site_id,
  checklistVersion: row.checklist_version,
  documentTypeKey: row.document_type_key,
  documentTitle: row.document_title,
  sourceTradeKeys: row.source_trade_keys || [],
  status: row.status,
  linkedDocumentId: row.linked_document_id,
  generatedAt: row.generated_at,
});

const getSiteById = async (siteId: string) => {
  const { data, error } = await sitesSchema()
    .from('site_registry')
    .select('*')
    .eq('id', siteId)
    .single();

  return { site: data as SiteRegistryRow | null, error };
};

const getRulesForTrades = async (tradeKeys: string[]) => {
  const { data, error } = await sitesSchema()
    .from('required_document_rules')
    .select('*')
    .eq('active', true)
    .in('trade_key', tradeKeys)
    .order('trade_key', { ascending: true })
    .order('document_type_key', { ascending: true });

  return { rules: (data || []) as RequiredDocumentRuleRow[], error };
};

const upsertRules = async (rules: RequiredDocumentRuleInput[]) => {
  if (!rules.length) {
    return [] as SiteChecklistRuleDto[];
  }

  const normalizedRules = normalizeRules(rules);
  const { data, error } = await sitesSchema()
    .from('required_document_rules')
    .upsert(
      normalizedRules.map((rule) => ({
        trade_key: rule.tradeKey,
        document_type_key: rule.documentTypeKey,
        document_title: rule.documentTitle,
        description: rule.description,
        active: true,
      })),
      { onConflict: 'trade_key,document_type_key' }
    )
    .select('*');

  if (error) {
    throw new Error(`체크리스트 규칙 저장 실패: ${error.message}`);
  }

  return ((data || []) as RequiredDocumentRuleRow[]).map(toRuleDto);
};

const buildChecklistSeed = async (site: SiteRegistryRow) => {
  const tradeKeys = site.trade_keys || [];
  const { rules, error: rulesError } = await getRulesForTrades(tradeKeys);

  if (rulesError) {
    throw new Error(`체크리스트 계산 실패: 규칙 조회 중 오류가 발생했습니다. (${rulesError.message})`);
  }

  const existingDocuments = await DocumentService.listDocuments({ siteId: site.id });
  const documentsByType = new Map(
    existingDocuments.map((item) => [item.document.documentTypeKey, item.document.id] as const)
  );

  const dedupedChecklistMap = new Map<
    string,
    {
      documentTypeKey: string;
      documentTitle: string;
      sourceTradeKeys: string[];
      linkedDocumentId: string | null;
      status: SiteChecklistItemDto['status'];
    }
  >();

  for (const rule of rules) {
    const existing = dedupedChecklistMap.get(rule.document_type_key);
    const linkedDocumentId = documentsByType.get(rule.document_type_key) || null;

    if (existing) {
      if (!existing.sourceTradeKeys.includes(rule.trade_key)) {
        existing.sourceTradeKeys.push(rule.trade_key);
      }

      if (!existing.linkedDocumentId && linkedDocumentId) {
        existing.linkedDocumentId = linkedDocumentId;
        existing.status = 'completed';
      }

      continue;
    }

    dedupedChecklistMap.set(rule.document_type_key, {
      documentTypeKey: rule.document_type_key,
      documentTitle: rule.document_title,
      sourceTradeKeys: [rule.trade_key],
      linkedDocumentId,
      status: linkedDocumentId ? 'completed' : 'missing',
    });
  }

  return [...dedupedChecklistMap.values()].sort((a, b) =>
    a.documentTypeKey.localeCompare(b.documentTypeKey, 'ko')
  );
};

export const SiteChecklistService = {
  async createSite(params: SiteCreateInput): Promise<SiteCreateResult> {
    const siteName = params.siteName.trim();

    if (!siteName) {
      throw new Error('현장 생성 실패: siteName이 필요합니다.');
    }

    if (!params.openDate.trim()) {
      throw new Error('현장 생성 실패: openDate가 필요합니다.');
    }

    if (params.requiredDocumentRules?.length) {
      await upsertRules(params.requiredDocumentRules);
    }

    const tradeKeys = normalizeTradeKeys(params.tradeKeys);
    const { data: siteData, error: siteError } = await sitesSchema()
      .from('site_registry')
      .insert([
        {
          site_name: siteName,
          trade_keys: tradeKeys,
          open_date: params.openDate,
          checklist_version: 0,
        },
      ])
      .select('*')
      .single();

    const site = siteData as SiteRegistryRow | null;

    if (siteError || !site) {
      throw new Error(`현장 생성 실패: ${siteError?.message || '현장을 저장할 수 없습니다.'}`);
    }

    const rebuiltChecklist = await this.rebuildChecklist({ siteId: site.id });

    return {
      site: rebuiltChecklist.site,
      checklistVersion: rebuiltChecklist.checklistVersion,
      generatedChecklistCount: rebuiltChecklist.itemCount,
    };
  },

  async rebuildChecklist(params: SiteChecklistRebuildInput): Promise<SiteChecklistRebuildResult> {
    const siteId = params.siteId.trim();

    if (!siteId) {
      throw new Error('체크리스트 재계산 실패: siteId가 필요합니다.');
    }

    if (params.requiredDocumentRules?.length) {
      await upsertRules(params.requiredDocumentRules);
    }

    const client = getSupabase();
    const sitesClient = sitesSchema(client);
    const { site, error: siteError } = await getSiteById(siteId);

    if (siteError || !site) {
      throw new Error(`체크리스트 재계산 실패: ${siteError?.message || '현장을 찾을 수 없습니다.'}`);
    }

    const nextChecklistVersion = (site.checklist_version || 0) + 1;
    const checklistSeed = await buildChecklistSeed(site);

    const { data: snapshotData, error: snapshotError } = await sitesClient
      .from('site_checklist_snapshots')
      .insert([
        {
          site_id: siteId,
          checklist_version: nextChecklistVersion,
        },
      ])
      .select('*')
      .single();

    const snapshot = snapshotData as SiteChecklistSnapshotRow | null;

    if (snapshotError || !snapshot) {
      throw new Error(`체크리스트 재계산 실패: 스냅샷 생성 중 오류가 발생했습니다. (${snapshotError?.message})`);
    }

    if (checklistSeed.length > 0) {
      const { error: itemsError } = await sitesClient.from('site_checklist_items').insert(
        checklistSeed.map((item) => ({
          site_id: siteId,
          checklist_snapshot_id: snapshot.id,
          checklist_version: nextChecklistVersion,
          document_type_key: item.documentTypeKey,
          document_title: item.documentTitle,
          source_trade_keys: item.sourceTradeKeys,
          status: item.status,
          linked_document_id: item.linkedDocumentId,
        }))
      );

      if (itemsError) {
        throw new Error(`체크리스트 재계산 실패: 항목 저장 중 오류가 발생했습니다. (${itemsError.message})`);
      }
    }

    const { data: updatedSiteData, error: siteUpdateError } = await sitesClient
      .from('site_registry')
      .update({ checklist_version: nextChecklistVersion })
      .eq('id', siteId)
      .select('*')
      .single();

    if (siteUpdateError || !updatedSiteData) {
      throw new Error(
        `체크리스트 재계산 실패: 현장 checklist_version 갱신 중 오류가 발생했습니다. (${siteUpdateError?.message})`
      );
    }

    const requiredDocuments = await this.getChecklist(siteId);

    return {
      site: requiredDocuments.site,
      checklistVersion: requiredDocuments.checklistVersion,
      itemCount: requiredDocuments.requiredDocuments.length,
      requiredDocuments: requiredDocuments.requiredDocuments,
    };
  },

  async getChecklist(siteId: string): Promise<SiteChecklistSummaryDto> {
    const normalizedSiteId = siteId.trim();

    if (!normalizedSiteId) {
      throw new Error('체크리스트 조회 실패: siteId가 필요합니다.');
    }

    const client = getSupabase();
    const sitesClient = sitesSchema(client);
    const { site, error: siteError } = await getSiteById(normalizedSiteId);

    if (siteError || !site) {
      throw new Error(`체크리스트 조회 실패: ${siteError?.message || '현장을 찾을 수 없습니다.'}`);
    }

    const checklistVersion = site.checklist_version || 0;

    if (checklistVersion === 0) {
      return {
        site: toSiteRecordDto(site),
        checklistVersion: 0,
        generatedAt: null,
        requiredDocuments: [],
        missingCount: 0,
        completedCount: 0,
      };
    }

    const [snapshotResponse, itemsResponse] = await Promise.all([
      sitesClient
        .from('site_checklist_snapshots')
        .select('*')
        .eq('site_id', normalizedSiteId)
        .eq('checklist_version', checklistVersion)
        .single(),
      sitesClient
        .from('site_checklist_items')
        .select('*')
        .eq('site_id', normalizedSiteId)
        .eq('checklist_version', checklistVersion)
        .order('document_type_key', { ascending: true }),
    ]);

    const snapshot = snapshotResponse.data as SiteChecklistSnapshotRow | null;
    const items = ((itemsResponse.data || []) as SiteChecklistItemRow[]).map(toChecklistItemDto);

    if (snapshotResponse.error || !snapshot) {
      throw new Error(
        `체크리스트 조회 실패: 스냅샷을 찾을 수 없습니다. (${snapshotResponse.error?.message || 'missing snapshot'})`
      );
    }

    if (itemsResponse.error) {
      throw new Error(`체크리스트 조회 실패: 항목 조회 중 오류가 발생했습니다. (${itemsResponse.error.message})`);
    }

    const missingCount = items.filter((item) => item.status === 'missing').length;
    const completedCount = items.filter((item) => item.status === 'completed').length;

    return {
      site: toSiteRecordDto(site),
      checklistVersion,
      generatedAt: snapshot.generated_at,
      requiredDocuments: items,
      missingCount,
      completedCount,
    };
  },
};
