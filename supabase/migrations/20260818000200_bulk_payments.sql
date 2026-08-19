-- Permite registrar un solo comprobante/referencia que cubre varios conceptos
-- a la vez (equipo + individual + stand, por ejemplo), porque en la práctica
-- muchos grupos consignan todo junto en lugar de pagar por partes.

-- La referencia dejaba de servir como identificador único de una consignación
-- real: dos conceptos pagados juntos comparten la misma referencia bancaria.
-- Se relaja a "única por concepto" en vez de "única en toda la tabla".
alter table public.payments drop constraint payments_reference_key;
alter table public.payments
  add constraint payments_reference_payable_key unique (reference, payable_type, payable_id);

-- Variante de submit_payment que acepta una lista de conceptos y crea un
-- registro de pago por cada uno, todos con el mismo comprobante/referencia.
-- p_items: jsonb array de objetos { payableType, payableId, concept, expectedAmount }.
create or replace function public.submit_payment_bulk(
  p_items           jsonb,
  p_reported_amount numeric,
  p_payment_date    date,
  p_payer_name      text,
  p_payer_document  text,
  p_origin_bank     text,
  p_reference       text,
  p_proof_path      text,
  p_proof_name      text,
  p_proof_size      integer,
  p_notes           text default ''
)
returns setof public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group_id uuid := public.current_group_id();
  v_item     jsonb;
  v_payment  public.payments%rowtype;
  v_owner    uuid;
  v_payable_type public.payable_type;
  v_payable_id   uuid;
  v_expected_amount numeric;
  v_concept  text;
  v_count    integer := 0;
  v_share    numeric;
  v_total_expected numeric := 0;
begin
  if v_group_id is null then
    raise exception 'Solo un grupo scout puede registrar pagos.' using errcode = 'insufficient_privilege';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Selecciona al menos un concepto para pagar.' using errcode = 'invalid_parameter_value';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_total_expected := v_total_expected + (v_item->>'expectedAmount')::numeric;
  end loop;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_payable_type := (v_item->>'payableType')::public.payable_type;
    v_payable_id := (v_item->>'payableId')::uuid;
    v_expected_amount := (v_item->>'expectedAmount')::numeric;
    v_concept := v_item->>'concept';

    if v_payable_type = 'team' then
      select owner_group_id into v_owner from public.teams where id = v_payable_id;
    elsif v_payable_type = 'individual' then
      select group_id into v_owner from public.individual_registrations where id = v_payable_id;
    else
      select group_id into v_owner from public.stands where id = v_payable_id;
    end if;

    if v_owner is null or v_owner <> v_group_id then
      raise exception 'No puedes pagar un concepto que no pertenece a tu grupo.'
        using errcode = 'insufficient_privilege';
    end if;

    delete from public.payments
     where payable_type = v_payable_type
       and payable_id = v_payable_id
       and status in ('sent', 'correction', 'rejected');

    -- El valor reportado total se reparte a prorrata del valor esperado de
    -- cada concepto, para que la suma de las filas coincida con lo pagado.
    v_share := case
      when v_total_expected > 0 then round(p_reported_amount * v_expected_amount / v_total_expected, 2)
      else round(p_reported_amount / jsonb_array_length(p_items), 2)
    end;

    insert into public.payments (
      group_id, payable_type, payable_id, concept, expected_amount, reported_amount,
      payment_date, payer_name, payer_document, origin_bank, reference,
      proof_path, proof_name, proof_size, notes, status
    ) values (
      v_group_id, v_payable_type, v_payable_id, v_concept, v_expected_amount, v_share,
      p_payment_date, p_payer_name, coalesce(p_payer_document, ''), coalesce(p_origin_bank, ''),
      btrim(p_reference), p_proof_path, coalesce(p_proof_name, ''), coalesce(p_proof_size, 0),
      coalesce(p_notes, ''), 'sent'
    )
    returning * into v_payment;

    if v_payable_type = 'team' then
      update public.teams set status = 'payment_pending' where id = v_payable_id;
    elsif v_payable_type = 'individual' then
      update public.individual_registrations set status = 'payment_pending' where id = v_payable_id;
    else
      update public.stands set status = 'payment_pending' where id = v_payable_id;
    end if;

    perform public.log_audit('Envió el pago ' || p_reference, 'payment', v_payment.id::text,
                             jsonb_build_object('concept', v_concept));

    v_count := v_count + 1;
    return next v_payment;
  end loop;

  insert into public.notifications (group_id, title, body, link, kind)
  values (null, 'Nuevo pago por revisar',
          v_count || ' concepto(s) · referencia ' || p_reference,
          '/admin/pagos', 'info');

  return;
end;
$$;
