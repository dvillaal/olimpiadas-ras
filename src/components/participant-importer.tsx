'use client';

import { useRef, useState, useTransition } from 'react';
import {
  buildTemplateCsv,
  issuesToCsv,
  parseCsv,
  type ImportIssue,
  type ParticipantColumn,
  type RawRow,
} from '@/lib/import/participants';
import {
  confirmImportAction,
  previewImportAction,
  type ImportPreview,
} from '@/app/admin/participantes/import-actions';
import { Alert, Button, EmptyState, Field } from '@/components/ui';
import { useToast } from '@/components/toast';
import { downloadBlob } from '@/lib/utils';

/**
 * Importador de participantes.
 *
 * El archivo nunca se sube: se analiza en el navegador y solo viajan las
 * filas ya estructuradas. La previsualización muestra TODAS las filas (no
 * una muestra) y cada una se puede corregir ahí mismo — nombres, documento,
 * fecha de nacimiento, rama, género — sin tener que editar el archivo y
 * volver a subirlo. Cada corrección se revalida contra el servidor (con
 * un pequeño retraso mientras se sigue escribiendo), y el botón de importar
 * solo se habilita cuando ninguna fila tiene problemas: no se puede colar a
 * medias una fila incompleta.
 */

const REVALIDATE_DELAY_MS = 500;

export function ParticipantImporter({
  scope,
  groupCodes,
  branches,
  pinnableGroups,
}: {
  scope: 'admin' | 'group';
  groupCodes: { code: string; name: string }[];
  branches: { id: string; name: string }[];
  /**
   * Solo aplica cuando `scope === 'admin'`: permite fijar a mano el grupo de
   * todo el archivo, para el caso del archivo simple que entrega cada grupo
   * (sin columna CODIGO_GRUPO).
   */
  pinnableGroups?: { id: string; code: string | null; name: string }[];
}) {
  const [rows, setRows] = useState<RawRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [forcedGroupId, setForcedGroupId] = useState('');
  const [pending, startTransition] = useTransition();
  const [revalidating, setRevalidating] = useState(false);
  const revalidateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  const branchIds = branches.map((b) => b.id);
  const groupRequired = scope === 'admin' && Boolean(pinnableGroups && pinnableGroups.length > 0);
  const groupMissing = groupRequired && !forcedGroupId;

  const reset = () => {
    setRows(null);
    setPreview(null);
    setFileName('');
    setParseError(null);
    if (revalidateTimeout.current) clearTimeout(revalidateTimeout.current);
  };

  const revalidate = (nextRows: RawRow[]) => {
    startTransition(async () => {
      setPreview(await previewImportAction(nextRows, scope, forcedGroupId || undefined));
      setRevalidating(false);
    });
  };

  const scheduleRevalidate = (nextRows: RawRow[]) => {
    setRevalidating(true);
    if (revalidateTimeout.current) clearTimeout(revalidateTimeout.current);
    revalidateTimeout.current = setTimeout(() => revalidate(nextRows), REVALIDATE_DELAY_MS);
  };

  const updateCell = (rowIndex: number, column: ParticipantColumn, value: string) => {
    if (!rows) return;
    const next = rows.map((r, i) =>
      i === rowIndex ? { ...r, values: { ...r.values, [column]: value } } : r,
    );
    setRows(next);
    scheduleRevalidate(next);
  };

  const handleFile = async (file: File) => {
    if (groupMissing) {
      setParseError('Selecciona primero el grupo: sin él, la plataforma no sabe a quién pertenecen estas filas.');
      return;
    }

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
        setPreview(await previewImportAction(parsed, scope, forcedGroupId || undefined));
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
      const outcome = await confirmImportAction(rows, scope, forcedGroupId || undefined);

      // Un problema de inserción (violación de una restricción de la base de
      // datos, RLS, etc.) queda registrado como un issue de columna GENERAL:
      // sin mostrarlo, el administrador solo ve "se importaron 0" sin saber
      // por qué, aunque la previsualización no marcara ningún error.
      const generalIssue = outcome.issues.find((i) => i.column === 'GENERAL');
      const message = generalIssue ? `${outcome.message} ${generalIssue.message}` : outcome.message;

      if (outcome.inserted > 0) toast.success(message);
      else toast.error(message);

      if (outcome.issues.length > 0) {
        // Algo cambió entre la previsualización y la confirmación (otro
        // administrador importó lo mismo, por ejemplo): se refresca la
        // previsualización con el estado real en vez de dejar datos viejos.
        revalidate(rows);
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

  const allIssues = preview?.rows.flatMap((r) => r.issues) ?? [];
  const readyToImport = Boolean(preview && preview.totalRows > 0 && preview.validCount === preview.totalRows);

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

      {groupRequired && pinnableGroups && (
        <Field
          label="Grupo"
          htmlFor="forcedGroupId"
          hint="Todas las filas del archivo se asignan a este grupo. El archivo simple que entrega cada grupo no trae esa columna, así que la plataforma no tiene otra forma de saberlo."
          required
        >
          <select
            id="forcedGroupId"
            className="field-input"
            value={forcedGroupId}
            required
            onChange={(event) => {
              setForcedGroupId(event.target.value);
              // Si ya había un archivo analizado con el grupo anterior, se
              // descarta: la previsualización quedaría con el grupo equivocado.
              if (rows) reset();
            }}
          >
            <option value="" disabled>
              Selecciona un grupo…
            </option>
            {pinnableGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.code ? `${group.code} · ${group.name}` : group.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <label
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed
                   px-6 py-8 text-center transition-colors ${
                     groupMissing
                       ? 'cursor-not-allowed border-line bg-canvas opacity-50'
                       : 'cursor-pointer border-line bg-canvas hover:border-scout-400 hover:bg-scout-50'
                   }`}
      >
        <span aria-hidden className="mb-2 text-3xl">
          📄
        </span>
        <span className="font-semibold text-navy">
          {fileName || 'Selecciona el archivo .xlsx o .csv'}
        </span>
        <span className="mt-1 text-sm text-slate-500">
          {groupMissing
            ? 'Elige primero un grupo arriba.'
            : 'Se analiza en tu navegador: nada se envía hasta que confirmes.'}
        </span>
        <input
          type="file"
          accept=".csv,.xlsx,.xlsm,text/csv"
          className="sr-only"
          disabled={groupMissing}
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

      {preview && rows && (
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
                allIssues.length > 0 ? 'border-red-200 bg-red-50' : 'border-line'
              }`}
            >
              <b className={`block text-2xl ${allIssues.length > 0 ? 'text-red-800' : 'text-navy'}`}>
                {preview.totalRows - preview.validCount}
              </b>
              <span className="text-sm text-slate-600">Filas con problemas</span>
            </div>
          </div>

          {allIssues.length > 0 && (
            <Alert tone="error">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Corrige directamente en la tabla de abajo (fila resaltada en rojo). El botón de
                  importar se habilita cuando ninguna fila tenga problemas.
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => downloadIssues(allIssues)}>
                  ⬇ Descargar reporte
                </Button>
              </div>
            </Alert>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Nombres</th>
                  <th>Rama</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, index) => {
                  const rowPreview = preview.rows.find((p) => p.row === r.row);
                  const rowIssues = rowPreview?.issues ?? [];
                  const hasIssues = rowIssues.length > 0;
                  const issueFor = (column: string) =>
                    rowIssues.find((i) => i.column === column)?.message;
                  // Apellidos, tipo/número de documento, nacimiento, género y
                  // observaciones ya no tienen su propia columna editable
                  // (se completan solos desde la base regional), pero si algo
                  // falla ahí igual hay que poder verlo y corregirlo: se
                  // muestra debajo del nombre en vez de perderse.
                  const hiddenColumnIssues = rowIssues.filter((i) =>
                    ['APELLIDOS', 'TIPO_DOCUMENTO', 'NUMERO_DOCUMENTO', 'FECHA_NACIMIENTO', 'GENERO'].includes(
                      i.column,
                    ),
                  );

                  return (
                    <tr key={r.row} className={hasIssues ? 'bg-red-50' : undefined}>
                      <td className="text-slate-400">{r.row}</td>
                      <td>
                        <input
                          className="field-input min-w-32 text-sm"
                          value={r.values.NOMBRES ?? ''}
                          onChange={(e) => updateCell(index, 'NOMBRES', e.target.value)}
                        />
                        {issueFor('NOMBRES') && (
                          <p className="mt-1 text-xs text-red-700">{issueFor('NOMBRES')}</p>
                        )}
                        {hiddenColumnIssues.map((issue) => (
                          <p key={issue.column} className="mt-1 text-xs text-red-700">
                            {issue.message}
                          </p>
                        ))}
                      </td>
                      <td>
                        <select
                          className="field-input text-sm"
                          value={r.values.RAMA ?? ''}
                          onChange={(e) => updateCell(index, 'RAMA', e.target.value)}
                        >
                          <option value="">
                            {rowPreview?.resolved ? `(auto: ${rowPreview.resolved.branch})` : '(auto)'}
                          </option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        {issueFor('RAMA') && <p className="mt-1 text-xs text-red-700">{issueFor('RAMA')}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={confirm} disabled={pending || !readyToImport}>
              {pending
                ? 'Importando…'
                : readyToImport
                  ? `Importar ${preview.validCount} participante(s)`
                  : 'Corrige los problemas para importar'}
            </Button>
            <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
              Cancelar
            </Button>
            {revalidating && (
              <span className="text-sm text-slate-500" aria-live="polite">
                Revisando cambios…
              </span>
            )}
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
