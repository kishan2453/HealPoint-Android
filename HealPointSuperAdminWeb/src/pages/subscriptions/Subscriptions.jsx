import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaCoins,
  FaCreditCard,
  FaEye,
  FaHandshake,
  FaHistory,
  FaMoneyBillWave,
  FaPause,
  FaPlay,
  FaPlus,
  FaSearch,
  FaSyncAlt,
  FaTimes,
  FaTimesCircle,
  FaUndo,
} from "react-icons/fa";
import Layout from "../../components/Layout/Layout";
import API from "../../Api/API";
import toast from "../../utils/notify";
import "./subscriptions.css";

const PAGE_SIZE = 10;

const statusLabels = {
  trial: "Trial",
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
  suspended: "Suspended",
  past_due: "Past Due",
};

const paymentLabels = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
  "n/a": "N/A",
};

const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

/**
 * Human-readable subscription duration, computed from the REAL stored dates
 * (startDate → expiryDate). Never fabricated: if either date is missing or the
 * window is empty we return an em dash. Examples:
 *   2026-08-21 → 2027-08-21 = "1 Year"
 *   2026-08-21 → 2028-02-21 = "1 Year 6 Months"
 *   2026-08-21 → 2028-08-21 = "2 Years"
 *   2026-08-21 → 2031-08-21 = "5 Years"
 */
const formatDuration = (startValue, endValue) => {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  if (end.getTime() <= start.getTime()) return "—";
  let totalMonths =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) totalMonths -= 1;
  if (totalMonths <= 0) return "—";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? "Year" : "Years"}`);
  if (months) parts.push(`${months} ${months === 1 ? "Month" : "Months"}`);
  return parts.join(" ");
};

const Subscriptions = () => {
  const [overview, setOverview] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    plan: "all",
    status: "all",
    billingCycle: "all",
    paymentStatus: "all",
    sort: "renewal",
  });
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState("");
  const [viewing, setViewing] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const loadOverview = async () => {
    try {
      const { data } = await API.get("/subscription/overview");
      setOverview(data.overview);
    } catch (error) {
      console.warn("Subscription overview failed:", error.message);
    }
  };

  const loadPlans = async () => {
    try {
      const { data } = await API.get("/subscription/plans");
      setPlans(data.plans || []);
    } catch (error) {
      console.warn("Subscription plans failed:", error.message);
    }
  };
  const loadList = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams();
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.plan !== "all") params.set("plan", filters.plan);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.billingCycle !== "all") params.set("billingCycle", filters.billingCycle);
      if (filters.paymentStatus !== "all") params.set("paymentStatus", filters.paymentStatus);
      params.set("sort", filters.sort);
      params.set("page", page);
      params.set("limit", PAGE_SIZE);
      const { data } = await API.get(`/subscription?${params.toString()}`);
      setSubscriptions(data.subscriptions || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      setLoadError(error.response?.data?.message || "Unable to load subscriptions");
      setSubscriptions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    loadList();
    loadOverview();
    loadPlans();
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.plan, filters.status, filters.billingCycle, filters.paymentStatus, filters.sort, page]);

  const openDetails = async (id) => {
    setViewingLoading(true);
    try {
      const { data } = await API.get(`/subscription/${id}`);
      setViewing(data.subscription);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load subscription details");
    } finally {
      setViewingLoading(false);
    }
  };

  const runAction = async (payload) => {
    setBusyId(confirmAction.id);
    try {
      const { data } = await API.patch(
        `/subscription/${confirmAction.id}/${confirmAction.endpoint}`,
        payload
      );
      toast.success(data.message || "Subscription updated");
      setConfirmAction(null);
      refresh();
      if (viewing) openDetails(confirmAction.id);
    } catch (error) {
      toast.error(error.response?.data?.message || "Action failed");
    } finally {
      setBusyId("");
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const summaryCards = useMemo(() => {
    const items = [
      { label: "Total Subscriptions", value: overview?.totalSubscriptions ?? "—", Icon: FaCoins },
      { label: "Active", value: overview?.activeSubscriptions ?? "—", Icon: FaPlay },
      { label: "Trial", value: overview?.trialCount ?? "—", Icon: FaHandshake },
      { label: "Past Due", value: overview?.pastDueCount ?? "—", Icon: FaCalendarAlt },
      { label: "Suspended", value: overview?.suspendedCount ?? "—", Icon: FaPause },
      { label: "Expired", value: overview?.expiredCount ?? "—", Icon: FaTimesCircle },
      { label: "Revenue (expected)", value: formatMoney(overview?.revenue ?? 0), Icon: FaMoneyBillWave },
      { label: "Revenue (paid)", value: formatMoney(overview?.paidRevenue ?? 0), Icon: FaCreditCard },
    ];
    return items;
  }, [overview]);

  return (
    <Layout>
      <div className="page-header-row page-intro">
        <div>
          <h2>Hospital Subscriptions</h2>
          <p>
            Manage every hospital subscription, plan, payment and renewal from one
            place. Changes write straight to the shared HealPoint database.
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-light" onClick={refresh}>
            <FaSyncAlt /> Refresh
          </button>
        </div>
      </div>

      {/* Overview cards */}
      <div className="admin-stats-grid metrics-grid">
        {summaryCards.map(({ label, value, Icon }) => (
          <div className="metric-card" key={label}>
            <span className="metric-icon"><Icon /></span>
            <div>
              <strong>{value}</strong>
              <small>{label}</small>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-row admin-filter-panel">
        <form
          className="admin-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            loadList();
          }}
        >
          <FaSearch />
          <input
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Search hospital or plan…"
            aria-label="Search subscriptions"
          />
        </form>
        <select
          value={filters.plan}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, plan: event.target.value });
          }}
          aria-label="Filter by plan"
        >
          <option value="all">All plans</option>
          {plans.map((plan) => (
            <option value={plan.key} key={plan.key}>{plan.name}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, status: event.target.value });
          }}
          aria-label="Filter by status"
        >
          <option value="all">All status</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <select
          value={filters.billingCycle}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, billingCycle: event.target.value });
          }}
          aria-label="Filter by billing cycle"
        >
          <option value="all">All billing cycles</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="none">None</option>
        </select>
        <select
          value={filters.paymentStatus}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, paymentStatus: event.target.value });
          }}
          aria-label="Filter by payment status"
        >
          <option value="all">All payment status</option>
          {Object.entries(paymentLabels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <select
          value={filters.sort}
          onChange={(event) => {
            setPage(1);
            setFilters({ ...filters, sort: event.target.value });
          }}
          aria-label="Sort subscriptions"
        >
          <option value="renewal">Sort: Renewal date</option>
          <option value="renewal-desc">Sort: Renewal date (newest)</option>
          <option value="start">Sort: Start date</option>
          <option value="amount">Sort: Amount (high→low)</option>
          <option value="duration">Sort: Duration (longest)</option>
          <option value="hospital">Sort: Hospital name</option>
          <option value="recent">Sort: Recently created</option>
        </select>
      </div>
      <div className="admin-table-scroll">
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>HOSPITAL</th>
              <th>PLAN</th>
              <th>STATUS</th>
              <th>AMOUNT</th>
              <th>BILLING</th>
              <th>PAYMENT</th>
              <th>START</th>
              <th>RENEWAL</th>
              <th>DURATION</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              subscriptions.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong>{item.hospitalName || item.hospital?.name || "—"}</strong>
                    <br />
                    <small className="admin-info-text">
                      {item.hospitalAdmin ? `${item.hospitalAdmin.name} · ${item.hospitalAdmin.email}` : "No admin linked"}
                    </small>
                    <br />
                    <small className="admin-info-text">
                      {item.hospital?.isActive === false
                        ? "Hospital suspended"
                        : item.hospital?.isActive
                          ? "Hospital active"
                          : ""}
                    </small>
                  </td>
                  <td>{item.planName || item.planKey || "—"}</td>
                  <td>
                    <span className={`status-pill ${item.status}`}>
                      {statusLabels[item.status] || item.status}
                    </span>
                  </td>
                  <td>{formatMoney(item.amount)}</td>
                  <td>{item.billingCycle || "—"}</td>
                  <td>
                    <span className={`payment-status-pill ${item.paymentStatus}`}>
                      {paymentLabels[item.paymentStatus] || item.paymentStatus}
                    </span>
                  </td>
                  <td>{formatDate(item.startDate)}</td>
                  <td>{formatDate(item.expiryDate)}</td>
                  <td>{formatDuration(item.startDate, item.expiryDate)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={() => openDetails(item._id)}
                    >
                      <FaEye size={12} /> Details
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {loading && <div className="skeleton-loader">Loading subscriptions…</div>}
      {!loading && loadError && <div className="admin-error-box">{loadError}</div>}
      {!loading && !loadError && !subscriptions.length && (
        <div className="empty-state">No subscriptions match your filters.</div>
      )}

      <div className="pagination-row">
        <button
          className="btn btn-light"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          <FaChevronLeft /> Previous
        </button>
        <span>
          Page {page} of {totalPages} · {totalCount} records
        </span>
        <button
          className="btn btn-light"
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <FaChevronRight />
        </button>
      </div>
      {/* Detail modal */}
      {viewing && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={() => setViewing(null)}
        >
          <div
            className="admin-detail-modal subscription-detail-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-detail-head">
              <div>
                <h3>{viewing.hospitalName || viewing.hospital?.name || "Hospital"}</h3>
                <span>Subscription details</span>
              </div>
              <button
                type="button"
                className="app-confirm-close"
                aria-label="Close"
                onClick={() => setViewing(null)}
              >
                <FaTimes />
              </button>
            </div>

            {viewingLoading ? (
              <div className="skeleton-loader">Loading details…</div>
            ) : (
              <>
                <div className="hospital-view-grid subscription-summary-grid">
                  <div>
                    <strong>Current plan</strong>
                    <p>{viewing.planName || viewing.planKey || "—"}</p>
                  </div>
                  <div>
                    <strong>Status</strong>
                    <p>
                      <span className={`status-pill ${viewing.status}`}>
                        {statusLabels[viewing.status] || viewing.status}
                      </span>
                    </p>
                  </div>
                  <div>
                    <strong>Amount</strong>
                    <p>{formatMoney(viewing.amount)}</p>
                  </div>
                  <div>
                    <strong>Billing cycle</strong>
                    <p>{viewing.billingCycle || "—"}</p>
                  </div>
                  <div>
                    <strong>Payment status</strong>
                    <p>
                      <span className={`payment-status-pill ${viewing.paymentStatus}`}>
                        {paymentLabels[viewing.paymentStatus] || viewing.paymentStatus}
                      </span>
                    </p>
                  </div>
                  <div>
                    <strong>Auto renew</strong>
                    <p>{viewing.autoRenew ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <strong>Start date</strong>
                    <p>{formatDate(viewing.startDate)}</p>
                  </div>
                  <div>
                    <strong>Renewal / expiry</strong>
                    <p>{formatDate(viewing.expiryDate)}</p>
                  </div>
                  <div>
                    <strong>Duration</strong>
                    <p>{formatDuration(viewing.startDate, viewing.expiryDate)}</p>
                  </div>
                  <div>
                    <strong>Hospital admin</strong>
                    <p>
                      {viewing.hospitalAdmin
                        ? `${viewing.hospitalAdmin.name} · ${viewing.hospitalAdmin.email}`
                        : "No admin linked"}
                    </p>
                  </div>
                </div>
                <div className="subscription-action-row">
                  <button
                    type="button"
                    className="btn btn-success"
                    disabled={busyId === viewing._id}
                    onClick={() =>
                      setConfirmAction({ id: viewing._id, endpoint: "activate", label: "Activate" })
                    }
                  >
                    <FaPlay /> Activate
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning"
                    disabled={busyId === viewing._id}
                    onClick={() =>
                      setConfirmAction({ id: viewing._id, endpoint: "suspend", label: "Suspend" })
                    }
                  >
                    <FaPause /> Suspend
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busyId === viewing._id}
                    onClick={() =>
                      setConfirmAction({ id: viewing._id, endpoint: "cancel", label: "Cancel" })
                    }
                  >
                    <FaTimesCircle /> Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === viewing._id}
                    onClick={() =>
                      setConfirmAction({ id: viewing._id, endpoint: "renew", label: "Renew" })
                    }
                  >
                    <FaSyncAlt /> Renew
                  </button>
                  <button
                    type="button"
                    className="btn btn-light"
                    disabled={busyId === viewing._id}
                    onClick={() =>
                      setConfirmAction({ id: viewing._id, endpoint: "extend", label: "Extend" })
                    }
                  >
                    <FaPlus /> Extend
                  </button>
                  <button
                    type="button"
                    className="btn btn-light"
                    disabled={busyId === viewing._id}
                    onClick={() =>
                      setConfirmAction({ id: viewing._id, endpoint: "change-plan", label: "Change plan" })
                    }
                  >
                    <FaUndo /> Change plan
                  </button>
                  <button
                    type="button"
                    className="btn btn-light"
                    disabled={busyId === viewing._id}
                    onClick={() =>
                      setConfirmAction({ id: viewing._id, endpoint: "payment-status", label: "Update payment" })
                    }
                  >
                    <FaCreditCard /> Payment
                  </button>
                </div>
{viewing.payments?.length > 0 && (
                  <div className="subscription-section">
                    <h4><FaCreditCard /> Payment history</h4>
                    <div className="admin-table-scroll">
                      <table className="table table-bordered">
                        <thead>
                          <tr>
                            <th>AMOUNT</th>
                            <th>CYCLE</th>
                            <th>STATUS</th>
                            <th>PAID AT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewing.payments.map((payment, index) => (
                            <tr key={index}>
                              <td>{formatMoney(payment.amount)}</td>
                              <td>{payment.billingCycle}</td>
                              <td>
                                <span className={`payment-status-pill ${payment.paymentStatus}`}>
                                  {paymentLabels[payment.paymentStatus] || payment.paymentStatus}
                                </span>
                              </td>
                              <td>{formatDate(payment.paidAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {viewing.history?.length > 0 && (
                  <div className="subscription-section">
                    <h4><FaHistory /> Subscription history</h4>
                    <div className="admin-table-scroll">
                      <table className="table table-bordered">
                        <thead>
                          <tr>
                            <th>ACTION</th>
                            <th>FROM → TO</th>
                            <th>NOTE</th>
                            <th>BY</th>
                            <th>DATE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewing.history.map((entry, index) => (
                            <tr key={index}>
                              <td>{entry.action}</td>
                              <td>
                                {entry.fromStatus || "—"} → {entry.toStatus || "—"}
                              </td>
                              <td>{entry.note || "—"}</td>
                              <td>{entry.changedByName || "—"}</td>
                              <td>{formatDate(entry.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {/* Action confirm + input modal */}
      {confirmAction && (
        <SubscriptionActionModal
          action={confirmAction}
          plans={plans}
          current={viewing}
          busy={busyId === confirmAction.id}
          onClose={() => setConfirmAction(null)}
          onConfirm={(payload) => runAction(payload)}
        />
      )}
    </Layout>
  );
};

const actionIntro = {
  activate: "Activate this subscription. The hospital will regain full plan access.",
  suspend: "Suspend this subscription. The hospital will temporarily lose paid access.",
  cancel: "Cancel this subscription permanently.",
  renew: "Renew this subscription for its billing cycle.",
  extend: "Extend this subscription by days/months.",
  "change-plan": "Select the new plan for this hospital.",
  "payment-status": "Mark the payment status / amount for this subscription.",
};

const SubscriptionActionModal = ({ action, plans, current, busy, onClose, onConfirm }) => {
  const [note, setNote] = useState("");
  const [days, setDays] = useState("30");
  const [months, setMonths] = useState("0");
  const [planKey, setPlanKey] = useState(current?.planKey || plans[0]?.key || "");
  const [paymentStatus, setPaymentStatus] = useState(current?.paymentStatus || "paid");
  const [amount, setAmount] = useState(current?.amount || "");

  const submit = (event) => {
    event.preventDefault();
    if (action.endpoint === "extend") {
      onConfirm({ days: Number(days), months: Number(months), note: note.trim() || undefined });
      return;
    }
    if (action.endpoint === "change-plan") {
      const plan = plans.find((item) => item.key === planKey);
      onConfirm({
        planKey,
        planName: plan?.name,
        note: note.trim() || undefined,
      });
      return;
    }
    if (action.endpoint === "payment-status") {
      onConfirm({
        paymentStatus,
        amount: amount === "" ? undefined : Number(amount),
        note: note.trim() || undefined,
      });
      return;
    }
    onConfirm({ note: note.trim() || undefined });
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="app-confirm-dialog"
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-detail-head">
          <div>
            <h3>{action.label}</h3>
            <span>{actionIntro[action.endpoint]}</span>
          </div>
          <button type="button" className="app-confirm-close" aria-label="Close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={submit}>
          {action.endpoint === "extend" && (
            <div className="appointment-status-card">
              <label>
                Days
                <input type="number" min="0" value={days} onChange={(e) => setDays(e.target.value)} />
              </label>
              <label>
                Months
                <input type="number" min="0" value={months} onChange={(e) => setMonths(e.target.value)} />
              </label>
            </div>
          )}

          {action.endpoint === "change-plan" && (
            <label className="appointment-status-card">
              New plan
              <select value={planKey} onChange={(e) => setPlanKey(e.target.value)}>
                {plans.map((plan) => (
                  <option value={plan.key} key={plan.key}>{plan.name}</option>
                ))}
              </select>
            </label>
          )}

          {action.endpoint === "payment-status" && (
            <div className="appointment-status-card">
              <label>
                Payment status
                <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </label>
              <label>
                Amount (₹)
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            </div>
          )}

          <label className="appointment-status-card">
            Note (optional)
            <textarea
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note for the subscription history…"
            />
          </label>

          <div className="app-confirm-actions">
            <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : action.label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Subscriptions;






