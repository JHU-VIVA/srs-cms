interface Props {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, total, pageSize, onPageChange }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const range: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i > page - 3 && i < page + 3) range.push(i);
  }

  return (
    <div className="flex justify-center space-x-2 mt-4">
      <div className="join">
        <button
          className={`join-item btn btn-sm ${page <= 1 ? "btn-disabled" : ""}`}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        {range.map((p) =>
          p === page ? (
            <span key={p} className="join-item btn btn-sm btn-active">
              {p}
            </span>
          ) : (
            <button
              key={p}
              className="join-item btn btn-sm"
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className={`join-item btn btn-sm ${page >= totalPages ? "btn-disabled" : ""}`}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
