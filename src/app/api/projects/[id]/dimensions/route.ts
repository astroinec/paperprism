import { saveDimensions, type DimensionInput } from "@/lib/server/repo/projects";
import { fail, handle, ok, type Ctx } from "@/lib/server/http";

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const b = (await req.json()) as { dimensions?: DimensionInput[] };
  if (!Array.isArray(b.dimensions)) return fail("dimensions required");
  const dims = b.dimensions
    .filter((d) => d.name?.trim())
    .map((d) => ({ ...d, name: d.name.trim(), description: d.description?.trim() ?? "", type: d.type ?? "text" }));
  return ok(saveDimensions(id, dims));
});
