'use client';

import { useState, useTransition } from 'react';
import {
  buildTemplateCsv,
  issuesToCsv,
  parseCsv,
  type ImportIssue,
  type RawRow,
} from '@/lib/import/participants';
import {
  confirmImportAction,
  previewImportAction,
  type ImportPreview,
} from '@/app/admin/participantes/import-actions';
import { Alert, Button, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toast';
import { downloadBlob } from '@/lib/utils';

/**
 * Importador de participantes.
 *
 * El archivo nunca se sube: se analiza en el navegador y solo viajan las filas
 * ya estructuradas. Así la previsualización es instantánea y no se almacenan
 * datos personales que luego habría que borrar.
 */

export function ParticipantImporter({
  scope,
  groupCodes,
  branchIds,
}: {
  scope: 'admin' | 'group';
  groupCodes: { code: string; name: string }[];
  branchIds: string[];
}) {
  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
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
      let parsed: RawRow[];

      if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        // ExcelJS pesa bastante: se carga solo cuando de verdad hace falta.
        const { parseXlsx } = await import('@/lib/import/xlsx');
        parsed = await parseXlsx(await file.arrayBuffer());
      } else {
        parsed = parseCsv(await file.text());
      }

      if (parsed.length === 0) {
        setParseError('El archivo no tiene filas de datos debajo del encabezado.');
        setRows(null);
        return;
      }

      setRows(parsed);
      startTransition(async () => {
        setPreview(await previewImportAction(parsed, scope));
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
      const outcome = await confirmImportAction(rows, scope);
      if (outcome.inserted > 0) toast.success(outcome.message);
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

  const downloadIssues = (issues: readonly ImportIssue[]) => {
    downloadBlob(
      new Blob([issuesToCsv(issues)], { type: 'text/csv;charset=utf-8' }),
      'problemas_importacion.csv',
    );
  };

  const downloadTemplateCsv = () => {
    downloadBlob(
      new Blob([buildTemplateCsv()], { type: 'text/csv;charset=utf-8' }),
      'plantilla_participantes.csv',
    );
  };

  const downloadTemplateXlsx = () => {
    startTransition(async () => {
      const { buildTemplateXlsx } = await import('@/lib/import/xlsx');
      const buffer = await buildTemplateXlsx({ groupCodes, branchIds });
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        'plantilla_participantes.xlsx',
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={downloadTemplateXlsx} disabled={pending}>
          ⬇ Plantilla Excel
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={downloadTemplateCsv}>
          ⬇ Plantilla CSV
        </Button>
      </div>

      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl
                   border-2 border-dashed border-line bg-canvas px-6 py-8 text-center
                   transition-colors hover:border-scout-400 hover:bg-scout-50"
      >
        <span aria-hidden className="mb-2 text-3xl">
          📄
        </span>
        <span className="font-semibold text-navy">
          {fileName || 'Selecciona el archivo .xlsx o .csv'}
        </span>
        <span className="mt-1 text-sm text-slate-500">
          Se analiza en tu navegador: nada se envía hasta que confirmes.
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
              <span className="text-sm text-emerald-700">Listas para importar</span>
            </div>
            <div
              className={`rounded-xl border p-3 text-center ${
                preview.issues.length > 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-line'
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <b className="text-red-900">Filas con problemas</b>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadIssues(preview.issues)}
                >
                  ⬇ Descargar reporte
                </Button>
              </div>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto text-sm text-red-900">
                {preview.issues.slice(0, 60).map((issue, index) => (
                  <li key={`${issue.row}-${issue.column}-${index}`}>
                    <b>Fila {issue.row}</b> · {issue.column}: {issue.message}
                  </li>
                ))}
              </ul>
              {preview.issues.length > 60 && (
                <p className="mt-2 text-xs text-red-700">
                  …y {preview.issues.length - 60} más. Descarga el reporte para verlos todos.
                </p>
              )}
              <p className="mt-3 text-sm text-red-800">
                Estas filas se omitirán. Puedes importar las válidas ahora y corregir el resto
                después.
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
                      <th>Participante</th>
                      <th>Grupo</th>
                      <th>Rama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((item) => (
                      <tr key={item.row}>
                        <td className="text-slate-400">{item.row}</td>
                        <td className="font-semibold text-navy">{item.fullName}</td>
                        <td>{item.group}</td>
                        <td>{item.branch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={confirm} disabled={pending || preview.validCount === 0}>
              {pending ? 'Importando…' : `Importar ${preview.validCount} participante(s)`}
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!preview && !pending && !parseError && !fileName && (
        <EmptyState
          icon="📥"
          title="Sin archivo cargado"
          description="Descarga la plantilla, diligénciala y súbela aquí. Las observaciones pueden llevar comas y puntos y coma sin problema."
        />
      )}
    </div>
  );
}
