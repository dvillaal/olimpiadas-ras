'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/toast';
import { downloadBlob } from '@/lib/utils';

/**
 * Exportaciones.
 *
 * Se generan en el navegador con los datos que ya vinieron renderizados: no
 * hace falta una segunda consulta ni un endpoint aparte.
 */

type Row = Record<string, string | number>;

export interface ExportData {
  participantes: Row[];
  pagos: Row[];
  equipos: Row[];
  grupos: Row[];
}

/** Escapa un valor para CSV según RFC 4180. */
function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0] as Row);
  const lines = [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(';')),
  ];
  // El BOM hace que Excel abra el archivo en UTF-8 y no rompa las tildes.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function ExportButtons({ data, eventName }: { data: ExportData; eventName: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const today = new Date().toISOString().slice(0, 10);

  const exportCsv = (key: keyof ExportData) => {
    const rows = data[key];
    if (rows.length === 0) {
      toast.error('No hay datos para exportar en esta sección.');
      return;
    }
    downloadBlob(
      new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }),
      `${key}_${today}.csv`,
    );
  };

  /** Libro con una hoja por sección: lo que normalmente pide la organización. */
  const exportWorkbook = () => {
    startTransition(async () => {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = eventName;
      workbook.created = new Date();

      const sheets: [keyof ExportData, string][] = [
        ['grupos', 'Grupos'],
        ['participantes', 'Participantes'],
        ['equipos', 'Equipos'],
        ['pagos', 'Pagos'],
      ];

      for (const [key, title] of sheets) {
        const rows = data[key];
        const sheet = workbook.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
        if (rows.length === 0) {
          sheet.addRow(['Sin datos']);
          continue;
        }

        const headers = Object.keys(rows[0] as Row);
        sheet.columns = headers.map((header) => ({
          header,
          key: header,
          width: Math.min(40, Math.max(12, header.length + 4)),
        }));

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF126B43' } };

        for (const row of rows) sheet.addRow(row);
        sheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: headers.length },
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `reporte_olimpiadas_${today}.xlsx`,
      );
      toast.success('Reporte descargado.');
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={exportWorkbook} disabled={pending}>
        {pending ? 'Generando…' : '⬇ Reporte completo (Excel)'}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => exportCsv('participantes')}>
        CSV participantes
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => exportCsv('pagos')}>
        CSV pagos
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => exportCsv('equipos')}>
        CSV equipos
      </Button>
    </div>
  );
}
