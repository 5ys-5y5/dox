import Link from 'next/link';
import { Badge } from '../components/ui/Badge';

const pageGroups = [
  {
    title: '전자 서명',
    description: '무결성 검증과 본인확인 흐름을 확인하는 페이지입니다.',
    pages: [
      {
        href: '/test-sign',
        title: '서명 테스트',
        summary: '서명 요청, 본인확인 흐름, 서명 저장을 확인합니다.',
        status: '진행중',
      },
    ],
  },
  {
    title: '서류 관리',
    description: '문서 저장, 현장 체크리스트, 템플릿, 사진 라벨링, 일괄 입력을 확인합니다.',
    pages: [
      {
        href: '/documents',
        title: '서류 클라우드 관리',
        summary: '문서 생성, 상세 조회, 버전 추가를 다룹니다.',
        status: '구현중',
      },
      {
        href: '/sites',
        title: '현장별 필요 서류 누락 방지',
        summary: '현장 생성, 규칙 저장, 체크리스트 계산을 다룹니다.',
        status: '구현중',
      },
      {
        href: '/templates',
        title: '템플릿 등록',
        summary: '템플릿 메타데이터, 필드, 라벨, 서명 영역을 관리합니다.',
        status: '구현중',
      },
      {
        href: '/templates/extract',
        title: '템플릿 추출',
        summary: '입력값이 있는 문서에서 draft HTML과 후보 필드를 만듭니다.',
        status: '구현중',
      },
      {
        href: '/templates/edit',
        title: '템플릿 편집',
        summary: '저장된 템플릿의 div 박스를 다중 선택해 크기와 스타일을 일괄 조정합니다.',
        status: '구현중',
      },
      {
        href: '/photos',
        title: '사진 라벨링 보관',
        summary: '사진 메타데이터, 라벨 저장, 누락 경고를 다룹니다.',
        status: '구현중',
      },
      {
        href: '/bulk-ops',
        title: '일괄 정보 입력',
        summary: '같은 라벨 키의 일반 값을 미리보기 후 일괄 반영합니다.',
        status: '구현중',
      },
      {
        href: '/request-links',
        title: '일괄 요청',
        summary: '허용 라벨만 수정 가능한 제한 입력 링크를 발급하고 검증합니다.',
        status: '구현중',
      },
      {
        href: '/exports',
        title: '변환 저장',
        summary: 'export job과 출력본 메타데이터를 관리합니다.',
        status: '구현중',
      },
    ],
  },
  {
    title: '독립 알림 서비스',
    description: '문자 및 이메일 발송 도메인을 다른 기능과 분리해 운영하는 화면입니다.',
    pages: [
      {
        href: '/messaging',
        title: '문자 발송 운영',
        summary: '발신번호/수신번호 등록, 기본 설정, 최근 문자 발송 이력과 상태 동기화를 다룹니다.',
        status: '구현중',
      },
    ],
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-10 md:px-8">
        <header className="space-y-4 border-b border-slate-200 pb-8">
          <Badge variant="slate">APP-HOME-01</Badge>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-slate-950">구현 기능 진입점</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              현재 구현된 사용자용 페이지를 한 곳에서 바로 열 수 있도록 정리한 홈 화면입니다. 각 기능은 독립 서비스
              단위로 나뉘어 있고, 이 화면은 그 진입점만 제공합니다.
            </p>
          </div>
        </header>

        <div className="space-y-8">
          {pageGroups.map((group) => (
            <div key={group.title} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-slate-950">{group.title}</h2>
                <p className="text-sm text-slate-600">{group.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.pages.map((page) => (
                  <Link
                    key={page.href}
                    href={page.href}
                    className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:bg-slate-50"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="green">{page.status}</Badge>
                        <span className="text-xs text-slate-500">{page.href}</span>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-slate-950">{page.title}</h3>
                        <p className="text-sm text-slate-600">{page.summary}</p>
                      </div>
                    </div>
                    <div className="pt-4 text-sm font-medium text-slate-900">페이지 열기</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
