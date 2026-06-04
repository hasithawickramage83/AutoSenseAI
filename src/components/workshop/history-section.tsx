import { useState } from "react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import {
  Sparkles,
  CheckCircle2,
  Upload,
  FileText,
  Receipt,
  CreditCard,
  Wrench,
  ChevronDown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const activityMeta: Record<
  string,
  { icon: typeof Sparkles; color: string; bg: string; label: string }
> = {
  ai: { icon: Sparkles, color: "text-orange-600", bg: "bg-orange-100", label: "AI activity" },
  user: { icon: User, color: "text-blue-600", bg: "bg-blue-100", label: "User action" },
  system: { icon: CheckCircle2, color: "text-slate-600", bg: "bg-slate-100", label: "System" },
};

function inferActivityType(message: string): keyof typeof activityMeta | "upload" | "quotation" | "invoice" | "payment" | "job" {
  const m = message.toLowerCase();
  if (m.includes("upload") || m.includes("damage")) return "upload";
  if (m.includes("quotation") && m.includes("approv")) return "quotation";
  if (m.includes("quotation")) return "quotation";
  if (m.includes("invoice")) return "invoice";
  if (m.includes("payment")) return "payment";
  if (m.includes("complet")) return "job";
  return "ai";
}

const extendedMeta: Record<string, { icon: typeof Sparkles; color: string; bg: string }> = {
  upload: { icon: Upload, color: "text-[var(--workshop-primary)]", bg: "bg-blue-100" },
  quotation: { icon: FileText, color: "text-emerald-600", bg: "bg-emerald-100" },
  invoice: { icon: Receipt, color: "text-indigo-600", bg: "bg-indigo-100" },
  payment: { icon: CreditCard, color: "text-green-600", bg: "bg-green-100" },
  job: { icon: Wrench, color: "text-slate-600", bg: "bg-slate-100" },
};

export function HistorySection() {
  const { state } = useStore();
  const logs = [...state.logs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="animate-in fade-in duration-500">
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Activity timeline</CardTitle>
          <CardDescription>Chronological record of uploads, quotations, invoices, and system events</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <div className="relative mx-auto max-w-3xl">
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[var(--workshop-primary)]/30 via-slate-200 to-transparent" />
              <ul className="space-y-0">
                {logs.map((log, index) => {
                  const inferred = inferActivityType(log.message);
                  const meta =
                    extendedMeta[inferred] ??
                    activityMeta[log.type] ??
                    activityMeta.system;
                  const Icon = meta.icon;
                  const isOpen = expanded[log.id] ?? false;

                  return (
                    <li key={log.id} className="relative pl-12 pb-8 last:pb-0">
                      <div
                        className={cn(
                          "absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-md",
                          meta.bg,
                        )}
                      >
                        <Icon className={cn("h-4 w-4", meta.color)} />
                      </div>
                      <Collapsible
                        open={isOpen}
                        onOpenChange={(open) => setExpanded((e) => ({ ...e, [log.id]: open }))}
                      >
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--workshop-primary)]/20">
                          <CollapsibleTrigger className="flex w-full items-start justify-between gap-2 text-left">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900">{log.message}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {format(log.createdAt, "EEEE, dd MMM yyyy · HH:mm")}
                              </p>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                                isOpen && "rotate-180",
                              )}
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600 space-y-1">
                              <p>
                                <span className="font-medium text-slate-700">Type:</span>{" "}
                                {activityMeta[log.type]?.label ?? log.type}
                              </p>
                              <p>
                                <span className="font-medium text-slate-700">Entry ID:</span> {log.id}
                              </p>
                              <p>
                                <span className="font-medium text-slate-700">Position:</span> {index + 1} of {logs.length}
                              </p>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
