import { RideStatus } from "@ps02/shared";
import { Icon } from "../ui/Icon";

const STEPS: { status: RideStatus; label: string }[] = [
  { status: RideStatus.REQUESTED, label: "Requested" },
  { status: RideStatus.ACCEPTED, label: "Accepted" },
  { status: RideStatus.ARRIVING, label: "Arriving" },
  { status: RideStatus.ONGOING, label: "On trip" },
  { status: RideStatus.COMPLETED, label: "Completed" },
];

/**
 * Five-stage live ride stepper. Reassigning is shown as a warning on the
 * "Accepted" stage rather than a separate step, because it is transient.
 */
export function RideStatusStepper({ status }: { status: RideStatus }) {
  if (status === RideStatus.CANCELLED) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-ink-100 px-4 py-3 text-sm text-ink-600">
        <Icon name="close" size={16} />
        This ride was cancelled.
      </div>
    );
  }

  const isReassigning = status === RideStatus.REASSIGNING;
  const effective = isReassigning ? RideStatus.REQUESTED : status;
  const currentIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.status === effective),
  );

  return (
    <div>
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.status} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? isReassigning && index === 0
                          ? "bg-amber-500 text-white"
                          : "bg-brand-600 text-white"
                        : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {done ? <Icon name="check" size={13} /> : index + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-[10px] font-medium sm:text-xs ${
                    active ? "text-ink-900" : done ? "text-ink-600" : "text-ink-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <span
                  className={`mx-1 mb-5 h-0.5 flex-1 rounded-full sm:mx-2 ${
                    index < currentIndex ? "bg-emerald-400" : "bg-ink-200"
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {isReassigning ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Icon name="alert" size={14} />
          Finding you a new driver — your ETA may change.
        </p>
      ) : null}
    </div>
  );
}
