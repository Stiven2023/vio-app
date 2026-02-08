export default function AppLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-2">
          <div className="h-3 w-3 animate-bounce rounded-full bg-success" />
          <div className="h-3 w-3 animate-bounce rounded-full bg-success [animation-delay:100ms]" />
          <div className="h-3 w-3 animate-bounce rounded-full bg-success [animation-delay:200ms]" />
        </div>
        <div className="text-sm text-default-500">Cargando...</div>
      </div>
    </div>
  );
}
