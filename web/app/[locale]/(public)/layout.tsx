import MainNav from '@/components/MainNav';
import PublicFooter from '@/components/PublicFooter';

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function PublicLayout({children, params}: Props) {
  await params;

  return (
    <>
      <MainNav />
      <main className="site-main">{children}</main>
      <PublicFooter />
    </>
  );
}
