import { useState } from "react";
import { DocumentReviewStatus } from "@ps02/shared";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services/adminApi";
import { errorMessage } from "../../services/api";

export function DriverVerification() {
  const { data, loading, error, reload } = useAsync(() => adminApi.driverApplications(), []);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(null);
    }
  };

  const openDocument = async (documentId: string) => {
    try {
      const blob = await adminApi.driverDocument(documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Driver verification" description="Review uploaded documents and onboarding details. Approval is manual and does not imply government or third-party verification." />
      {actionError ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p> : null}
      {loading ? (
        <Card><CardBody className="flex justify-center py-12"><Spinner className="h-6 w-6" /></CardBody></Card>
      ) : error || !data ? (
        <Card><ErrorState message={error ?? "Driver applications unavailable"} onRetry={() => void reload()} /></Card>
      ) : (
        <>
          {data.applications.length === 0 ? (
            <Card><CardBody className="py-10 text-center text-sm text-ink-500">No driver applications to review.</CardBody></Card>
          ) : data.applications.map((application) => {
            const reason = reasons[application.driverId] ?? "";
            const documents = application.documents;
            return (
              <Card key={application.driverId}>
                <CardHeader
                  title={<span>{application.driver.user.name} <span className="font-normal text-ink-500">· {application.driver.user.email}</span></span>}
                  subtitle={`${application.driver.vehicleType} · Updated ${new Date(application.updatedAt).toLocaleString()}`}
                  action={<Badge tone={application.status === "APPROVED" ? "success" : application.status === "REJECTED" || application.status === "REVOKED" || application.status === "EXPIRED" ? "danger" : "warning"}>{application.status.replace(/_/g, " ")}</Badge>}
                />
                <CardBody className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge tone={application.safetyTrainingComplete ? "success" : "warning"}>Safety training {application.safetyTrainingComplete ? "complete" : "incomplete"}</Badge>
                    <Badge tone={application.bankAccountLast4 ? "success" : "warning"}>{application.bankAccountLast4 ? `Bank account ···· ${application.bankAccountLast4}` : "Bank account missing"}</Badge>
                    {application.bankIfsc ? <Badge tone="neutral">IFSC {application.bankIfsc}</Badge> : null}
                  </div>
                  {application.adminComments ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Previous review: {application.adminComments}</p> : null}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {documents.map((document) => (
                      <div key={document.id} className="rounded-xl border border-ink-200 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink-800">{document.type.replace(/_/g, " ")}</p>
                            <p className="truncate text-xs text-ink-500">{document.originalName}</p>
                            {document.expiryDate ? <p className="mt-1 text-xs text-ink-500">Expires {new Date(document.expiryDate).toLocaleDateString()}</p> : null}
                            {document.rejectionReason ? <p className="mt-1 text-xs text-red-700">{document.rejectionReason}</p> : null}
                          </div>
                          <Badge tone={document.status === DocumentReviewStatus.APPROVED ? "success" : document.status === DocumentReviewStatus.REJECTED ? "danger" : "warning"}>{document.status}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => void openDocument(document.id)}>Preview</Button>
                          {application.status === "UNDER_REVIEW" && document.status !== DocumentReviewStatus.APPROVED ? <Button size="sm" loading={busy === document.id} onClick={() => void run(document.id, () => adminApi.reviewDriverDocument(document.id, true))}>Approve</Button> : null}
                          {application.status === "UNDER_REVIEW" && document.status !== DocumentReviewStatus.REJECTED ? <Button variant="danger" size="sm" loading={busy === document.id} onClick={() => void run(document.id, () => adminApi.reviewDriverDocument(document.id, false, reason))}>Reject</Button> : null}
                        </div>
                      </div>
                    ))}
                    {documents.length === 0 ? <p className="text-sm text-ink-500">No documents uploaded yet.</p> : null}
                  </div>
                  <label className="block text-sm font-medium text-ink-700">
                    Review reason / requested changes
                    <textarea value={reason} onChange={(event) => setReasons((current) => ({ ...current, [application.driverId]: event.target.value }))} rows={2} maxLength={500} className="mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-sm" placeholder="Required for rejection, changes requested, or revocation." />
                  </label>
                  {application.status === "UNDER_REVIEW" ? <div className="flex flex-wrap gap-2">
                    <Button size="sm" loading={busy === application.driverId} onClick={() => void run(application.driverId, () => adminApi.reviewDriverApplication(application.driverId, "approve"))}>Approve application</Button>
                    <Button variant="secondary" size="sm" loading={busy === application.driverId} disabled={!reason.trim()} onClick={() => void run(application.driverId, () => adminApi.reviewDriverApplication(application.driverId, "request_changes", reason))}>Request changes</Button>
                    <Button variant="danger" size="sm" loading={busy === application.driverId} disabled={!reason.trim()} onClick={() => void run(application.driverId, () => adminApi.reviewDriverApplication(application.driverId, "reject", reason))}>Reject application</Button>
                  </div> : null}
                  {application.status === "APPROVED" ? <Button variant="danger" size="sm" loading={busy === application.driverId} disabled={!reason.trim()} onClick={() => void run(application.driverId, () => adminApi.reviewDriverApplication(application.driverId, "revoke", reason))}>Revoke approval</Button> : null}
                </CardBody>
              </Card>
            );
          })}
          {data.history.length > 0 ? (
            <Card>
              <CardHeader title="Recent verification history" subtitle="Administrative actions are recorded for audit." />
              <CardBody><ul className="divide-y divide-ink-100">{data.history.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span><strong>{entry.actorName}</strong> · {entry.action.replace(/_/g, " ")}</span><time className="text-xs text-ink-500">{new Date(entry.createdAt).toLocaleString()}</time></li>)}</ul></CardBody>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
