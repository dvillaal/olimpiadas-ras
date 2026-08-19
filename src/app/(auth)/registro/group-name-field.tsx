'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Field } from '@/components/ui';

/**
 * Grupos scout ya conocidos por la organización, para que el responsable
 * pueda escoger el suyo en lugar de escribirlo desde cero (y así evitar
 * variaciones de un mismo nombre). El campo sigue siendo texto libre: si el
 * grupo no aparece en la lista, se puede escribir igual.
 */
const KNOWN_GROUPS = [
  'G.S 1 PRIMERO',
  'G.S 2 UPB',
  'G.S 3 GUACIRÍ',
  'G.S 3 QUIMBAYAS',
  'G.S 4 IV SAN IGNACIO',
  'G.S 5 KENYA',
  'G.S 6 CÓNDORES',
  'G.S 7 ANSALON DE KRYNN',
  'G.S 8 CATIOS',
  'G.S 8 AMANZI',
  'G.S 9 YGGDRASILL',
  'G.S 10 MAFEKING',
  'G.S 21 TAHAMIES',
  'G.S 22 NASSAU',
  'G.S 23 PIJAOS',
  'G.S 24 MOSQUETEROS',
  'G.S 28 NUSEDECHI',
  'G.S 30 XXX DE TAR',
  'G.S 31 KAYSEEPAX',
  'G.S 32 TUDOR',
  'G.S 33 HELADE',
  'G.S 44 EL DORADO',
  'G.S 49 FRANCISCO ZAPATA',
  'G.S 50 QUIMBAYA',
  'G.S 52 ANACONAS',
  'G.S 53 SAN FRANCISCO',
  'G.S 59 LOS DELFINES',
  'G.S 60 CÓNDORES',
  'G.S 61 ARKHIA',
  'G.S 66 QUIRAMAS',
  'G.S 69 WAYRA',
  'G.S 71 RAKUT',
  'G.S 76 SAN AGUSTIN',
  'G.S 95 UBUNTU CALATRAVA',
  'G.S 100 DEFENSORES MEDELLIN',
  'G.S 103 WATHABU',
  'G.S 105 ARDA UPB',
  'G.S 107 GALILEO',
  'G.S 108 SATTWA',
  'G.S 109 CHAKANA',
  'G.S 111 INTISANA',
  'G.S 112 KIMYARIPANDA',
  'G.S 114 CELTA',
  'G.S 126 KHYMERA CALASANZ',
  'G.S 127 VIKINGOS',
  'G.S 128 ABIRA',
  'G.S 131 JORGE COCK QUEVEDO',
  'G.S 138 ARAWAK',
  'G.S 142 FORJADORES',
  'G.S 145 KINICH AHAU',
  'G.S 157 BUENA AVENTURA',
  'G.S 164 LA CAMPIÑA',
  'G.S 168 EMMANUEL',
  'G.S 171 SALVADORES',
  'G.S 174 CAMELOT',
  'G.S 198 TITANES',
  'G.S 202 SANTA MARIA DE LA CANDELARIA',
  'G.S 210 ORION',
  'G.S 213 UCO',
  'G.S 421 HORIZONTES',
  'G.S 934 FAWKES',
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function GroupNameField({ error }: { error?: string }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = normalize(value.trim());
    if (!query) return KNOWN_GROUPS;
    return KNOWN_GROUPS.filter((name) => normalize(name).includes(query));
  }, [value]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function choose(name: string) {
    setValue(name);
    setOpen(false);
  }

  return (
    <Field
      label="Nombre del grupo scout"
      htmlFor="name"
      error={error}
      hint="Búscalo en la lista o escríbelo si no aparece."
      required
    >
      <div ref={rootRef} className="relative">
        <input
          id="name"
          name="name"
          required
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="field-input"
          placeholder="Grupo Scout Horizonte"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
              setOpen(true);
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlighted((i) => Math.min(i + 1, matches.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlighted((i) => Math.max(i - 1, 0));
            } else if (event.key === 'Enter' && open && matches[highlighted]) {
              event.preventDefault();
              choose(matches[highlighted]);
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />

        {open && matches.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-white py-1.5 shadow-lg"
          >
            {matches.map((name, index) => (
              <li key={name} role="option" aria-selected={index === highlighted}>
                <button
                  type="button"
                  className={`block w-full px-3.5 py-2 text-left text-sm ${
                    index === highlighted ? 'bg-scout-50 text-scout-700' : 'text-slate-700'
                  } hover:bg-scout-50 hover:text-scout-700`}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(name)}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {open && matches.length === 0 && (
          <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-slate-500 shadow-lg">
            No aparece en la lista: puedes escribirlo tal cual.
          </div>
        )}
      </div>
    </Field>
  );
}
