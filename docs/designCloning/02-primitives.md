# Primitives

원본 기준 파일:
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Textarea.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Divider.tsx`
- `src/components/ui/IconChip.tsx`
- `src/components/ui/Metric.tsx`
- `src/components/ui/Skeleton.tsx`

## 컴포넌트 표면
| 파일 | export | 핵심 계약 | 직접 사용 규칙 |
| --- | --- | --- | --- |
| `Button.tsx` | `Button`, `buttonVariants`, `ButtonProps` | variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`; sizes: `default`, `sm`, `lg`, `icon`; `asChild` 지원 | 새 버튼을 만들지 말고 variant/size로 먼저 해결 |
| `Input.tsx` | `Input`, `InputProps` | `React.InputHTMLAttributes<HTMLInputElement>` | 검색창/폼 입력은 우선 이 컴포넌트 사용 |
| `Textarea.tsx` | `Textarea`, `TextareaProps` | `min-h-[120px]`, `border-input`, `focus-visible:ring-1` | 멀티라인 입력은 `textarea` 직접 작성 대신 이 컴포넌트 사용 |
| `Card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | `rounded-xl border bg-card` 기반 | 패널은 새 wrapper보다 Card family를 먼저 검토 |
| `Badge.tsx` | `Badge`, `badgeVariants`, `BadgeProps` | variants: `default`, `green`, `amber`, `slate`, `red`, `outline` | 상태 라벨은 badge variant로 해결 |
| `Divider.tsx` | `Divider` | 중앙 label optional, 양옆 선 분할 | 구분선은 `hr`보다 이 컴포넌트 우선 |
| `IconChip.tsx` | `IconChip` | 아이콘 + 라벨, `rounded-lg border bg-slate-50 text-xs` | 작은 상태 chip 용도 |
| `Metric.tsx` | `Metric` | Card 기반 KPI 카드, `label` / `value` / `sub` | 숫자 카드용 재사용 우선 |
| `Skeleton.tsx` | `Skeleton` | `animate-pulse rounded-md bg-slate-200` | 로딩 placeholder 일관성 유지 |

## 우선 적용 규칙
- 버튼/입력/텍스트영역을 feature 폴더에서 다시 만들지 않는다.
- `Button`의 variant 추가가 필요하면 `Button.tsx`에서 처리한다.
- 카드형 패널은 `Card` 또는 `PanelCard` 중 더 낮은 레이어부터 선택한다.
- 상태 색상은 badge variant나 slate/emerald/amber/rose 계열을 재사용한다.

## 금지
- 페이지 내부에 `const MyButton = ...` 식의 중복 primitive 생성
- 원본 focus ring을 제거하고 페이지별 임의 스타일 적용
- `Input`과 `Textarea`를 원시 태그로 다시 구현
