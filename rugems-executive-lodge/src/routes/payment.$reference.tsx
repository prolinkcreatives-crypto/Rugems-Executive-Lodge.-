import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Check, Upload, Copy, Shield, Smartphone, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Reveal, StaggerWords, GoldHairline, cinematic } from "@/components/motion";
import { getBookingByReference, submitPayment } from "@/lib/atelier.functions";
import { BUSINESS } from "@/lib/business";

export const Route = createFileRoute("/payment/$reference")({
  head: () => ({ meta: [{ title: `Secure your Stay · ${BUSINESS.name}` }] }),
  component: PaymentPage,
});

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// Checked against both MIME type and file extension — accept's own filter
// is advisory only and doesn't apply to drag-and-drop, so this is the real
// gate regardless of how the file arrived.
function isAllowedImage(f: File): boolean {
  if (ALLOWED_IMAGE_TYPES.includes(f.type)) return true;
  const name = f.name.toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function paymentBlockingReason(txnId: string, file: File | null): string | null {
  if (!txnId.trim()) return "Please enter your Airtel Money transaction ID.";
  if (!file) return "Please upload a screenshot of your successful transaction.";
  return null;
}

function PaymentPage() {
  const { reference } = Route.useParams();
  const getBooking = useServerFn(getBookingByReference);
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", reference],
    queryFn: () => getBooking({ data: { reference } }),
  });

  const submit = useServerFn(submitPayment);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [txnId, setTxnId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Object URLs must be explicitly revoked or the underlying blob stays in
  // memory for the life of the page. Create one whenever the file changes,
  // revoke the previous one on cleanup (covers replace, remove, and unmount).
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const paymentIssue = paymentBlockingReason(txnId, file);

  const copy = (v: string, label: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`${label} copied`);
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!isAllowedImage(f)) return toast.error("Please upload a JPG, PNG, or WEBP image.");
    if (f.size > 5 * 1024 * 1024) return toast.error("Under 5 MB, please");
    setFile(f);
  };

  const removeFile = () => {
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const upload = async () => {
    if (!file || !txnId || !booking) return;
    setSubmitting(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      await submit({
        data: {
          reference: booking.reference,
          paymentReference: txnId,
          proofBase64: dataUrl,
          proofFileName: file.name,
        },
      });
      toast.success("Payment submitted — pending verification.");
      navigate({ to: "/confirmation/$reference", params: { reference: booking.reference } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Nav />
        <div className="pt-40 min-h-screen text-center">
          <motion.div
            className="mx-auto h-10 w-10 rounded-full border-2 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
          />
        </div>
      </>
    );
  }
  if (!booking) {
    return (
      <>
        <Nav />
        <div className="pt-40 min-h-screen text-center px-6">
          <h1 className="text-headline-lg font-display text-primary">Reservation not found.</h1>
          <Link to="/book" className="mt-6 inline-block text-label-caps text-primary underline">Begin a new reservation</Link>
        </div>
      </>
    );
  }

  if (booking.status !== "pending_payment") {
    const isCancelled = booking.status === "cancelled";
    return (
      <>
        <Nav />
        <div className="pt-40 min-h-screen text-center px-6">
          <h1 className="text-headline-lg font-display text-primary">
            {isCancelled ? "This reservation was cancelled." : "Payment already submitted."}
          </h1>
          <p className="text-body-md text-on-surface-variant mt-4 max-w-md mx-auto">
            {isCancelled
              ? "This reservation is no longer active. Please start a new booking if you'd still like to stay with us."
              : "We've already received your payment proof for this reservation — it's awaiting our team's verification."}
          </p>
          {isCancelled ? (
            <Link to="/book" className="mt-6 inline-block text-label-caps text-primary underline">
              Begin a new reservation
            </Link>
          ) : (
            <Link
              to="/confirmation/$reference"
              params={{ reference: booking.reference }}
              className="mt-6 inline-block text-label-caps text-primary underline"
            >
              View your confirmation
            </Link>
          )}
        </div>
        <Footer />
      </>
    );
  }

  const rows: [string, string][] = [
    ["Payment method", BUSINESS.payment.method],
    ["Send money to", BUSINESS.payment.sendNumber],
    ["Account name", BUSINESS.payment.accountName],
    ["Alternative withdrawal", BUSINESS.payment.altWithdrawalNumber],
    ["Reference", booking.reference],
    ["Amount", `K${booking.total_amount.toLocaleString()}`],
  ];

  return (
    <>
      <Nav />
      <div className="pt-32 md:pt-40 pb-24 min-h-screen bg-surface">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <Reveal>
            <span className="text-label-caps text-gold">Step 4 of 4 — Secure your stay</span>
          </Reveal>
          <StaggerWords
            text="A quiet handshake."
            as="h1"
            delay={0.15}
            className="text-headline-lg font-display text-primary mt-4"
          />
          <div className="mt-4 mb-14"><GoldHairline /></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: cinematic }}
              className="bg-surface-container-lowest p-8 md:p-10 gold-hairline shadow-ambient"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-label-caps text-gold">Airtel Money</p>
                  <h2 className="text-headline-md font-display text-primary">Manual Payment</h2>
                </div>
              </div>
              <p className="text-body-md text-on-surface-variant mt-4 mb-6">
                Send the total via <strong className="text-primary">Airtel Money</strong> to the number
                below. The account name is{" "}
                <strong className="text-primary">{BUSINESS.payment.accountName}</strong>. After
                sending, upload your Airtel Money screenshot and the transaction ID so our team can
                verify your booking.
              </p>

              <ol className="space-y-3 mb-8">
                {[
                  "Send the total amount using Airtel Money.",
                  "Take a screenshot of the successful transaction.",
                  "Enter the Airtel transaction reference.",
                  "Upload the payment screenshot.",
                  "Submit for manual verification.",
                ].map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-fixed/60 border border-gold/40 text-label-caps text-primary flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-body-md text-on-surface-variant pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>

              {/* Prominent account name band */}
              <div className="rounded-md bg-primary-fixed/50 border border-gold/40 p-5 mb-6">
                <p className="text-label-caps text-on-surface-variant">Account name</p>
                <p className="text-headline-md font-display text-primary mt-1">
                  {BUSINESS.payment.accountName}
                </p>
              </div>

              <ul className="divide-y divide-outline-variant">
                {rows.map(([k, v]) => (
                  <li key={k} className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-label-caps text-on-surface-variant">{k}</p>
                      <p className="text-body-md text-on-surface mt-1 font-mono break-all">{v}</p>
                    </div>
                    <button
                      onClick={() => copy(v, k)}
                      className="text-label-caps text-primary flex items-center gap-1 hover:opacity-70 transition-opacity flex-shrink-0"
                      aria-label={`Copy ${k}`}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-label-caps text-on-surface-variant mt-6 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-gold" />
                Held privately for our reservations team — verification within a few hours.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: cinematic, delay: 0.15 }}
              className="bg-surface-container-lowest p-8 md:p-10 gold-hairline shadow-ambient flex flex-col"
            >
              <h2 className="text-headline-md font-display text-primary">Confirm your Payment</h2>
              <p className="text-body-md text-on-surface-variant mt-2 mb-6">
                Once Airtel Money confirms the transfer, enter your transaction ID and upload the
                screenshot. Your booking will move to{" "}
                <strong className="text-primary">Pending Verification</strong> until we approve it.
              </p>
              <label htmlFor="txn-id" className="text-label-caps text-on-surface-variant block mb-2">
                Airtel Money transaction ID
              </label>
              <input
                id="txn-id"
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                disabled={submitting}
                placeholder="e.g. MP240712.1523.A00123"
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary transition-colors py-3 text-body-md outline-none mb-8 disabled:opacity-50"
              />

              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!submitting) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!submitting) handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => {
                  if (!submitting) fileRef.current?.click();
                }}
                disabled={submitting}
                aria-label={
                  file
                    ? `Selected file: ${file.name}. Click to choose a different screenshot.`
                    : "Upload payment screenshot. Click to browse, or drag and drop a file here."
                }
                className={
                  "w-full cursor-pointer rounded-md border-2 border-dashed p-10 text-center transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-60 " +
                  (dragging
                    ? "border-primary bg-primary-fixed/40"
                    : file
                      ? "border-gold bg-gold/5"
                      : "bg-transparent border-outline-variant hover:border-primary hover:bg-primary-fixed/20")
                }
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <AnimatePresence mode="wait">
                  {file && previewUrl ? (
                    <motion.div
                      key="file"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <img
                        src={previewUrl}
                        alt="Payment screenshot preview"
                        className="h-32 w-32 object-cover rounded-md shadow-ambient"
                      />
                      <p className="text-body-md text-primary mt-2 break-all">{file.name}</p>
                      <p className="text-label-caps text-on-surface-variant flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-gold" /> Ready to send
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="drop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-3 text-on-surface-variant"
                    >
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}>
                        <Upload className="h-6 w-6" />
                      </motion.div>
                      <p className="text-body-md">Drop your Airtel Money screenshot here</p>
                      <p className="text-label-caps">JPG, PNG, or WEBP — up to 5 MB</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {file && (
                <div className="flex items-center justify-center gap-6 mt-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={submitting}
                    className="text-label-caps text-primary underline underline-offset-4 hover:opacity-70 transition-opacity disabled:opacity-40"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={removeFile}
                    disabled={submitting}
                    className="text-label-caps text-destructive underline underline-offset-4 hover:opacity-70 transition-opacity disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              )}

              <PaymentNotice message={paymentIssue} />

              <button
                onClick={upload}
                disabled={submitting || paymentIssue !== null}
                aria-live="polite"
                aria-busy={submitting}
                className="group mt-6 inline-flex items-center justify-center gap-3 rounded-full bg-primary text-primary-foreground px-8 py-4 text-label-caps disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:shadow-ambient-lg transition-all duration-500"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Sending securely..." : "Submit for Verification"}
              </button>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

function PaymentNotice({ message }: { message: string | null }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {message && (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: cinematic }}
          className="mt-6 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-3 text-label-caps leading-relaxed text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
