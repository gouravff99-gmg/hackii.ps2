interface RideAssignmentOverlayProps {
  driverName?: string;
  exiting: boolean;
}

export function RideAssignmentOverlay({ driverName, exiting }: RideAssignmentOverlayProps) {
  return (
    <div
      className={`fixed inset-0 z-[1000] flex items-center justify-center bg-ink-900/70 p-6 backdrop-blur-sm motion-safe:animate-fade-in transition-[opacity,transform] duration-[400ms] motion-reduce:transition-none ${
        exiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
      }`}
    >
      <div className="max-w-sm text-center text-white motion-safe:animate-slide-up">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white/15 text-5xl">
          <span className="motion-safe:animate-slide-up" aria-hidden="true">✓</span>
        </div>
        <h2 className="text-3xl font-semibold">Your Ride is Accepted!</h2>
        <p className="mt-3 text-white/80">{driverName ?? "Your driver"} is on the way.</p>
      </div>
    </div>
  );
}
