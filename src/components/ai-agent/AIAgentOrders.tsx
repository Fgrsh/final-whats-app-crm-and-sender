import React, { useState } from "react";
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Phone,
  MapPin,
  CreditCard,
  ExternalLink,
  Filter,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { AIOrder } from "../../types.ts";

interface AIAgentOrdersProps {
  orders: AIOrder[];
  language: "ar" | "en";
  onUpdateOrderStatus: (orderId: string, status: AIOrder["status"]) => Promise<void>;
  onDeleteOrder?: (orderId: string) => Promise<void>;
  onClearCancelledOrders?: () => Promise<void>;
  onOpenCustomerChat?: (phone: string) => void;
}

export const AIAgentOrders: React.FC<AIAgentOrdersProps> = ({
  orders,
  language,
  onUpdateOrderStatus,
  onDeleteOrder,
  onClearCancelledOrders,
  onOpenCustomerChat,
}) => {
  const isAr = language === "ar";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clearingCancelled, setClearingCancelled] = useState(false);

  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      !searchQuery ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone.includes(searchQuery) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.some((i) => i.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.shippingAddress && o.shippingAddress.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const confirmedCount = orders.filter((o) => o.status === "confirmed" || o.status === "completed").length;

  const handleDelete = async (orderId: string, customerName: string) => {
    const confirmText = isAr
      ? `هل أنت متأكد من مسح وحذف طلب العميل (${customerName}) نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Are you sure you want to permanently delete the order for (${customerName})? This action cannot be undone.`;
    if (!window.confirm(confirmText)) return;

    if (onDeleteOrder) {
      await onDeleteOrder(orderId);
    } else {
      await onUpdateOrderStatus(orderId, "cancelled");
    }
  };

  const handleStatusChange = async (order: AIOrder, st: AIOrder["status"]) => {
    if (st === "cancelled") {
      const confirmText = isAr
        ? `تنبيه: الطلبات الملغية يتم مسحها تماماً من النظام وقاعدة البيانات.\nهل تريد إلغاء ومسح الطلب #${order.id} للعميل (${order.customerName}) نهائياً؟`
        : `Notice: Cancelled orders are completely deleted from the database.\nDo you want to cancel and delete order #${order.id} permanently?`;
      if (!window.confirm(confirmText)) return;

      if (onDeleteOrder) {
        await onDeleteOrder(order.id);
      } else {
        await onUpdateOrderStatus(order.id, "cancelled");
      }
      return;
    }
    await onUpdateOrderStatus(order.id, st);
  };

  const handleClearAllCancelled = async () => {
    if (cancelledCount === 0) return;
    const confirmText = isAr
      ? `هل أنت متأكد من مسح كافة الطلبات الملغية (${cancelledCount} طلب) نهائياً من النظام؟`
      : `Are you sure you want to permanently delete all (${cancelledCount}) cancelled orders?`;
    if (!window.confirm(confirmText)) return;

    setClearingCancelled(true);
    try {
      if (onClearCancelledOrders) {
        await onClearCancelledOrders();
      } else {
        // Fallback: delete each cancelled order
        const cancelledOrders = orders.filter((o) => o.status === "cancelled");
        for (const o of cancelledOrders) {
          if (onDeleteOrder) {
            await onDeleteOrder(o.id);
          }
        }
      }
    } finally {
      setClearingCancelled(false);
    }
  };

  const getStatusBadge = (status: AIOrder["status"]) => {
    switch (status) {
      case "confirmed":
        return {
          label: isAr ? "مؤكد" : "Confirmed",
          class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        };
      case "processing":
        return {
          label: isAr ? "قيد التجهيز والشحن" : "Processing",
          class: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        };
      case "completed":
        return {
          label: isAr ? "مكتمل ومستلم" : "Completed",
          class: "bg-teal-500/10 text-teal-300 border-teal-500/30",
        };
      case "cancelled":
        return {
          label: isAr ? "ملغي (محذوف)" : "Cancelled",
          class: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        };
      default:
        return {
          label: isAr ? "مسودة (قيد التجميع)" : "Draft",
          class: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Summary */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-emerald-400" />
            <span>{isAr ? "طلبات الشراء المستخرجة بواسطة AI" : "AI-Collected Customer Orders"}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? "طلبات الشراء المستخلصة تلقائياً. يتم مسح أي طلب ملغي نهائياً فوراً من قاعدة البيانات والنظام."
              : "Automatically extracted orders. Cancelled orders are permanently deleted from the database."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {cancelledCount > 0 && (
            <button
              onClick={handleClearAllCancelled}
              disabled={clearingCancelled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
              title={isAr ? "مسح كافة الطلبات الملغية نهائياً" : "Purge all cancelled orders"}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>
                {isAr
                  ? `مسح الملغية نهائياً (${cancelledCount})`
                  : `Purge Cancelled (${cancelledCount})`}
              </span>
            </button>
          )}

          <div className="flex items-center gap-4 bg-slate-850 border border-slate-700/60 rounded-xl px-4 py-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">{isAr ? "الطلبات النشطة:" : "Active Orders:"}</span>
              <span className="text-white font-bold">{orders.filter((o) => o.status !== "cancelled").length}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div>
              <span className="text-slate-400 block text-[10px]">{isAr ? "الطلبات المؤكدة:" : "Confirmed:"}</span>
              <span className="text-emerald-400 font-bold">{confirmedCount}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div>
              <span className="text-slate-400 block text-[10px]">{isAr ? "إجمالي القيمة:" : "Revenue:"}</span>
              <span className="text-teal-300 font-bold font-mono">
                {totalRevenue.toLocaleString()} {orders[0]?.currency || "ج.م"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "بحث برقم الطلب، اسم العميل، الهاتف، أو المنتج..." : "Search by order ID, name, phone, product..."}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: isAr ? "الكل" : "All" },
            { id: "draft", label: isAr ? "مسودات" : "Drafts" },
            { id: "confirmed", label: isAr ? "مؤكدة" : "Confirmed" },
            { id: "processing", label: isAr ? "قيد الشحن" : "Processing" },
            { id: "completed", label: isAr ? "مكتملة" : "Completed" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition ${
                statusFilter === st.id
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
          {isAr
            ? "لا توجد طلبات تطابق معايير البحث الحالية (تم حذف وتطهير أي طلبات ملغية تماماً)."
            : "No orders found matching the current search filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.map((order) => {
            const badge = getStatusBadge(order.status);

            return (
              <div
                key={order.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header: Order ID, Status, and Delete Action */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded">
                        #{order.id}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${badge.class}`}
                      >
                        {badge.label}
                      </span>

                      {/* Explicit Delete Button */}
                      <button
                        onClick={() => handleDelete(order.id, order.customerName)}
                        title={isAr ? "مسح هذا الطلب نهائياً من النظام" : "Permanently delete order"}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div>
                      <h4 className="font-bold text-white text-xs sm:text-sm">
                        {order.customerName}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                        <Phone className="w-3 h-3 text-slate-500" />
                        +{order.phone}
                      </div>
                    </div>

                    {onOpenCustomerChat && (
                      <button
                        onClick={() => onOpenCustomerChat(order.phone)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-[11px] border border-slate-700/60 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{isAr ? "محادثة العميل" : "View Chat"}</span>
                      </button>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs">
                    <div className="text-[10px] text-slate-400 font-semibold mb-1">
                      {isAr ? "المنتجات المطلوبة:" : "Ordered Items:"}
                    </div>
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-200">
                        <span>
                          {it.productName} <strong className="text-teal-400">×{it.quantity}</strong>
                        </span>
                        <span className="font-mono text-slate-400">
                          {it.subtotal || it.unitPrice * it.quantity} {order.currency}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800 font-bold text-teal-300">
                      <span>{isAr ? "الإجمالي الكلي:" : "Total Amount:"}</span>
                      <span className="font-mono">
                        {order.totalAmount} {order.currency}
                      </span>
                    </div>
                  </div>

                  {/* Shipping & Payment details */}
                  <div className="space-y-1.5 text-xs text-slate-400">
                    {order.shippingAddress && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span className="text-slate-300">{order.shippingAddress}</span>
                      </div>
                    )}
                    {order.locationUrl ? (
                      <div className="pt-0.5">
                        <a
                          href={order.locationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition shadow-sm"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{isAr ? "عرض اللوكيشن على الخريطة 📍" : "View Location on Maps 📍"}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 w-fit">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>{isAr ? "بانتظار إرسال اللوكيشن لتسهيل الاستلام 📍" : "Awaiting location pin 📍"}</span>
                      </div>
                    )}
                    {order.paymentMethod && (
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{order.paymentMethod}</span>
                      </div>
                    )}
                    {order.notes && (
                      <div className="text-[11px] italic text-slate-400 pt-0.5">
                        📝 {order.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Switcher Controls */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500">
                    {isAr ? "تغيير الحالة:" : "Change Status:"}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(["confirmed", "processing", "completed"] as AIOrder["status"][]).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() => handleStatusChange(order, st)}
                          disabled={order.status === st}
                          className={`text-[10px] px-2.5 py-1 rounded-lg transition ${
                            order.status === st
                              ? "bg-teal-600 text-white font-semibold cursor-default"
                              : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750"
                          }`}
                        >
                          {st === "confirmed"
                            ? isAr ? "تأكيد" : "Confirm"
                            : st === "processing"
                            ? isAr ? "شحن" : "Ship"
                            : isAr ? "اكتمال" : "Done"}
                        </button>
                      )
                    )}

                    {/* Permanent Cancel & Delete Button */}
                    <button
                      key="cancel"
                      onClick={() => handleStatusChange(order, "cancelled")}
                      className="text-[10px] px-2.5 py-1 rounded-lg font-medium transition text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-500/50 flex items-center gap-1"
                      title={isAr ? "إلغاء ومسح الطلب نهائياً من النظام" : "Cancel & permanently delete order"}
                    >
                      <Trash2 className="w-3 h-3 text-rose-400" />
                      <span>{isAr ? "إلغاء ومسح نهائي" : "Cancel & Delete"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

