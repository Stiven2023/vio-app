export function parsePagination(searchParams: URLSearchParams) {
  const pageRaw = searchParams.get("page") ?? "1";
  const pageSizeRaw = searchParams.get("pageSize") ?? "20";

  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(pageSizeRaw, 10) || 20),
  );
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}
