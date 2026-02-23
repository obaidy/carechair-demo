import {getMessages} from 'next-intl/server';
import {tx} from '@/lib/messages';
import {buildMetadata} from '@/lib/seo';
import HomeLanding from '@/components/HomeLanding';

type Props = {params: Promise<{locale: string}>};

export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  const messages = await getMessages({locale});

  return buildMetadata({
    title: tx(messages, 'home.metaTitle', 'CareChair | Book salons online'),
    description: tx(messages, 'home.metaDescription', 'Discover salons, compare services, and book in minutes.'),
    pathname: '/'
  });
}

export default async function HomePage({params}: Props) {
  await params;
  return <HomeLanding />;
}
