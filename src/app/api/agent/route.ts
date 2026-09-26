/**
 * Garfix ERP — Agent API
 * GET: سجل تشغيل الوكلاء | POST: تشغيل وكيل
 */
import { db } from "@/lib/db";
import { jsonErr } from "@/lib/erp";
import { requireUser } from "@/lib/auth";
import { runAgent, AGENTS, type AgentType } from "@/lib/agent/engine";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const runs = await db.agentRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Response.json({
      agents: Object.entries(AGENTS).map(([key, a]) => ({
        key,
        name: a.name,
        description: a.description,
      })),
      runs: runs.map((r) => ({
        id: r.id,
        agent: r.agent,
        agentName: AGENTS[r.agent as AgentType]?.name || r.agent,
        query: r.query,
        response: r.status === "running" ? null : r.response,
        status: r.status,
        duration: r.duration,
        createdAt: r.createdAt,
      })),
    });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    const agent = (body.agent || "general") as AgentType;
    const query = body.query?.trim();
    if (!query) return jsonErr("اكتب سؤالك أولاً");
    if (!AGENTS[agent]) return jsonErr("وكيل غير معروف");

    const { response, duration } = await runAgent(agent, query, auth.user.email);
    return Response.json({ response, duration, agent });
  } catch (e) {
    return jsonErr(`تعذر تشغيل الوكيل: ${(e as Error).message}`, 500);
  }
}
