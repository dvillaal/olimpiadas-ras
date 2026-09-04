'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Field } from '@/components/ui';
import { KNOWN_GROUP_NAMES } from '@/lib/domain/known-groups';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Combobox restringido: solo se puede escoger un nombre de la lista de
 * grupos conocidos por la organización, no escribir cualquier cosa. Lo que
 * se envía en el formulario (el input oculto "name") solo se llena cuando el
 * usuario elige una opción real; el input visible es únicamente para buscar.
 */
export function GroupNameField({ error }: { error?: string }) {
  const [query, setQuery] = useState('');
  const [committed, setCommitted] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [touchedInvalid, setTouchedInvalid] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const trimmedQuery = normalize(query.trim());
    if (!trimmedQuery) return KNOWN_GROUP_NAMES;
    return KNOWN_GROUP_NAMES.filter((name) => normalize(name).includes(trimmedQuery));
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        // Si se sale del campo sin escoger un nombre válido, se marca el error.
        setTouchedInvalid(query.trim().length > 0 && query !== committed);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [query, committed]);

  function choose(name: string) {
    setQuery(name);
    setCommitted(name);
    setTouchedInvalid(false);
    setOpen(false);
  }

  const localError = touchedInvalid ? 'Selecciona un grupo de la lista.' : undefined;

  return (
    <Field
      label="Nombre del grupo scout"
      htmlFor="nameSearch"
      error={error ?? localError}
      hint="Escribe para buscar tu grupo y selecciónalo de la lista."
      required
    >
      <div ref={rootRef} className="relative">
        <input type="hidden" name="name" value={committed} />
        <input
          id="nameSearch"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="field-input"
          placeholder="Busca tu grupo scout…"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            setHighlighted(0);
            // Si lo escrito ya no coincide con lo elegido, se descarta la
            // selección: no se puede enviar un nombre que no está en la lista.
            if (next !== committed) setCommitted('');
            setTouchedInvalid(false);
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
            No encontramos tu grupo. Revisa la ortografía o contacta a la organización si crees
            que falta en la lista.
          </div>
        )}
      </div>
    </Field>
  );
}
