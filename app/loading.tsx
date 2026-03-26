export default function AppLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          aria-label="Cargando"
          className="grid h-12 w-12 place-items-center rounded-xl bg-success/10 ring-1 ring-success/25"
          role="status"
        >
          <svg
            aria-hidden="true"
            className="h-7 w-7 animate-pulse"
            fill="none"
            viewBox="0 0 52 52"
          >
            <path
              className="stroke-success"
              d="M14 27 L22 35 L38 18"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="6"
            />
          </svg>
        </div>

        <div className="text-sm text-default-500">Loading module...</div>
      </div>
    </div>
  );
} 
