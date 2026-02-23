type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export default async function PublicLayout({children, params}: Props) {
  await params;
  return <>{children}</>;
}
