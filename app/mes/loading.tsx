"use client";

import { Skeleton } from "@heroui/react";

export default function MesLoading() {
  return (
    <div className="w-full min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <Skeleton className="w-1 h-7 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-4 w-48 rounded-md" />
        </div>
        <Skeleton className="h-3 w-56 rounded-md mt-1 ml-4" />
      </div>

      {/* Stats */}
      <div className="px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border border-divider rounded-lg px-3 py-2 space-y-1"
          >
            <Skeleton className="h-8 w-10 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-1 pb-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      <div className="h-px bg-divider mx-6" />

      {/* Toolbar */}
      <div className="px-6 py-4 flex gap-2">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Pedido cards */}
      <div className="px-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border border-divider rounded-xl overflow-hidden"
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-5 w-5 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-3 w-36 rounded-md" />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-3 w-16 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>

            {/* Expanded body for first card */}
            {i === 0 && (
              <div className="px-3 pb-3">
                <div className="h-px bg-divider mb-3" />
                <div className="border border-divider rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-full ml-auto" />
                  </div>
                  <Skeleton className="h-4 w-40 rounded-md" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-24 rounded-md" />
                    <Skeleton className="h-3 w-20 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-1 w-full rounded-full" />
                  <div className="h-px bg-divider" />
                  <div className="space-y-2 pt-1">
                    {Array.from({ length: 4 }).map((_, r) => (
                      <div key={r} className="flex gap-3">
                        <Skeleton className="h-4 w-10 rounded-md" />
                        <Skeleton className="h-4 w-8 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-4 w-20 rounded-md" />
                        <Skeleton className="h-4 w-12 rounded-md" />
                        <Skeleton className="h-4 w-12 rounded-md" />
                        <Skeleton className="h-4 w-6 rounded-md" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
