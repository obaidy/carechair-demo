import {redirect} from 'next/navigation';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RootJoinPage({searchParams}: Props) {
  const query = await searchParams;
  const token = String(query.token || '').trim();
  const code = String(query.code || '').trim();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (code) params.set('code', code);
  const suffix = params.toString();
  redirect(`/en/join${suffix ? `?${suffix}` : ''}`);
}
