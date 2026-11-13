import { useEffect, useRef, type ReactNode } from "react";
import { X, ArrowUpRight, Package } from "lucide-react";
import { useStore, type Order } from "./store";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const { t } = useStore();
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <header>
          <h2>{title}</h2>
          <button
            className="icon"
            onClick={onClose}
            aria-label={t("Tutup", "Close")}
          >
            <X />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Empty({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <Package size={36} strokeWidth={1} />
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="button dark" onClick={onAction}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}
export function Status({ status }: { status: Order["status"] }) {
  const { t } = useStore();
  const labels = {
    processing: t("Diproses", "Processing"),
    shipped: t("Dikirim", "Shipped"),
    delivered: t("Selesai", "Delivered"),
    cancelled: t("Dibatalkan", "Cancelled"),
  };
  return <span className={`status ${status}`}>{labels[status]}</span>;
}
export function csvDownload(name: string, rows: (string | number)[][]) {
  const escape = (v: string | number) =>
    '"' +
    String(v)
      .replace(/^[=+@-]/, "'")
      .replaceAll('"', '""') +
    '"';
  const url = URL.createObjectURL(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
