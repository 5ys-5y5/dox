import { NextResponse } from 'next/server';
import { MemberAccessService } from '../../../../services/memberAccessService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId') || '';
    const members = await MemberAccessService.listSiteMembers(siteId);

    return NextResponse.json({ success: true, data: members });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Member Access Site Members API GET Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invitedMember = await MemberAccessService.inviteSiteMember(body);

    return NextResponse.json({ success: true, data: invitedMember });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Member Access Site Members API POST Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get('membershipId') || '';
    const deletedMembership = await MemberAccessService.removeSiteMembership(membershipId);

    return NextResponse.json({ success: true, data: deletedMembership });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

    console.error('Member Access Site Members API DELETE Error:', error);

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
