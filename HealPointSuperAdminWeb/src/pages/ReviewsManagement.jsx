import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import toast from "../utils/notify";
import {
  deleteReview,
  getAllReviews,
  updateReviewStatus,
} from "../redux/actions/reviewActions";
import {
  FaCheckCircle,
  FaEye,
  FaEyeSlash,
  FaHourglassHalf,
  FaSearch,
  FaStar,
  FaTimes,
  FaTrash,
  FaUserCircle,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import ConfirmDialog from "../components/common/ConfirmDialog";

const statusCopy = {
  all: "All Reviews",
  pending: "Pending",
  approved: "Approved",
  hidden: "Hidden",
};

const formatReviewDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString();
};

const ReviewsManagement = () => {
  const dispatch = useDispatch();
  const { reviews, loading, error } = useSelector((state) => state.reviews);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  const totalPages = Math.ceil((reviews || []).length / PAGE_SIZE) || 1;
  const paginatedReviews = useMemo(() => {
    const list = reviews || [];
    const start = (currentPage - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [reviews, currentPage]);

  useEffect(() => {
    dispatch(getAllReviews({ search, status }));
  }, [dispatch, search, status]);

  const updateStatus = async (review, update) => {
    setActionLoadingId(review._id);
    try {
      await dispatch(
        updateReviewStatus({ id: review._id, ...update }),
      ).unwrap();
      toast.success("Review updated successfully");
      dispatch(getAllReviews({ search, status }));
    } catch (err) {
      toast.error(err || "Failed to update review status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const removeReview = async () => {
    if (!deleteTarget?._id) return;

    try {
      await dispatch(deleteReview(deleteTarget._id)).unwrap();
      toast.success("Review deleted successfully");
      setDeleteTarget(null);
      dispatch(getAllReviews({ search, status }));
    } catch (err) {
      toast.error(err || "Failed to delete review");
    }
  };

  const reviewStats = useMemo(() => {
    const list = reviews || [];
    const approved = list.filter(
      (review) => review.isApproved && !review.isHidden,
    ).length;
    const hidden = list.filter((review) => review.isHidden).length;
    const pending = list.filter(
      (review) => !review.isApproved && !review.isHidden,
    ).length;
    const average =
      list.length > 0
        ? list.reduce(
            (total, review) => total + Number(review.rating || 0),
            0,
          ) / list.length
        : 0;

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    list.forEach((r) => {
      const star = Math.round(Number(r.rating || 0));
      if (breakdown[star] !== undefined) breakdown[star] += 1;
    });

    return {
      cards: [
        { label: "Total Reviews", value: list.length, icon: <FaStar /> },
        { label: "Approved", value: approved, icon: <FaCheckCircle /> },
        { label: "Pending", value: pending, icon: <FaHourglassHalf /> },
        {
          label: "Average Rating",
          value: average ? average.toFixed(1) : "0.0",
          icon: <FaStar />,
        },
        { label: "Hidden", value: hidden, icon: <FaEyeSlash /> },
      ],
      breakdown,
      average: average ? average.toFixed(1) : "0.0",
    };
  }, [reviews]);

  const hasActiveFilters = Boolean(search.trim()) || status !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <Layout>
      <section className="page-intro reviews-hero">
        <div>
          <span className="eyebrow">Reputation desk</span>
          <h2>Patient Reviews</h2>
          <p>
            Moderate patient feedback, protect the public reviews page, and keep
            doctor reputation signals current.
          </p>
        </div>
        <div className="review-hero-score">
          <FaStar />
          <strong>{reviewStats.average}</strong>
          <span>Average rating</span>
        </div>
      </section>

      <div className="review-stats-grid">
        {reviewStats.cards.map((item) => (
          <article className="metric-card review-stat-card" key={item.label}>
            <div className="metric-icon">{item.icon}</div>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="review-rating-breakdown-bar">
        <span>Rating Breakdown:</span>
        <div className="review-breakdown-chips">
          {[5, 4, 3, 2, 1].map((star) => (
            <span key={star} className="rating-chip">
              <FaStar /> {star}★: <strong>{reviewStats.breakdown[star]}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="filters-row page-search-row review-filter-row">
        <div className="admin-search grow">
          <FaSearch />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, doctor, title, comment"
          />
        </div>
        {hasActiveFilters && (
          <button
            className="btn btn-light"
            type="button"
            onClick={clearFilters}
          >
            <FaTimes /> Clear
          </button>
        )}
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All reviews</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      <div className="search-summary-row">
        <span>{(reviews || []).length} reviews shown</span>
        <span>{statusCopy[status]}</span>
        {search.trim() && <span>Search: {search.trim()}</span>}
      </div>

      {error && <div className="admin-error-box">{error}</div>}

      <div className="review-admin-grid">
        {paginatedReviews.map((review) => {
          const statusClass = review.isHidden
            ? "hidden"
            : review.isApproved
              ? "approved"
              : "pending";
          const statusLabel = review.isHidden
            ? "Hidden"
            : review.isApproved
              ? "Approved"
              : "Pending";
          const rating = Math.max(0, Math.min(5, Number(review.rating || 0)));
          const isBusy = actionLoadingId === review._id;
          const hospitalName =
            review.doctorId?.hospitalName || review.hospitalName;

          return (
            <article
              className={`review-admin-card ${review.isHidden ? "hidden-review" : ""}`}
              key={review._id}
            >
              <div className="review-admin-top">
                {review.avatar ? (
                  <img
                    src={review.avatar}
                    alt={review.name || "Patient"}
                    width={64}
                    height={64}
                    loading="lazy"
                    decoding="async"
                    className="hd-profile-image"
                  />
                ) : (
                  <div className="review-avatar-fallback">
                    <FaUserCircle />
                  </div>
                )}
                <div className="review-person">
                  <h3>{review.name || "Anonymous patient"}</h3>
                  <p>
                    {review.email || review.patientId?.email || "Patient"} -{" "}
                    {formatReviewDate(review.createdAt)}
                  </p>
                </div>
                <span className={`review-status-pill ${statusClass}`}>
                  {statusLabel}
                </span>
              </div>

              <div className="review-meta-row">
                <p className="review-doctor-admin">
                  Doctor:{" "}
                  <strong>
                    {review.doctorName ||
                      review.doctorId?.name ||
                      "General Practitioner"}
                  </strong>
                  {hospitalName ? (
                    <span className="review-hospital-tag">
                      {" "}
                      · {hospitalName}
                    </span>
                  ) : null}
                </p>
                <span className="review-rating-badge">
                  {rating.toFixed(1)} / 5
                </span>
              </div>

              <div
                className="review-stars"
                aria-label={`${rating} out of 5 stars`}
              >
                {Array.from({ length: 5 }).map((_, index) => (
                  <FaStar
                    className={index < rating ? "filled" : ""}
                    key={index}
                  />
                ))}
              </div>
              <div className="review-copy">
                <h4>{review.title || "Patient review"}</h4>
                <p>{review.comment || "No comment provided."}</p>
              </div>
              <div className="table-actions review-actions">
                <button
                  className="btn btn-success"
                  disabled={isBusy || (review.isApproved && !review.isHidden)}
                  onClick={() =>
                    updateStatus(review, { isApproved: true, isHidden: false })
                  }
                >
                  <FaCheckCircle /> {isBusy ? "Updating..." : "Approve"}
                </button>
                <button
                  className="btn btn-warning"
                  disabled={isBusy}
                  onClick={() =>
                    updateStatus(review, { isApproved: false, isHidden: true })
                  }
                >
                  <FaTimes /> Reject
                </button>
                <button
                  className="btn btn-light"
                  disabled={isBusy}
                  onClick={() =>
                    updateStatus(review, { isHidden: !review.isHidden })
                  }
                >
                  {review.isHidden ? <FaEye /> : <FaEyeSlash />}{" "}
                  {review.isHidden ? "Show" : "Hide"}
                </button>
                <button
                  className="btn btn-danger"
                  disabled={isBusy}
                  onClick={() => setDeleteTarget(review)}
                >
                  <FaTrash /> Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div
          className="pagination-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "24px",
            padding: "12px 16px",
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, (reviews || []).length)} of{" "}
            {(reviews || []).length} reviews
          </span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-light btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaChevronLeft /> Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                type="button"
                key={num}
                className={`btn btn-sm ${num === currentPage ? "btn-primary" : "btn-light"}`}
                onClick={() => setCurrentPage(num)}
                style={{ minWidth: "32px", padding: "4px 8px" }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-light btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      )}

      {!(reviews || []).length && (
        <div className="empty-state">
          {loading ? "Loading reviews..." : "No reviews found."}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Review"
        message={`Are you sure you want to delete this review from ${deleteTarget?.name || "this patient"}?`}
        details="This action cannot be undone and the review will be removed from the admin records."
        confirmLabel="Delete Review"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeReview}
        loading={loading}
      />
    </Layout>
  );
};

export default ReviewsManagement;
