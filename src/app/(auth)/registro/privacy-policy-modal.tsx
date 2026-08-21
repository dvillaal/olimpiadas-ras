'use client';

import { useEffect, useRef } from 'react';

/**
 * Aviso de tratamiento de datos personales de la Corporación Región
 * Antioquia Scout, en un modal accesible (<dialog> nativo: Escape y click
 * fuera lo cierran solos). El enlace se activa desde el checkbox de
 * autorización del formulario de registro.
 */
export function PrivacyPolicyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        // Cierra al hacer click en el backdrop (fuera de la tarjeta interna).
        if (event.target === ref.current) onClose();
      }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-navy/60"
    >
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <h2 className="text-lg font-extrabold text-navy">
          Autorización para el tratamiento de datos personales
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid size-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-slate-700">
        <p>
          La Corporación Región Antioquia Scout, interesada en velar por el respeto y protección de
          la información personal, y, en cumplimiento de las disposiciones contenidas en el
          artículo 15 de la Constitución Política, Ley 1581 de 2012, Decreto Reglamentario 1377 de
          2013, y demás normas que lo modifiquen, adicionen, complementen, deroguen o desarrollen,
          y, teniendo en cuenta el principio constitucional que tienen todas las personas a conocer,
          actualizar y rectificar todo tipo de información recogida o, que haya sido objeto de
          tratamiento de datos personales en bancos o bases de datos y, en general en archivos de
          entidades públicas y/o privadas, requiere obtener su autorización para que de manera
          libre, previa, expresa, voluntaria, y debidamente informada, permita a toda autoridad
          vertical u horizontal que por organigrama de la Corporación Región Antioquia Scout
          requiera para su misión; recolectar, recaudar, almacenar, usar, circular, suprimir,
          procesar, compilar, intercambiar, dar tratamiento, actualizar y disponer de los datos que
          han sido suministrados y que se han incorporado en distintas bases o bancos de datos, o en
          repositorios electrónicos de todo tipo con que cuenta la Corporación Región Antioquia
          Scout. La información es, y será utilizada en el desarrollo de las funciones propias de la
          Corporación Región Antioquia Scout, de forma directa o a través de terceros.
        </p>

        <p>
          La Corporación Región Antioquia Scout en los términos dispuestos por el Artículo 10 del
          Decreto 1377 de 2013 queda autorizada de manera expresa e inequívoca para mantener y
          manejar toda su información, a no ser que usted manifieste lo contrario de manera directa,
          expresa, inequívoca y por escrito dentro de los treinta (30) días contados a partir de la
          aceptación del aviso de la presente comunicación a la cuenta de correo electrónico
          dispuesta para tal efecto: comunicaciones@antioquiascout.org
        </p>

        <p>
          Consiento y autorizo de manera expresa e inequívoca que mi información personal sea
          tratada conforme a lo previsto en el presente documento. En el evento en que usted
          considere que la Corporación Región Antioquia Scout dio un uso contrario al autorizado y a
          las leyes aplicables, podrá contactarnos a través de una comunicación a
          comunicaciones@antioquiascout.org. El documento Políticas y Procedimientos para el
          Tratamiento de Información Personal puede ser consultado en:
          comunicaciones@antioquiascout.org
        </p>
      </div>

      <div className="flex justify-end border-t border-line px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-scout-600 px-4 py-2 text-sm font-semibold text-white hover:bg-scout-700"
        >
          Entendido
        </button>
      </div>
    </dialog>
  );
}
