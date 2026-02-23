import {NextResponse} from 'next/server';
import {clearAuthSession} from '@/lib/auth/server';

export async function GET(request: Request) {
  await clearAuthSession();

  const url = new URL(request.url);
  const next = String(url.searchParams.get('next') || '/en/login');
  const target = next.startsWith('/') ? next : '/en/login';
  return NextResponse.redirect(new URL(target, request.url));
}
