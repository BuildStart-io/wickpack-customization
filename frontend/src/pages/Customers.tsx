import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  MessageSquare,
  Mail,
  Phone,
  ExternalLink,
  RefreshCw,
  Eye,
  Filter,
  UserCheck,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  UserX
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerRecord {
  id: string;
  phone_number: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  current_stage: string;
  received_sets: string[];
  receipt_url: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  last_message?: string | null;
  last_message_at?: string | null;
  push_name?: string | null;
}

const STAGE_CONFIG: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  set1: {
    label: "Set 1 (Welcome)",
    dotColor: "bg-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  set2: {
    label: "Set 2 (Discounts)",
    dotColor: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  set3: {
    label: "Set 3 (Payment)",
    dotColor: "bg-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  pending_verification: {
    label: "Slip Sent",
    dotColor: "bg-amber-500 animate-pulse",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  receipt_pending: {
    label: "Slip Sent",
    dotColor: "bg-amber-500 animate-pulse",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  enrolled: {
    label: "Enrolled",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold",
  },
  completed: {
    label: "Enrolled",
    dotColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold",
  },
  pay_later: {
    label: "Pay Later",
    dotColor: "bg-orange-500",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  },
};

function formatStageBadge(stage: string) {
  const match = STAGE_CONFIG[stage] || {
    label: stage.startsWith("set") ? `Set ${stage.replace("set", "")}` : stage,
    dotColor: "bg-muted-foreground",
    badgeClass: "bg-muted text-foreground border-border",
  };
  return match;
}

export default function Customers() {
  const { user } = useAuth();
  const { effectiveUserId } = useStaffAccess();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({ title: `Copied ${label}`, description: text });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchCustomers = async () => {
    const targetUserId = effectiveUserId || user?.id;
    if (!targetUserId) return;

    setLoading(true);
    try {
      // 1. Fetch customer stages
      const { data: stagesData, error: stagesError } = await supabase
        .from("customer_stages")
        .select("*")
        .eq("user_id", targetUserId)
        .order("updated_at", { ascending: false });

      if (stagesError) throw stagesError;

      // 2. Fetch conversations to cross-reference pushNames & recent messages
      const { data: convsData } = await supabase
        .from("conversations")
        .select("phone_number, message, direction, metadata, created_at")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false })
        .limit(1000);

      const convMap: Record<string, { lastMsg: string; lastTime: string; pushName?: string }> = {};
      (convsData || []).forEach((c) => {
        if (!convMap[c.phone_number]) {
          const pushName = c.metadata?.senderName || c.metadata?.raw?.data?.pushName;
          convMap[c.phone_number] = {
            lastMsg: c.message,
            lastTime: c.created_at,
            pushName: pushName || undefined,
          };
        }
      });

      // Filter strictly: only customers who submitted a payment slip AND gave contact info
      const slipCustomers: CustomerRecord[] = (stagesData || [])
        .filter((s: any) => {
          const hasSlipOrVerification =
            !!s.receipt_url ||
            s.current_stage === "pending_verification" ||
            s.current_stage === "receipt_pending" ||
            s.current_stage === "enrolled" ||
            s.current_stage === "completed";
          const hasContactInfo = !!s.customer_email || !!s.customer_name;
          return hasSlipOrVerification && hasContactInfo;
        })
        .map((s: any) => {
          const conv = convMap[s.phone_number];
          return {
            id: s.id,
            phone_number: s.phone_number,
            customer_name: s.customer_name || conv?.pushName || "Student",
            customer_email: s.customer_email || null,
            customer_phone: s.customer_phone || s.phone_number,
            current_stage: s.current_stage || "pending_verification",
            received_sets: Array.isArray(s.received_sets) ? s.received_sets : [],
            receipt_url: s.receipt_url || null,
            metadata: s.metadata || {},
            created_at: s.created_at,
            updated_at: s.updated_at,
            last_message: conv?.lastMsg || null,
            last_message_at: conv?.lastTime || s.updated_at,
            push_name: conv?.pushName || null,
          };
        });

      setCustomers(slipCustomers);
    } catch (err) {
      console.error("Error loading customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [effectiveUserId, user?.id]);

  // Manually enroll customer
  const handleEnrollCustomer = async (customer: CustomerRecord) => {
    const targetUserId = effectiveUserId || user?.id;
    if (!targetUserId) return;

    setEnrollingId(customer.id);
    try {
      const { error } = await supabase
        .from("customer_stages")
        .update({
          current_stage: "enrolled",
          updated_at: new Date().toISOString(),
          metadata: {
            ...customer.metadata,
            enrolled_at: new Date().toISOString(),
            enrolled_by: user?.email || "admin",
          }
        })
        .eq("phone_number", customer.phone_number)
        .eq("user_id", targetUserId);

      if (error) throw error;

      await supabase
        .from("orders")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("whatsapp_phone", customer.phone_number)
        .eq("user_id", targetUserId);

      setCustomers((prev) =>
        prev.map((c) => (c.phone_number === customer.phone_number ? { ...c, current_stage: "enrolled" } : c))
      );

      if (selectedCustomer?.phone_number === customer.phone_number) {
        setSelectedCustomer((prev) => prev ? { ...prev, current_stage: "enrolled" } : null);
      }

      toast({
        title: "Student Enrolled Successfully",
        description: `${customer.customer_name || customer.phone_number} is now marked as Enrolled.`,
      });
    } catch (err: any) {
      console.error("Enrollment failed:", err);
      toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
    } finally {
      setEnrollingId(null);
    }
  };

  // Manually unenroll customer
  const handleUnenrollCustomer = async (customer: CustomerRecord) => {
    const targetUserId = effectiveUserId || user?.id;
    if (!targetUserId) return;

    setEnrollingId(customer.id);
    try {
      const { error } = await supabase
        .from("customer_stages")
        .update({
          current_stage: "pending_verification",
          updated_at: new Date().toISOString(),
          metadata: {
            ...customer.metadata,
            unenrolled_at: new Date().toISOString(),
            unenrolled_by: user?.email || "admin",
          }
        })
        .eq("phone_number", customer.phone_number)
        .eq("user_id", targetUserId);

      if (error) throw error;

      await supabase
        .from("orders")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("whatsapp_phone", customer.phone_number)
        .eq("user_id", targetUserId);

      setCustomers((prev) =>
        prev.map((c) => (c.phone_number === customer.phone_number ? { ...c, current_stage: "pending_verification" } : c))
      );

      if (selectedCustomer?.phone_number === customer.phone_number) {
        setSelectedCustomer((prev) => prev ? { ...prev, current_stage: "pending_verification" } : null);
      }

      toast({
        title: "Customer Unenrolled",
        description: `${customer.customer_name || customer.phone_number} is now set back to Slip Sent.`,
      });
    } catch (err: any) {
      console.error("Unenrollment failed:", err);
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setEnrollingId(null);
    }
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchSearch =
        search === "" ||
        (c.customer_name && c.customer_name.toLowerCase().includes(search.toLowerCase())) ||
        (c.customer_phone && c.customer_phone.includes(search)) ||
        (c.customer_email && c.customer_email.toLowerCase().includes(search.toLowerCase())) ||
        c.phone_number.includes(search);

      const matchStage =
        stageFilter === "all" ||
        c.current_stage === stageFilter ||
        (stageFilter === "pending_verification" && (c.current_stage === "pending_verification" || c.current_stage === "receipt_pending")) ||
        (stageFilter === "enrolled" && (c.current_stage === "enrolled" || c.current_stage === "completed")) ||
        (stageFilter === "pay_later" && c.current_stage === "pay_later");

      return matchSearch && matchStage;
    });
  }, [customers, search, stageFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header - Styled to match other pages */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground mt-1">
              Customers who have chatted with your WhatsApp bot
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={loading} className="gap-1.5">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name, phone, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-full sm:w-[220px] text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Filter by Message Set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="pending_verification">Slip Sent</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone Number</TableHead>
                    <TableHead>Email Address</TableHead>
                    <TableHead>Current Set / Stage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 opacity-50" />
                        Loading customers...
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No customers found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const stageInfo = formatStageBadge(customer.current_stage);
                      const isPending = customer.current_stage === "pending_verification" || customer.current_stage === "receipt_pending";
                      const isEnrolled = customer.current_stage === "enrolled" || customer.current_stage === "completed";

                      return (
                        <TableRow key={customer.id} className="hover:bg-muted/40 transition-colors">
                          {/* Name */}
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold uppercase flex-shrink-0">
                                {(customer.customer_name || customer.phone_number).substring(0, 2)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground leading-tight">
                                  {customer.customer_name || "Unidentified Customer"}
                                </p>
                                {customer.push_name && customer.push_name !== customer.customer_name && (
                                  <p className="text-[11px] text-muted-foreground">WA: {customer.push_name}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Phone */}
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(customer.phone_number, `phone_${customer.id}`, "Phone Number")}
                              className="group flex items-center gap-1.5 text-xs font-mono text-foreground hover:text-primary transition-colors py-1 px-1.5 rounded hover:bg-muted/60"
                              title="Click to copy phone number"
                            >
                              <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                              <span>{customer.phone_number}</span>
                              {copiedKey === `phone_${customer.id}` ? (
                                <Check className="h-3 w-3 text-emerald-500 ml-0.5" />
                              ) : (
                                <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                              )}
                            </button>
                          </TableCell>

                          {/* Email */}
                          <TableCell>
                            {customer.customer_email ? (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(customer.customer_email!, `email_${customer.id}`, "Email Address")}
                                className="group flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition-colors py-1 px-1.5 rounded hover:bg-muted/60"
                                title="Click to copy email address"
                              >
                                <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                                <span>{customer.customer_email}</span>
                                {copiedKey === `email_${customer.id}` ? (
                                  <Check className="h-3 w-3 text-emerald-500 ml-0.5" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic pl-1.5">Not provided</span>
                            )}
                          </TableCell>

                          {/* Current Stage */}
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shadow-2xs",
                                stageInfo.badgeClass
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", stageInfo.dotColor)} />
                              {stageInfo.label}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPending && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleEnrollCustomer(customer)}
                                  disabled={enrollingId === customer.id}
                                  className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                                >
                                  {enrollingId === customer.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5" />
                                  )}
                                  Enroll
                                </Button>
                              )}

                              {isEnrolled && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnenrollCustomer(customer)}
                                  disabled={enrollingId === customer.id}
                                  className="h-8 text-xs font-medium border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors gap-1"
                                  title="Click to unenroll student"
                                >
                                  {enrollingId === customer.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <UserX className="h-3.5 w-3.5" />
                                  )}
                                  Unenroll
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => {
                                  setSelectedCustomer(customer);
                                  setDetailOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => navigate("/dashboard/conversations")}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Chat
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Customer Details Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-foreground" />
                Customer Profile
              </DialogTitle>
              <DialogDescription>
                Detailed records captured by the WhatsApp automation bot
              </DialogDescription>
            </DialogHeader>

            {selectedCustomer && (
              <div className="space-y-4 pt-2 text-sm">
                <div className="p-3 rounded-lg border bg-muted/30 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Customer Name:</span>
                    <span className="font-semibold">{selectedCustomer.customer_name || "Not provided"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">WhatsApp Number:</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedCustomer.phone_number, "dlg_phone", "Phone Number")}
                      className="font-mono text-xs font-semibold hover:text-primary flex items-center gap-1"
                    >
                      {selectedCustomer.phone_number}
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Email Address:</span>
                    {selectedCustomer.customer_email ? (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedCustomer.customer_email!, "dlg_email", "Email Address")}
                        className="font-semibold hover:text-primary flex items-center gap-1 text-xs"
                      >
                        {selectedCustomer.customer_email}
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not provided</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-xs">Current Message Set:</span>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", formatStageBadge(selectedCustomer.current_stage).badgeClass)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", formatStageBadge(selectedCustomer.current_stage).dotColor)} />
                      {formatStageBadge(selectedCustomer.current_stage).label}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">Received Message Sets</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCustomer.received_sets.map((set) => (
                      <Badge key={set} variant="secondary" className="text-xs">
                        {set}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedCustomer.receipt_url && (
                  <div className="space-y-1.5 pt-2 border-t">
                    <span className="text-xs font-semibold text-muted-foreground">Uploaded Payment Receipt</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={selectedCustomer.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Full Receipt
                      </a>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t flex items-center justify-between gap-2">
                  {(selectedCustomer.current_stage === "pending_verification" || selectedCustomer.current_stage === "receipt_pending") ? (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleEnrollCustomer(selectedCustomer)}
                      disabled={enrollingId === selectedCustomer.id}
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <UserCheck className="h-4 w-4" />
                      Confirm & Enroll Student
                    </Button>
                  ) : (selectedCustomer.current_stage === "enrolled" || selectedCustomer.current_stage === "completed") ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnenrollCustomer(selectedCustomer)}
                      disabled={enrollingId === selectedCustomer.id}
                      className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                      <UserX className="h-4 w-4" />
                      Unenroll Student
                    </Button>
                  ) : (
                    <div />
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailOpen(false);
                      navigate("/dashboard/conversations");
                    }}
                    className="gap-1 text-xs"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Open Chat
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
