import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface OrderRecord {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  created_at: string;
  status: string;
  order_items: any;
  special_instructions: string;
  feedback: string;
}

export default function Customers() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setOrders(data || []);
      } catch (err: any) {
        console.error("Error fetching customers/orders:", err);
        toast({
          title: "Error",
          description: "Could not load customer data.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [session?.user?.id, toast]);

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    return (
      (o.customer_name || "").toLowerCase().includes(q) ||
      (o.customer_phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers & Inquiries</h1>
          <p className="text-muted-foreground mt-2">
            Order inquiries captured by your WhatsApp bot
          </p>
        </div>

        <Card className="border-muted bg-card/50 backdrop-blur-sm">
          <CardHeader className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pb-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading customers...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <p className="text-muted-foreground">No customers found matching your criteria.</p>
              </div>
            ) : (
              <div className="rounded-md border border-muted/50 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Customer / Company</TableHead>
                      <TableHead>Phone & Email</TableHead>
                      <TableHead>Delivery Address</TableHead>
                      <TableHead>Product Type</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => {
                      const specs = order.special_instructions || "No specifications collected yet";
                      
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.customer_name || "Unknown"}
                          </TableCell>
                          <TableCell>
                            <div>{order.customer_phone}</div>
                            <div className="text-xs text-muted-foreground">Collected via chat</div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate" title={order.customer_address}>
                            {order.customer_address || "Pending"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="mb-1">
                              {order.order_items?.[0]?.product_name || "Custom Inquiry"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Specs
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Inquiry Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-semibold">Customer</p>
                                      <p className="text-sm">{order.customer_name || "N/A"}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold">Phone</p>
                                      <p className="text-sm">{order.customer_phone || "N/A"}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold">Full Specifications</p>
                                    <div className="mt-2 p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                                      {(() => {
                                        try {
                                          const parsed = typeof specs === 'string' && specs.trim().startsWith('{') ? JSON.parse(specs) : null;
                                          if (parsed && typeof parsed === 'object') {
                                            return (
                                              <ul className="space-y-1">
                                                {Object.entries(parsed).map(([key, value]) => (
                                                  <li key={key}>
                                                    <span className="font-semibold">{key}:</span> {String(value)}
                                                  </li>
                                                ))}
                                              </ul>
                                            );
                                          }
                                        } catch (e) {
                                          // fallback to raw string if it's not valid JSON
                                        }
                                        return specs;
                                      })()}
                                    </div>
                                    {order.feedback && (
                                    <div>
                                      <p className="text-sm font-semibold mt-4 text-primary">Customer Feedback</p>
                                      <div className="mt-2 p-3 bg-primary/10 rounded-md text-sm whitespace-pre-wrap italic">
                                        "{order.feedback}"
                                      </div>
                                    </div>
                                  )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
