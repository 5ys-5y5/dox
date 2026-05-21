'use client';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/utils';

type MemberAccessVerificationCardProps = {
  title?: string;
  description?: string;
  phoneNumber: string;
  accessCode: string;
  submitting: boolean;
  className?: string;
  submitLabel?: string;
  onPhoneNumberChange: (value: string) => void;
  onAccessCodeChange: (value: string) => void;
  onSubmit: () => void;
};

export function MemberAccessVerificationCard({
  title = '번호 인증',
  description = '초대받은 휴대폰 번호와 받은 인증번호를 입력하면 접근 세션이 생성됩니다.',
  phoneNumber,
  accessCode,
  submitting,
  className,
  submitLabel = '서비스 접근 인증',
  onPhoneNumberChange,
  onAccessCodeChange,
  onSubmit,
}: MemberAccessVerificationCardProps) {
  return (
    <Card className={cn('min-w-0 border-slate-200', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="member-access-phone-number" className="text-sm font-medium text-slate-700">
            휴대폰 번호
          </label>
          <Input
            id="member-access-phone-number"
            name="memberAccessPhoneNumber"
            value={phoneNumber}
            onChange={(event) => onPhoneNumberChange(event.target.value)}
            placeholder="예: 01012345678"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="member-access-code" className="text-sm font-medium text-slate-700">
            인증번호
          </label>
          <Input
            id="member-access-code"
            name="memberAccessCode"
            value={accessCode}
            onChange={(event) => onAccessCodeChange(event.target.value)}
            placeholder="6자리 인증번호"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </div>
        <div className="sm:col-span-2">
          <Button className="w-full sm:w-auto" onClick={onSubmit} disabled={submitting}>
            {submitting ? '인증 중...' : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
