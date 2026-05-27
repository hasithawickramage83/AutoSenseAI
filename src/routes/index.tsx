import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore, type Role } from "../lib/store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Sparkles, Wrench, Factory, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { state, login, addLog } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("workshop@autosense.nz");
  const [password, setPassword] = useState("demo1234");
  const [role, setRole] = useState<Role>("workshop");
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    if (state.user) {
      navigate({ to: `/${state.user.role}` });
    }
  }, [state.user, navigate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    const user = login(email, role);
    if (!user) return;
    const label =
      role === "workshop" ? "Workshop User Detected" : role === "supplier" ? "Supplier User Detected" : "Admin User Detected";
    setDetected(label);
    addLog(`${user.email} signed in as ${role}`, "user");
    toast.success(label);
    setTimeout(() => navigate({ to: `/${role}` }), 600);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl w-full items-center">
        <div className="hidden md:flex flex-col gap-6 pr-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Sparkles className="h-6 w-6" />
            <span className="font-semibold tracking-tight">AutoSense AI</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            AI-powered automobile repair, end-to-end.
          </h1>
          <p className="text-slate-600 leading-relaxed">
            Workshops upload damage, AI generates the quote, suppliers process inventory,
            and invoices or purchase orders are dispatched automatically. Built for
            New Zealand workshops.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-2">
            <Feature icon={<Wrench className="h-4 w-4" />} title="Workshops" sub="Upload & quote" />
            <Feature icon={<Factory className="h-4 w-4" />} title="Suppliers" sub="Auto-invoice & PO" />
            <Feature icon={<ShieldCheck className="h-4 w-4" />} title="Admin" sub="Control room" />
          </div>
        </div>

        <Card className="shadow-xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Role-based access for the AutoSense platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <RadioGroup value={role} onValueChange={(v) => setRole(v as Role)} className="grid grid-cols-3 gap-2">
                  {(["workshop", "supplier", "admin"] as Role[]).map((r) => (
                    <label
                      key={r}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm capitalize ${
                        role === r ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200"
                      }`}
                    >
                      <RadioGroupItem value={r} className="sr-only" />
                      {r}
                    </label>
                  ))}
                </RadioGroup>
              </div>
              {detected && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  {detected} — redirecting…
                </div>
              )}
              <Button type="submit" className="w-full">Sign in</Button>
              <div className="text-xs text-slate-500 leading-relaxed">
                Demo accounts: <code>workshop@autosense.nz</code>,{" "}
                <code>supplier@autosense.nz</code>, <code>admin@autosense.nz</code> (any password).
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Feature({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-blue-600">{icon}</div>
      <div className="font-medium text-sm text-slate-900 mt-1">{title}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
