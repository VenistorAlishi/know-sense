import { redirect } from "next/navigation";

export default async function MeetingIdRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/sources/${id}`);
}
