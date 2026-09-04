import { exportJson, exportPdf, exportSvg } from '../../engine/docket';
import { useCircuitStore } from '../../store/circuitStore';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Download the self-contained JSON document (circuit + results). */
export function downloadJson() {
  const { nodes, edges } = useCircuitStore.getState();
  downloadBlob(new Blob([exportJson(nodes, edges)], { type: 'application/json' }), 'circuit.json');
}

/** Download the SVG wiring diagram. */
export function downloadSvg() {
  const { nodes, edges } = useCircuitStore.getState();
  downloadBlob(new Blob([exportSvg(nodes, edges)], { type: 'image/svg+xml' }), 'circuit.svg');
}

/** Download the PDF wiring report. */
export async function downloadPdf() {
  const { nodes, edges } = useCircuitStore.getState();
  const doc = exportPdf(nodes, edges);
  downloadBlob(doc.output('blob'), 'wiring-docket.pdf');
}