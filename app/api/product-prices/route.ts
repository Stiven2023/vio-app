import { rateLimit } from "@/src/utils/rate-limit";

function deprecatedResponse() {
  return new Response("Endpoint deprecated", { status: 410 });
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:get",
    limit: 50,
    windowMs: 60_000,
  });

  if (limited) return limited;

  return deprecatedResponse();
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:post",
    limit: 50,
    windowMs: 60_000,
  });

  if (limited) return limited;

  return deprecatedResponse();
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:put",
    limit: 50,
    windowMs: 60_000,
  });

  if (limited) return limited;

  return deprecatedResponse();
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "productPrices:delete",
    limit: 50,
    windowMs: 60_000,
  });

  if (limited) return limited;

  return deprecatedResponse();
}
