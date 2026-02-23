import MainNav from '@/components/MainNav';

export default function AuthLayout({children}: {children: React.ReactNode}) {
  return (
    <>
      <MainNav />
      <main className="site-main auth-main">{children}</main>
    </>
  );
}
