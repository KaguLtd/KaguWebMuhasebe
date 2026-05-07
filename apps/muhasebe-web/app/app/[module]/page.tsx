import { KaguWorkspace } from "@/components/kagu/KaguWorkspace";

type ModulePageProps = {
  params: Promise<{ module: string }>;
};

export default async function ModulePage({ params }: ModulePageProps) {
  const { module } = await params;

  return <KaguWorkspace initialMenu={module} />;
}
