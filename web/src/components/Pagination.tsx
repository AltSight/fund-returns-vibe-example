"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: PaginationProps) {
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-400">
        Showing {from}–{to} of {total.toLocaleString()} holdings
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: page > 1 ? "var(--header-bg)" : undefined,
            color: page > 1 ? "var(--header-text)" : undefined,
            border: page <= 1 ? "1px solid #E5E7EB" : "none",
          }}
        >
          Previous
        </button>
        <span className="text-sm text-gray-500 px-2">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: page < totalPages ? "var(--header-bg)" : undefined,
            color: page < totalPages ? "var(--header-text)" : undefined,
            border: page >= totalPages ? "1px solid #E5E7EB" : "none",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
