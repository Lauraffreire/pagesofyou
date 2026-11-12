-- Executar uma vez no SQL Editor do projeto Pages of You.
-- As contas são geridas pelo Supabase Auth, nunca por esta tabela.
begin;

create table public.poy_books (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  visibility text not null check (visibility in ('public', 'private')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  constraint book_id_matches check (data->>'id' is not null and data->>'id' = id),
  constraint book_owner_matches check (data->>'ownerId' is not null and data->>'ownerId' = owner_id::text),
  constraint book_visibility_matches check (data->>'visibility' is not null and data->>'visibility' = visibility)
);

create table public.poy_contributions (
  id text primary key,
  book_id text not null references public.poy_books(id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  constraint contribution_id_matches check (data->>'id' is not null and data->>'id' = id),
  constraint contribution_book_matches check (data->>'bookId' is not null and data->>'bookId' = book_id),
  constraint contribution_sender_matches check (data->>'senderId' is not null and data->>'senderId' = sender_id::text)
);

alter table public.poy_books enable row level security;
alter table public.poy_contributions enable row level security;

grant select on public.poy_books to anon, authenticated;
grant insert, update, delete on public.poy_books to authenticated;
grant select, insert, update on public.poy_contributions to authenticated;
revoke all on public.poy_contributions from anon;

create policy books_read on public.poy_books for select
  using (visibility = 'public' or owner_id = (select auth.uid()));
create policy books_create on public.poy_books for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy books_edit on public.poy_books for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy books_delete on public.poy_books for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy contributions_read on public.poy_contributions for select to authenticated
  using (sender_id = (select auth.uid()) or exists (
    select 1 from public.poy_books b where b.id = book_id and b.owner_id = (select auth.uid())
  ));
create policy contributions_send on public.poy_contributions for insert to authenticated
  with check (sender_id = (select auth.uid()) and status = 'pending' and exists (
    select 1 from public.poy_books b where b.id = book_id and b.visibility = 'public'
  ));
-- As decisões e cancelamentos passam por uma função; não há UPDATE direto.
revoke update on public.poy_contributions from authenticated;

create index poy_books_owner_idx on public.poy_books(owner_id);
create index poy_contributions_book_idx on public.poy_contributions(book_id);
create index poy_contributions_sender_idx on public.poy_contributions(sender_id);

commit;
