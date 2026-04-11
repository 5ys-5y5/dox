'use client';

import * as React from 'react';
import { useState } from 'react';
import { SignPad } from '../../components/SignPad';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

/**
 * 전자 서명 기능 통합 테스트 페이지
 */
export default function SignTestPage() {
  const [step, setStep] = useState<'info' | 'auth' | 'sign' | 'result'>('info');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [authenticationId, setAuthenticationId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState('00000000-0000-0000-0000-000000000001'); // 유효한 UUID 형식으로 변경
  const [signerName, setSignerName] = useState('홍길동');
  const [providerGroup, setProviderGroup] = useState<'barocert' | 'mobile_identity'>('barocert');
  const [provider, setProvider] = useState<'toss' | 'kakao' | 'naver' | 'pass' | 'niceid'>('toss');
  const [termsVersion, setTermsVersion] = useState('v1.0');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [authResult, setAuthResult] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<string | null>(null);

  const getDocumentContent = () => `Original Document Content for ${documentId}`;
  const getConsentText = () => `${signerName}님, 위 내용에 동의하시면 서명해주세요.`;
  const getFakeCi = () => `CI-${documentId}`;
  const getFakeDi = () => `DI-${documentId}`;
  const getFakePhone = () => '01012345678';
  const getFakeBirthdate = () => '1990-01-01';

  // 1단계: 서명 요청 생성
  const handleCreateRequest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST',
          documentId,
          documentContent: getDocumentContent(),
          signerInfo: { name: signerName, email: 'test@example.com' },
        }),
      });
      
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.success) {
          setRequestId(data.data.id);
          setStep('auth');
        } else {
          alert('요청 생성 실패: ' + data.message);
        }
      } catch (jsonErr) {
        console.error('API 응답이 JSON이 아닙니다:', text);
        alert('서버 오류 발생 (HTML 응답). 브라우저 콘솔을 확인해 주세요.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAuth = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTH_REQUEST',
          requestId,
          providerGroup,
          provider,
          documentContent: getDocumentContent(),
          consentText: getConsentText(),
          termsVersion,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setAuthenticationId(data.data.authentication.id);
        setAuthResult(data.data);
        setAuthStatus(data.data.authentication.auth_status);
      } else {
        alert('본인확인 요청 실패: ' + data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshAuthStatus = async () => {
    if (!requestId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTH_STATUS',
          requestId,
          authenticationId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setAuthResult(data.data);
        setAuthStatus(data.data.authentication?.auth_status || null);
      } else {
        alert('본인확인 상태 조회 실패: ' + data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateCallback = async () => {
    if (!requestId || !authenticationId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTH_CALLBACK',
          requestId,
          authenticationId,
          documentContent: getDocumentContent(),
          consentText: getConsentText(),
          transactionId: `tx-${Date.now()}`,
          callbackPayload: {
            ok: true,
            providerGroup,
            provider,
            requestId,
            authenticationId,
          },
          signedData: {
            documentId,
            requestId,
            provider,
            approvedAt: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();

      if (data.success) {
        setAuthResult(data.data);
        setAuthStatus(data.data.authentication?.auth_status || data.data.callback?.auth_status || null);
      } else {
        alert('본인확인 callback 처리 실패: ' + data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateVerify = async () => {
    if (!requestId || !authenticationId) return;

    setLoading(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTH_VERIFY',
          requestId,
          authenticationId,
          documentContent: getDocumentContent(),
          consentText: getConsentText(),
          signerName,
          birthdate: getFakeBirthdate(),
          phone: getFakePhone(),
          ci: getFakeCi(),
          di: getFakeDi(),
          transactionId: `verify-${Date.now()}`,
          signedData: {
            documentId,
            requestId,
            provider,
            verifiedAt: new Date().toISOString(),
          },
          verificationPayload: {
            providerGroup,
            provider,
            verified: true,
          },
        }),
      });
      const data = await res.json();

      if (data.success) {
        setAuthResult(data.data);
        setAuthStatus(data.data.authentication?.auth_status || null);
        setStep('sign');
      } else {
        alert('본인확인 검증 실패: ' + data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3단계: 서명 실행 (SignPad 콜백)
  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!requestId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EXECUTE',
          requestId,
          documentContent: getDocumentContent(), // 실제 문서 데이터 대용
          consentText: getConsentText(),
          signatureImagePath: `signatures/${requestId}.png`, // 실제 스토리지 업로드 로직은 서비스 레이어에서 처리
          // signerId: 'user-uuid-placeholder', // 제거: UUID 타입 오류 방지
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        setStep('result');
      } else {
        alert('서명 저장 실패: ' + data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 4단계: 무결성 검증 시뮬레이션
  const handleVerify = async () => {
    if (!requestId) return;
    try {
      const res = await fetch('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY',
          requestId,
          currentDocumentContent: getDocumentContent(), // 동일한 데이터 전달
        }),
      });
      const data = await res.json();
      alert(data.data.isValid ? '✅ 무결성 확인: 문서가 변조되지 않았습니다.' : '❌ 경고: 위변조가 의심됩니다.');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 space-y-8 max-w-2xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">전자 서명 시스템 테스트</h1>
        <p className="text-muted-foreground">서명 요청부터 검증까지 전 과정을 테스트합니다.</p>
      </div>

      <div className="flex justify-center gap-4 mb-8">
        <Badge variant={step === 'info' ? 'default' : 'outline'}>1. 정보 입력</Badge>
        <Badge variant={step === 'auth' ? 'default' : 'outline'}>2. 본인확인</Badge>
        <Badge variant={step === 'sign' ? 'default' : 'outline'}>3. 서명 입력</Badge>
        <Badge variant={step === 'result' ? 'default' : 'outline'}>4. 결과 확인</Badge>
      </div>

      {step === 'info' && (
        <Card>
          <CardHeader>
            <CardTitle>서명 요청 생성</CardTitle>
            <CardDescription>서명할 문서와 서명자 정보를 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">문서 식별자 (Document ID)</label>
              <Input value={documentId} onChange={(e) => setDocumentId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">서명자 이름</label>
              <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleCreateRequest} disabled={loading}>
              {loading ? '생성 중...' : '서명 요청 시작'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 'auth' && (
        <Card>
          <CardHeader>
            <CardTitle>본인확인 요청</CardTitle>
            <CardDescription>BaroCert 또는 PASS/휴대폰 본인확인 흐름을 생성하고 인증 완료를 반영합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider Group</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={providerGroup}
                onChange={(e) => {
                  const nextGroup = e.target.value as 'barocert' | 'mobile_identity';
                  setProviderGroup(nextGroup);
                  setProvider(nextGroup === 'barocert' ? 'toss' : 'pass');
                }}
              >
                <option value="barocert">barocert</option>
                <option value="mobile_identity">mobile_identity</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={provider}
                onChange={(e) =>
                  setProvider(e.target.value as 'toss' | 'kakao' | 'naver' | 'pass' | 'niceid')
                }
              >
                {providerGroup === 'barocert' ? (
                  <>
                    <option value="toss">toss</option>
                    <option value="kakao">kakao</option>
                    <option value="naver">naver</option>
                  </>
                ) : (
                  <>
                    <option value="pass">pass</option>
                    <option value="niceid">niceid</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Terms Version</label>
              <Input value={termsVersion} onChange={(e) => setTermsVersion(e.target.value)} />
            </div>
            <div className="rounded-lg border bg-muted/40 p-4 text-xs font-mono space-y-2 break-all">
              <div>Request ID: {requestId}</div>
              <div>Authentication ID: {authenticationId || '-'}</div>
              <div>Auth Status: {authStatus || '-'}</div>
            </div>
            {authResult && (
              <pre className="max-h-56 overflow-auto rounded-lg bg-muted p-4 text-xs">
                {JSON.stringify(authResult, null, 2)}
              </pre>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={handleRequestAuth} disabled={loading}>
              {loading ? '처리 중...' : '본인확인 요청 생성'}
            </Button>
            <Button variant="outline" className="w-full" onClick={handleRefreshAuthStatus} disabled={loading || !authenticationId}>
              상태 새로고침
            </Button>
            <Button variant="outline" className="w-full" onClick={handleSimulateCallback} disabled={loading || !authenticationId}>
              Callback 수신 시뮬레이션
            </Button>
            <Button className="w-full" onClick={handleSimulateVerify} disabled={loading || !authenticationId}>
              본인확인 검증 완료 처리
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 'sign' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SignPad 
            onSave={handleSaveSignature} 
            onCancel={() => setStep('auth')} 
            title="법적 서명 입력"
            description={getConsentText()}
          />
          {loading && <p className="text-center mt-4 text-sm animate-pulse">서명을 안전하게 저장 중입니다...</p>}
        </div>
      )}

      {step === 'result' && result && (
        <Card className="animate-in zoom-in-95 duration-500">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-green-600 text-2xl font-bold">✓</span>
            </div>
            <CardTitle>서명 완료</CardTitle>
            <CardDescription>전자 서명이 성공적으로 생성되고 무결성이 기록되었습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg text-xs font-mono break-all space-y-2">
              <div className="flex justify-between items-center"><span className="font-bold mr-2">Request ID:</span> <span>{requestId}</span></div>
              <div className="flex flex-col gap-1"><span className="font-bold mr-2">Hash (SHA-256):</span> <span className="text-muted-foreground">{result.documentHash}</span></div>
              <div className="flex justify-between items-center"><span className="font-bold mr-2">Status:</span> <Badge variant="default" className="bg-green-600">SIGNED</Badge></div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" onClick={handleVerify}>
              무결성 실시간 검증
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => {
              setStep('info');
              setRequestId(null);
              setAuthenticationId(null);
              setAuthResult(null);
              setAuthStatus(null);
              setResult(null);
            }}>
              새로운 테스트 시작
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
