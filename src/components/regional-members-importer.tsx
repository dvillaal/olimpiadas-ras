'use client';

import { useState, useTransition } from 'react';
import { parseRegionalCsv, REGIONAL_MEMBER_COLUMNS, type RawRegionalRow } from '@/lib/import/regional-members';
import {
  confirmRegionalImportAction,
  previewRegionalImportAction,
  type RegionalImportPreview,
} from '@/app/admin/participantes/regional-members-actions';
import { Alert, Button, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toast';

/**
 * Carga de la base regional de miembros.
 *
 * Es el mismo reporte completo que reparte la región. Se sube una vez y se
 * vuelve a subir cuando llega una versión más nueva: se guarda por Id Scout
 * (upsert), así que repetir la carga actualiza en vez de duplicar.
 */
export function RegionalMembersImporter() {
  const [rows, setRows] = useState<RawRegionalRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<RegionalImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const reset = () => {
    setRows(null);
    setPreview(null);
    setFileName('');
    setParseError(null);
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setPreview(null);
    setFileName(file.name);

    try {
      let parsed: RawRegionalRow[];

      if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        const { parseXlsxColumns } = await import('@/lib/import/xlsx');
        parsed = await parseXlsxColumns(await file.arrayBuffer(), REGIONAL_MEMBER_COLUMNS);
      } else {
        parsed = parseRegionalCsv(await file.text());
      }

      if (parsed.length === 0) {
        setParseError(
          'No se encontraron filas con las columnas esperadas (ID SCOUT, NOMBRE, DOCUMENTO, etc.). Revisa que sea el reporte regional completo.',
        );
        setRows(null);
        return;
      }

      setRows(parsed);
      startTransition(async () => {
        setPreview(await previewRegionalImportAction(parsed));
      });
    } catch (error) {
      setRows(null);
      setParseError(
        error instanceof Error
          ? `No se pudo leer el archivo: ${error.message}`
          : 'No se pudo leer el archivo.',
      );
    }
  };

  const confirm = () => {
    if (!rows) return;
    startTransition(async () => {
      const outcome = await confirmRegionalImportAction(rows);
      if (outcome.upserted > 0) toast.success(outcome.message);
      else toast.error(outcome.message);

      if (outcome.issues.length > 0) {
        setPreview((current) =>
          current ? { ...current, issues: outcome.issues, validCount: 0 } : current,
        );
      } else {
        reset();
      }
    });
  };

  return (
    <div className="space-y-4">
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl
                   border-2 border-dashed border-line bg-canvas px-6 py-8 text-center
                   transition-colors hover:border-scout-400 hover:bg-scout-50"
      >
        <span aria-hidden className="mb-2 text-3xl">
          🗂️
        </span>
        <span className="font-semibold text-navy">
          {fileName || 'Selecciona el reporte regional (.xlsx o .csv)'}
        </span>
        <span className="mt-1 text-sm text-slate-500">
          El archivo completo que reparte la región, con todos los miembros activos.
        </span>
        <input
          type="file"
          accept=".csv,.xlsx,.xlsm,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />
      </label>

      {parseError && <Alert tone="error">{parseError}</Alert>}

      {pending && !preview && (
        <p className="text-sm text-slate-500" aria-live="polite">
          Analizando el archivo…
        </p>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line p-3 text-center">
              <b className="block text-2xl text-navy">{preview.totalRows}</b>
              <span className="text-sm text-slate-500">Filas leídas</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <b className="block text-2xl text-emerald-800">{preview.validCount}</b>
              <span className="text-sm text-emerald-700">Listas para guardar</span>
            </div>
            <div
              className={`rounded-xl border p-3 text-center ${
                preview.issues.length > 0 ? 'border-red-200 bg-red-50' : 'border-line'
              }`}
            >
              <b
                className={`block text-2xl ${
                  preview.issues.length > 0 ? 'text-red-800' : 'text-navy'
                }`}
              >
                {preview.issues.length}
              </b>
              <span className="text-sm text-slate-600">Problemas</span>
            </div>
          </div>

          {preview.issues.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <b className="mb-3 block text-red-900">Filas con problemas</b>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm text-red-900">
                {preview.issues.slice(0, 60).map((issue, index) => (
                  <li key={`${issue.row}-${issue.column}-${index}`}>
                    <b>Fila {issue.row}</b> · {issue.column}: {issue.message}
                  </li>
                ))}
              </ul>
              {preview.issues.length > 60 && (
                <p className="mt-2 text-xs text-red-700">
                  …y {preview.issues.length - 60} más.
                </p>
              )}
              <p className="mt-3 text-sm text-red-800">
                Estas filas se omitirán. Puedes guardar las válidas ahora y corregir el resto después.
              </p>
            </div>
          )}

          {preview.sample.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-navy">Vista previa</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Id Scout</th>
                      <th>Nombre</th>
                      <th>Grupo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((item) => (
                      <tr key={item.row}>
                        <td className="text-slate-400">{item.row}</td>
                        <td>{item.scoutId}</td>
                        <td className="font-semibold text-navy">{item.fullName}</td>
                        <td>{item.groupName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={confirm} disabled={pending || preview.validCount === 0}>
              {pending ? 'Guardando…' : `Guardar ${preview.validCount} registro(s)`}
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!preview && !pending && !parseError && !fileName && (
        <EmptyState
          icon="🗂️"
          title="Sin archivo cargado"
          description="Súbelo la primera vez y vuelve a subirlo cuando llegue una versión más nueva: se actualiza por Id Scout."
        />
      )}
    </div>
  );
}
