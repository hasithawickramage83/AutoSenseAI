import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore, type Role, ApiError } from "../lib/store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Sparkles, Wrench, Factory, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const { state, login, register, addLog } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("workshop");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.authReady && state.user) {
      navigate({ to: `/${state.user.role}` });
    }
  }, [state.authReady, state.user, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter email and password");
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      addLog(`${user.email} signed in as ${user.role}`, "user");
      toast.success(`Welcome back, ${user.name}`);
      navigate({ to: `/${user.role}` });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Sign in failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Enter name, email, and password");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const user = await register(name, email, password, role);
      addLog(`New ${role} account registered: ${user.email}`, "user");
      toast.success("Account created — sign in with your credentials");
      setTab("signin");
      setEmail(user.email);
      setPassword("");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!state.authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
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
            <CardTitle className="text-2xl">AutoSense</CardTitle>
            <CardDescription>Sign in or create an account</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "register")}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>
                  <p className="text-xs text-slate-500">
                    Your role is determined by your account after sign in.
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Auckland Auto Repairs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(v) => setRole(v as Role)}
                      className="grid grid-cols-3 gap-2"
                    >
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
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
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
