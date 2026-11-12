-- Depois de 01-base-de-dados.sql, executar esta nova consulta no SQL Editor.
begin;

-- O responsável decide; o remetente pode cancelar. O bloqueio impede decisões
-- simultâneas e a memória é acrescentada na mesma transação que aceita o pedido.
create or replace function public.poy_decide(p_id text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  request public.poy_contributions;
  book public.poy_books;
begin
  if auth.uid() is null then raise exception 'Inicie sessão.'; end if;
  -- Ordem igual à publicação: livro primeiro, pedido depois, para evitar deadlocks.
  select b.* into book from public.poy_books b
    where b.id = (select c.book_id from public.poy_contributions c where c.id = p_id)
    for update;
  select * into request from public.poy_contributions where id = p_id for update;
  if request.id is null or book.id is null then raise exception 'Pedido não encontrado.'; end if;
  if request.status <> 'pending' then raise exception 'Este pedido já foi tratado. Atualize a página.'; end if;
  if p_status = 'cancelled' then
    if request.sender_id <> auth.uid() then raise exception 'Sem autorização.'; end if;
  elsif p_status in ('accepted', 'rejected') then
    if book.owner_id <> auth.uid() then raise exception 'Sem autorização.'; end if;
  else
    raise exception 'Estado inválido.';
  end if;
  if p_status = 'accepted' then
    update public.poy_books set
      data = jsonb_set(data, '{memories}', coalesce(data->'memories', '[]'::jsonb) ||
        jsonb_build_array(request.data || jsonb_build_object('locked', true))),
      updated_at = clock_timestamp()
      where id = book.id;
  end if;
  update public.poy_contributions set status = p_status,
    data = data || jsonb_build_object('status', p_status, 'decidedAt', clock_timestamp())
    where id = p_id;
end;
$$;
revoke all on function public.poy_decide(text, text) from public, anon;
grant execute on function public.poy_decide(text, text) to authenticated;

-- Uma operação da interface corresponde a uma transação: ou tudo é guardado,
-- ou nada é alterado. As tabelas continuam protegidas pelas políticas de RLS.
create or replace function public.poy_commit(p_changes jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  current_book public.poy_books;
  book_data jsonb;
begin
  if auth.uid() is null then raise exception 'Inicie sessão.'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_changes->'books', '[]'::jsonb)) loop
    book_data := item->'data';
    if book_data->>'ownerId' is distinct from auth.uid()::text then
      raise exception 'Sem autorização para este livro.';
    end if;
    select * into current_book from public.poy_books where id = book_data->>'id' for update;
    if current_book.id is null then
      if item->>'expected' is not null then raise exception 'O livro foi removido. Atualize a página.'; end if;
      insert into public.poy_books(id, owner_id, visibility, data)
        values (book_data->>'id', auth.uid(), book_data->>'visibility', book_data);
    else
      if current_book.owner_id <> auth.uid() then raise exception 'Sem autorização.'; end if;
      if item->>'expected' is null or current_book.updated_at <> (item->>'expected')::timestamptz then
        raise exception 'O livro foi alterado noutro dispositivo. Guarde o rascunho e atualize a página.';
      end if;
      update public.poy_books set visibility = book_data->>'visibility', data = book_data,
        updated_at = clock_timestamp() where id = current_book.id;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_changes->'deleted', '[]'::jsonb)) loop
    select * into current_book from public.poy_books where id = item->>'id' for update;
    if current_book.id is null or current_book.owner_id <> auth.uid() then raise exception 'Livro indisponível.'; end if;
    if item->>'expected' is null or current_book.updated_at <> (item->>'expected')::timestamptz then
      raise exception 'O livro foi alterado noutro dispositivo. Atualize antes de eliminar.';
    end if;
    delete from public.poy_books where id = current_book.id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_changes->'requests', '[]'::jsonb)) loop
    insert into public.poy_contributions(id, book_id, sender_id, status, data)
      values (item->>'id', item->>'bookId', auth.uid(), 'pending', item);
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_changes->'decisions', '[]'::jsonb)) loop
    perform public.poy_decide(item->>'id', item->>'status');
  end loop;
end;
$$;
revoke all on function public.poy_commit(jsonb) from public, anon;
grant execute on function public.poy_commit(jsonb) to authenticated;

commit;
