import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore, uid, type Role, type User } from "../lib/store";
import { DashboardShell } from "../components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Users, Activity, Mail, Settings, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  return (
    <DashboardShell
      role="admin"
      title="Admin Control Room"
      nav={[
        { label: "Users", to: "/admin", icon: <Users className="h-4 w-4" /> },
        { label: "AI Activity", to: "/admin", icon: <Activity className="h-4 w-4" /> },
        { label: "Email Settings", to: "/admin", icon: <Mail className="h-4 w-4" /> },
        { label: "System Stats", to: "/admin", icon: <Settings className="h-4 w-4" /> },
      ]}
    >
      <Tabs defaultValue="stats">
        <TabsList className="mb-4">
          <TabsTrigger value="stats">System Stats</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="logs">AI Activity</TabsTrigger>
          <TabsTrigger value="smtp">Email (SMTP)</TabsTrigger>
        </TabsList>
        <TabsContent value="stats"><Stats /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="logs"><Logs /></TabsContent>
        <TabsContent value="smtp"><Smtp /></TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

function Stats() {
  const { state } = useStore();
  const aiCount = state.logs.filter((l) => l.type === "ai").length;
  const total = state.invoices.reduce((s, i) => s + i.total, 0);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Workshops" value={state.users.filter((u) => u.role === "workshop").length} />
        <Stat label="Suppliers" value={state.users.filter((u) => u.role === "supplier").length} />
        <Stat label="Quotations" value={state.quotations.length} />
        <Stat label="AI Actions" value={aiCount} />
        <Stat label="Invoices" value={state.invoices.length} />
        <Stat label="Purchase Orders" value={state.purchaseOrders.length} />
        <Stat label="Invoiced (NZD)" value={`$${total.toLocaleString()}`} />
        <Stat label="Out-of-stock parts" value={Object.values(state.stock).filter((s) => s.qty === 0).length} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-slate-500">{label}</div>
        <div className="text-2xl font-bold mt-2 text-slate-900">{value}</div>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const { state, setState, addLog } = useStore();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("workshop");

  function addUser() {
    if (!email || !name) {
      toast.error("Enter name and email");
      return;
    }
    const u: User = { id: uid("u"), email, name, role };
    setState((s) => ({ ...s, users: [...s.users, u] }));
    addLog(`Admin created ${role} account ${email}`, "user");
    toast.success(`Created ${role}: ${email}`);
    setEmail(""); setName("");
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
          <CardDescription>Add a workshop, supplier, or admin account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={addUser}>Create</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{u.role}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Logs() {
  const { state } = useStore();
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Decision History</CardTitle>
        <CardDescription>Every AI action is logged</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {state.logs.map((l) => (
            <li key={l.id} className="flex items-start gap-2 border-b border-slate-100 pb-2 last:border-0">
              {l.type === "ai" ? (
                <Sparkles className="h-3.5 w-3.5 text-blue-600 mt-0.5" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-slate-400 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="text-slate-800">{l.message}</div>
                <div className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()}</div>
              </div>
              <Badge variant="outline" className="text-xs capitalize">{l.type}</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Smtp() {
  const { state, setState } = useStore();
  const [host, setHost] = useState(state.smtp.host);
  const [port, setPort] = useState(state.smtp.port);
  const [from, setFrom] = useState(state.smtp.from);

  function save() {
    setState((s) => ({ ...s, smtp: { host, port: Number(port), from } }));
    toast.success("SMTP settings saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>SMTP Email Settings</CardTitle>
        <CardDescription>Used for automated invoice and PO emails</CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>SMTP Host</Label>
          <Input value={host} onChange={(e) => setHost(e.target.value)} />
        </div>
        <div>
          <Label>Port</Label>
          <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        </div>
        <div>
          <Label>From Address</Label>
          <Input value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <Button onClick={save}>Save Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
}
