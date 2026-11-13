import { useEffect, useState } from "react";
import {
  DriverDocumentType,
  DriverOnboardingStatus,
  DocumentReviewStatus,
  type DriverOnboardingApplication,
} from "@ps02/shared";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Spinner } from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { driverApi } from "../../services/driverApi";
import { errorMessage } from "../../services/api";

const DOCUMENTS: { type: DriverDocumentType; label: string; expiry: boolean }[] = [
  { type: DriverDocumentType.DRIVING_LICENSE, label: "Commercial driving licence", expiry: true },
  { type: DriverDocumentType.TRANSPORT_BADGE, label: "Transport badge / licence class", expiry: true },
  { type: DriverDocumentType.AADHAAR, label: "Aadhaar document", expiry: false },
  { type: DriverDocumentType.PAN, label: "PAN document", expiry: false },
  { type: DriverDocumentType.PROFILE_PHOTO, label: "Driver profile photograph", expiry: false },
  { type: DriverDocumentType.POLICE_VERIFICATION, label: "Police verification certificate", expiry: true },
  { type: DriverDocumentType.VEHICLE_RC, label: "Vehicle registration certificate (RC)", expiry: false },
  { type: DriverDocumentType.INSURANCE, label: "Commercial vehicle insurance", expiry: true },
  { type: DriverDocumentType.PERMIT, label: "Contract carriage permit (if applicable)", expiry: true },
  { type: DriverDocumentType.FITNESS_CERTIFICATE, label: "Vehicle fitness certificate", expiry: true },
  { type: DriverDocumentType.PUC_CERTIFICATE, label: "Pollution under control certificate", expiry: true },
  { type: DriverDocumentType.OWNER_NOC, label: "Owner NOC / lease (if applicable)", expiry: false },
  { type: DriverDocumentType.BANK_PROOF, label: "Cancelled cheque / bank passbook proof", expiry: false },
  { type: DriverDocumentType.LIVE_SELFIE, label: "Live selfie", expiry: false },
];
const SAFETY_CHECKS = [
  ["seatbelts", "Seatbelts"],
  ["brakes", "Brakes"],
  ["lights", "Lights"],
  ["mirrors", "Mirrors"],
  ["ac", "Air conditioning"],
  ["gps", "GPS"],
  ["sos", "SOS / safety function"],
] as const;
const INITIAL_CHECKLIST = Object.fromEntries([
  ...SAFETY_CHECKS.map(([key]) => [key, false]),
  ["permitRequired", false],
  ["ownerNocRequired", false],
]);
const STATUS_TONE: Record<DriverOnboardingStatus, "neutral" | "warning" | "success" | "danger" | "info"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  DOCUMENTS_SUBMITTED: "info",
  UNDER_REVIEW: "warning",
  CHANGES_REQUESTED: "danger",
  APPROVED: "success",
  REVOKED: "danger",
  REJECTED: "danger",
  EXPIRED: "danger",
};

export function Onboarding() {
  const { data, loading, error, reload } = useAsync(
    () => driverApi.onboarding(),
    [],
  );
  const [application, setApplication] = useState<DriverOnboardingApplication | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(INITIAL_CHECKLIST);
  const [training, setTraining] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [documentType, setDocumentType] = useState<DriverDocumentType>(DOCUMENTS[0].type);
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.application) return;
    setApplication(data.application);
    setChecklist({ ...INITIAL_CHECKLIST, ...data.application.safetyChecklist });
    setTraining(data.application.safetyTrainingComplete);
    setIfsc(data.application.bankIfsc ?? "");
  }, [data]);

  const updateApplication = (next: DriverOnboardingApplication) => {
    setApplication(next);
    setChecklist({ ...INITIAL_CHECKLIST, ...next.safetyChecklist });
    setTraining(next.safetyTrainingComplete);
    setIfsc(next.bankIfsc ?? "");
    void reload();
  };

  const save = async () => {
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      const response = await driverApi.updateOnboarding({
        safetyChecklist: checklist,
        safetyTrainingComplete: training,
        ...(accountNumber ? { bankAccountNumber: accountNumber } : {}),
        ...(ifsc ? { bankIfsc: ifsc } : {}),
      });
      setApplication(response.application);
      setAccountNumber("");
      setMessage("Onboarding details saved. Bank account is stored encrypted; only its last four digits are shown.");
      void reload();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setActionError(null);
    setMessage(null);
    try {
      const selectedDoc = DOCUMENTS.find((document) => document.type === documentType);
      const response = await driverApi.uploadOnboardingDocument(
        documentType,
        file,
        selectedDoc?.expiry ? expiryDate : undefined,
      );
      updateApplication(response.application);
      setMessage("Document uploaded. Upload is not the same as admin verification.");
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await driverApi.submitOnboarding();
      updateApplication(response.application);
      setMessage("Application submitted for manual administrator review.");
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  const openDocument = async (documentId: string) => {
    try {
      const blob = await driverApi.downloadOnboardingDocument(documentId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  };

  const selectedDoc = DOCUMENTS.find((document) => document.type === documentType);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Driver onboarding" description="Submit your documents and vehicle safety details for manual administrator review." />
      {loading ? (
        <Card><CardBody className="flex justify-center py-12"><Spinner className="h-6 w-6" /></CardBody></Card>
      ) : error || !application ? (
        <Card><ErrorState message={error ?? "Onboarding application unavailable"} onRetry={() => void reload()} /></Card>
      ) : (
        <>
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">Application status</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[application.status]}>{application.status.replace(/_/g, " ")}</Badge>
                  {application.bankAccountLast4 ? <Badge tone="neutral">Bank account ···· {application.bankAccountLast4}</Badge> : null}
                </div>
                {application.adminComments ? <p className="mt-2 text-sm text-red-700">{application.adminComments}</p> : null}
              </div>
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-ink-500"><span>Completion</span><span>{application.completionPercent}%</span></div>
                <div className="mt-2 h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${application.completionPercent}%` }} /></div>
              </div>
            </CardBody>
          </Card>

          {actionError ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</p> : null}
          {message ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}

          <Card>
            <CardHeader title="Required documents" subtitle="PDF, JPEG or PNG; up to 5 MB each. Uploading does not verify a document." />
            <CardBody className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium text-ink-700">
                  Document type
                  <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DriverDocumentType)} className="mt-1 block h-11 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm">
                    {DOCUMENTS.map((document) => <option key={document.type} value={document.type}>{document.label}</option>)}
                  </select>
                </label>
                {selectedDoc?.expiry ? <Input label="Expiry date" type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /> : null}
              </div>
              <label className="block text-sm font-medium text-ink-700">
                Select document file
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700" />
              </label>
              {uploading ? <p className="text-xs text-ink-500">Uploading securely…</p> : null}
              <ul className="divide-y divide-ink-100">
                {DOCUMENTS.map((definition) => {
                  const document = application.documents.find((item) => item.type === definition.type);
                  return <li key={definition.type} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-ink-700">{definition.label}</span>
                    {document ? <div className="flex items-center gap-2">
                      <Badge tone={document.status === DocumentReviewStatus.APPROVED ? "success" : document.status === DocumentReviewStatus.REJECTED ? "danger" : "warning"}>{document.status}</Badge>
                      {document.expiryDate ? <span className="text-xs text-ink-500">Expires {new Date(document.expiryDate).toLocaleDateString()}</span> : null}
                      <button type="button" onClick={() => void openDocument(document.id)} className="text-xs font-medium text-brand-700">View</button>
                    </div> : <Badge tone="neutral">Missing</Badge>}
                  </li>;
                })}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vehicle safety and account setup" subtitle="All checklist items are required for approval." />
            <CardBody className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {SAFETY_CHECKS.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-ink-100 px-3 py-2 text-sm">
                  <input type="checkbox" checked={Boolean(checklist[key])} onChange={(event) => setChecklist((current) => ({ ...current, [key]: event.target.checked }))} />
                  {label} checked and working
                </label>)}
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={Boolean(checklist.permitRequired)} onChange={(event) => setChecklist((current) => ({ ...current, permitRequired: event.target.checked }))} />
                A contract carriage permit is required for this vehicle
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={Boolean(checklist.ownerNocRequired)} onChange={(event) => setChecklist((current) => ({ ...current, ownerNocRequired: event.target.checked }))} />
                The vehicle is leased or not driver-owned (owner NOC required)
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={training} onChange={(event) => setTraining(event.target.checked)} />
                I completed the required safety training
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Bank account number" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 20))} hint="Encrypted at rest; never displayed in full." placeholder={application.bankAccountLast4 ? `Saved account ending ${application.bankAccountLast4}` : "Enter 8–20 digits"} />
                <Input label="Bank IFSC" value={ifsc} onChange={(event) => setIfsc(event.target.value.toUpperCase().slice(0, 11))} placeholder="ABCD0123456" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" loading={saving} onClick={() => void save()}>Save progress</Button>
                <Button loading={submitting} disabled={application.status === DriverOnboardingStatus.UNDER_REVIEW || application.status === DriverOnboardingStatus.APPROVED} onClick={() => void submit()}>Submit for verification</Button>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
