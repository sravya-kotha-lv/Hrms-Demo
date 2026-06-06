import { useEffect, useMemo, useRef, useState } from "react";
import { getApiWithToken } from "@/services/apiWrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { buildMonthOptions, formatCurrency, type PayslipData } from "@/components/payroll/payrollShared";

type EmployeePayslipRun = {
  runId: string;
  runCode?: string;
  month: string;
  status?: string;
  employeeExternalId?: string;
};

const EmployeePayslips = () => {
  const [settings, setSettings] = useState<any>(null);
  const defaultMonths = useMemo(
    () =>
      buildMonthOptions({
        payrollCutoffDay: settings?.payrollCutoffDay,
        payrollSalaryPayDay: settings?.payrollSalaryPayDay
      }),
    [settings?.payrollCutoffDay, settings?.payrollSalaryPayDay]
  );
  const [monthOptions, setMonthOptions] = useState<string[]>(defaultMonths);
  const [month, setMonth] = useState(defaultMonths[0] || "");
  const [loading, setLoading] = useState(false);
  const [payslipData, setPayslipData] = useState<PayslipData | null>(null);
  const [monthsLoaded, setMonthsLoaded] = useState(false);
  const [runByMonth, setRunByMonth] = useState<Record<string, EmployeePayslipRun>>({});
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const loadSettings = async () => {
      const res = await getApiWithToken("/payroll/settings");
      if (res?.success) {
        setSettings(res.data || null);
      }
    };
    loadSettings();
  }, []);

  const loadPayslip = async (selectedMonth: string) => {
    if (!selectedMonth) return;
    const run = runByMonth[selectedMonth];
    if (!run?.runId) {
      setPayslipData(null);
      toast.error(`Payslip not available for ${selectedMonth}`);
      return;
    }

    const requestSeq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const res = await getApiWithToken(`/payroll/payslips/my/runs/${run.runId}`);
      if (requestSeq !== requestSeqRef.current) return;
      if (res?.success) {
        setPayslipData((res.data as PayslipData) || null);
      } else {
        setPayslipData(null);
        toast.error(res?.message || "Payslip not available for selected month");
      }
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const initMonths = async () => {
      try {
        const res = await getApiWithToken("/payroll/payslips/my/runs");
        const availableRuns = res?.success && Array.isArray(res?.data) ? res.data.filter(Boolean) : [];
        const nextRunMap: Record<string, EmployeePayslipRun> = {};
        const nextMonths: string[] = [];

        for (const row of availableRuns as EmployeePayslipRun[]) {
          const normalizedMonth = String(row?.month || "").trim();
          const normalizedRunId = String(row?.runId || "").trim();
          if (!normalizedMonth || !normalizedRunId) continue;
          if (!nextRunMap[normalizedMonth]) {
            nextRunMap[normalizedMonth] = row;
            nextMonths.push(normalizedMonth);
          }
        }

        if (nextMonths.length) {
          setRunByMonth(nextRunMap);
          setMonthOptions(nextMonths);
          setMonth(nextMonths[0]);
          return;
        }
        setMonthOptions(defaultMonths);
        setMonth(defaultMonths[0] || "");
      } finally {
        setMonthsLoaded(true);
      }
    };
    initMonths();
  }, [defaultMonths]);

  useEffect(() => {
    if (!monthsLoaded) return;
    if (!month) return;
    loadPayslip(month);
  }, [month, monthsLoaded, runByMonth]);

  const payslip = payslipData?.payslipJson;
  const fileMonth = payslip?.payMonth || month;
  const activeRun = runByMonth[fileMonth] || null;

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const getCanvasSafeImageSrc = async (src: string) => {
    if (!src) return "";
    if (src.startsWith("data:")) return src;
    try {
      const response = await fetch(src, { mode: "cors" });
      if (!response.ok) throw new Error("image fetch failed");
      const blob = await response.blob();
      return await blobToDataUrl(blob);
    } catch {
      try {
        const resolved = new URL(src, window.location.href);
        if (resolved.origin === window.location.origin) return resolved.toString();
      } catch {
        if (src.startsWith("/")) return src;
      }
      return "";
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      image.src = src;
    });

  const encodeText = (text: string) => {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
    return bytes;
  };

  const buildPdfBlobFromJpegPages = (pages: Array<{ width: number; height: number; jpegBytes: Uint8Array }>) => {
    const chunks: Uint8Array[] = [];
    const xrefOffsets: number[] = [0];
    let offset = 0;
    const pushChunk = (chunk: Uint8Array) => {
      chunks.push(chunk);
      offset += chunk.length;
    };
    const pushText = (text: string) => pushChunk(encodeText(text));
    const addObject = (objId: number, content: Uint8Array | string) => {
      xrefOffsets[objId] = offset;
      pushText(`${objId} 0 obj\n`);
      if (typeof content === "string") pushText(content);
      else pushChunk(content);
      pushText("\nendobj\n");
    };

    pushText("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const pageCount = pages.length;
    const catalogObjId = 1;
    const pagesObjId = 2;
    const firstPageObjId = 3;
    const firstContentObjId = firstPageObjId + pageCount;
    const firstImageObjId = firstContentObjId + pageCount;
    const kids = Array.from({ length: pageCount }, (_, i) => `${firstPageObjId + i} 0 R`).join(" ");
    addObject(catalogObjId, `<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`);
    addObject(pagesObjId, `<< /Type /Pages /Kids [ ${kids} ] /Count ${pageCount} >>`);

    const pageWidthPt = 595.28;
    const pageHeightPt = 841.89;
    const marginPt = 20;
    const maxDrawWidth = pageWidthPt - marginPt * 2;
    const maxDrawHeight = pageHeightPt - marginPt * 2;

    pages.forEach((page, index) => {
      const pageObjId = firstPageObjId + index;
      const contentObjId = firstContentObjId + index;
      const imageObjId = firstImageObjId + index;
      const scale = Math.min(maxDrawWidth / page.width, maxDrawHeight / page.height);
      const drawWidth = page.width * scale;
      const drawHeight = page.height * scale;
      const drawX = (pageWidthPt - drawWidth) / 2;
      const drawY = (pageHeightPt - drawHeight) / 2;
      const contentStream = `q\n${drawWidth.toFixed(3)} 0 0 ${drawHeight.toFixed(3)} ${drawX.toFixed(3)} ${drawY.toFixed(3)} cm\n/Im${index + 1} Do\nQ\n`;
      addObject(pageObjId, `<< /Type /Page /Parent ${pagesObjId} 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im${index + 1} ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`);
      addObject(contentObjId, `<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream`);

      xrefOffsets[imageObjId] = offset;
      pushText(`${imageObjId} 0 obj\n`);
      pushText(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`);
      pushChunk(page.jpegBytes);
      pushText("\nendstream\nendobj\n");
    });

    const xrefStart = offset;
    const objectCount = firstImageObjId + pageCount - 1;
    pushText(`xref\n0 ${objectCount + 1}\n`);
    pushText("0000000000 65535 f \n");
    for (let objectId = 1; objectId <= objectCount; objectId += 1) {
      pushText(`${(xrefOffsets[objectId] || 0).toString().padStart(10, "0")} 00000 n \n`);
    }
    pushText(`trailer\n<< /Size ${objectCount + 1} /Root ${catalogObjId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    return new Blob(chunks as BlobPart[], { type: "application/pdf" });
  };

  const pngToJpegPage = async (pngDataUrl: string) => {
    const img = await loadImage(pngDataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const response = await fetch(canvas.toDataURL("image/jpeg", 0.92));
    return {
      width: canvas.width,
      height: canvas.height,
      jpegBytes: new Uint8Array(await response.arrayBuffer())
    };
  };

  const renderPayslipCanvas = async () => {
    if (!payslip) throw new Error("No payslip data available");
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 2000;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f172a";

    const logoSrc = await getCanvasSafeImageSrc(String(payslip.company?.logoUrl || ""));
    if (logoSrc) {
      try {
        const logo = await loadImage(logoSrc);
        const maxLogoWidth = 220;
        const maxLogoHeight = 100;
        const scale = Math.min(maxLogoWidth / logo.naturalWidth, maxLogoHeight / logo.naturalHeight, 1);
        const drawWidth = logo.naturalWidth * scale;
        const drawHeight = logo.naturalHeight * scale;
        ctx.drawImage(logo, 90, 70, drawWidth, drawHeight);
      } catch {
        // Keep the PDF usable even if the logo cannot be loaded.
      }
    }

    ctx.font = "bold 34px Arial";
    ctx.fillText(String(payslip.company?.name || "Company"), 90, 220);
    ctx.font = "20px Arial";
    ctx.fillStyle = "#475569";
    ctx.fillText(`Payslip for ${payslip.payMonth || month}`, 90, 260);
    ctx.fillText(`Employee: ${payslip.employee?.name || "-"}`, 90, 295);
    ctx.fillText(`Employee Code: ${payslip.employee?.employeeCode || "-"}`, 90, 330);
    ctx.fillText(`Payroll Run: ${activeRun?.runCode || payslip.runId || "-"}`, 90, 365);
    ctx.fillText(`Status: ${activeRun?.status || payslip.payrollStatus || "-"}`, 90, 400);

    const cardY = 470;
    const cardHeight = 150;
    const cardGap = 30;
    const cardWidth = 280;
    const cards = [
      { label: "Gross Earnings", value: formatCurrency(Number(payslip.totals?.grossEarnings || 0)) },
      { label: "Total Deductions", value: formatCurrency(Number(payslip.totals?.totalDeductions || 0)) },
      { label: "Taxable Income", value: formatCurrency(Number(payslip.totals?.taxableIncome || 0)) },
      { label: "Net Pay", value: formatCurrency(Number(payslip.totals?.netPay || 0)) }
    ];
    cards.forEach((card, index) => {
      const x = 90 + (index % 2) * (cardWidth + cardGap);
      const y = cardY + Math.floor(index / 2) * (cardHeight + 24);
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#64748b";
      ctx.font = "18px Arial";
      ctx.fillText(card.label, x + 20, y + 48);
      ctx.fillStyle = card.label === "Net Pay" ? "#16a34a" : "#0f172a";
      ctx.font = "bold 28px Arial";
      ctx.fillText(card.value, x + 20, y + 92);
    });

    const drawSection = (title: string, rows: Array<{ code?: string; name?: string; amount?: number }>, startY: number) => {
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 24px Arial";
      ctx.fillText(title, 90, startY);
      let y = startY + 28;
      ctx.font = "18px Arial";
      rows.slice(0, 8).forEach((row) => {
        ctx.fillStyle = "#0f172a";
        ctx.fillText(`${row.name || row.code || "-"}`, 110, y);
        ctx.fillStyle = "#475569";
        ctx.fillText(formatCurrency(Number(row.amount || 0)), 1020, y);
        y += 28;
      });
      return y;
    };

    let sectionY = 800;
    sectionY = drawSection("Earnings", (payslip.earnings || []) as Array<{ code?: string; name?: string; amount?: number }>, sectionY);
    sectionY += 30;
    sectionY = drawSection("Deductions", (payslip.deductions || []) as Array<{ code?: string; name?: string; amount?: number }>, sectionY);

    ctx.fillStyle = "#64748b";
    ctx.font = "16px Arial";
    ctx.fillText("This is a system-generated payslip.", 90, 1870);
    ctx.fillText("For queries contact payroll/HR team.", 90, 1900);

    return canvas.toDataURL("image/jpeg", 0.95);
  };

  const downloadPdf = async () => {
    try {
      const pngDataUrl = await renderPayslipCanvas();
      const jpegPage = await pngToJpegPage(pngDataUrl);
      const pdfBlob = buildPdfBlobFromJpegPages([jpegPage]);
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `payslip-${fileMonth || "payroll"}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success("Payslip PDF downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Unable to generate PDF: ${message}`);
    }
  };

  const downloadJson = () => {
    if (!payslipData) return;
    const blob = new Blob([JSON.stringify(payslipData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payslip-${fileMonth}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const printPayslip = () => {
    if (!payslip) return;
    const content = `
      <html>
        <head>
          <title>Payslip ${fileMonth}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin: 0 0 8px; }
            .meta { margin-bottom: 16px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #f3f4f6; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          </style>
        </head>
        <body>
          <h1>${payslip.company?.name || "Company"} - Payslip</h1>
          <div class="meta">Month: ${payslip.payMonth || "-"} | Employee: ${payslip.employee?.name || "-"} (${payslip.employee?.employeeCode || "-"})</div>
          <div class="grid">
            <div><strong>Gross:</strong> ${formatCurrency(Number(payslip.totals?.grossEarnings || 0))}</div>
            <div><strong>Net:</strong> ${formatCurrency(Number(payslip.totals?.netPay || 0))}</div>
            <div><strong>Deductions:</strong> ${formatCurrency(Number(payslip.totals?.totalDeductions || 0))}</div>
            <div><strong>Taxable:</strong> ${formatCurrency(Number(payslip.totals?.taxableIncome || 0))}</div>
          </div>
          <h3>Earnings</h3>
          <table><thead><tr><th>Code</th><th>Name</th><th>Amount</th></tr></thead><tbody>
            ${(payslip.earnings || []).map((row: any) => `<tr><td>${row.code || "-"}</td><td>${row.name || "-"}</td><td>${formatCurrency(Number(row.amount || 0))}</td></tr>`).join("")}
          </tbody></table>
          <h3>Deductions</h3>
          <table><thead><tr><th>Code</th><th>Name</th><th>Amount</th></tr></thead><tbody>
            ${(payslip.deductions || []).map((row: any) => `<tr><td>${row.code || "-"}</td><td>${row.name || "-"}</td><td>${formatCurrency(Number(row.amount || 0))}</td></tr>`).join("")}
          </tbody></table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
    if (!printWindow) {
      toast.error("Unable to open print window");
      return;
    }
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Payslips</h1>
          <p className="text-sm text-muted-foreground">Month-wise salary slip from finalized payroll runs.</p>
        </div>
        <div className="w-[180px]">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
      ) : !payslip ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No payslip available for {month}.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {payslip.company?.logoUrl ? (
                  <img src={payslip.company.logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-slate-400">Logo</span>
                )}
              </div>
              <div className="space-y-1">
                <CardTitle>{payslip.employee?.name || "Employee"} - {payslip.payMonth}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {activeRun?.runCode ? `Payroll Run: ${activeRun.runCode}` : "Payroll run linked to this month"}
                  {activeRun?.status ? ` · ${activeRun.status}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadPdf}><Download className="h-4 w-4 mr-2" />Download PDF</Button>
              <Button variant="outline" size="sm" onClick={printPayslip}><Printer className="h-4 w-4 mr-2" />Print</Button>
              <Button size="sm" onClick={downloadJson}><Download className="h-4 w-4 mr-2" />JSON</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Gross Earnings</p><p className="font-semibold">{formatCurrency(Number(payslip.totals?.grossEarnings || 0))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Deductions</p><p className="font-semibold">{formatCurrency(Number(payslip.totals?.totalDeductions || 0))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Taxable Income</p><p className="font-semibold">{formatCurrency(Number(payslip.totals?.taxableIncome || 0))}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Net Pay</p><p className="font-semibold text-green-600">{formatCurrency(Number(payslip.totals?.netPay || 0))}</p></div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base">Earnings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(payslip.earnings || []).map((item: any) => (
                    <div key={`${item.code}-${item.name}`} className="flex items-center justify-between text-sm">
                      <span>{item.name || item.code || "-"}</span>
                      <span className="font-medium">{formatCurrency(Number(item.amount || 0))}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Deductions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(payslip.deductions || []).map((item: any) => (
                    <div key={`${item.code}-${item.name}`} className="flex items-center justify-between text-sm">
                      <span>{item.name || item.code || "-"}</span>
                      <span className="font-medium">{formatCurrency(Number(item.amount || 0))}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployeePayslips;
