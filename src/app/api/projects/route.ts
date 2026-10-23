import { createProject, listProjects } from "@/lib/server/repo/projects";
import { fail, handle, langOf, ok } from "@/lib/server/http";

export const GET = handle(async () => ok(listProjects()));

export const POST = handle(async (req: Request) => {
  const b = (await req.json()) as { name?: string; question?: string; template?: string; paperIds?: string[]; lang?: string };
  if (!b.name?.trim()) return fail("项目名称不能为空");
  return ok(
    createProject({ name: b.name.trim(), question: b.question?.trim(), template: b.template ?? "general", paperIds: b.paperIds ?? [], lang: langOf(b.lang) }),
    201,
  );
});
