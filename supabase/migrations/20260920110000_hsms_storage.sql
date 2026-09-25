-- Private bucket for HSMS JSON documents and group-chat media.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hsms-md',
  'hsms-md',
  false,
  52428800,
  array['application/json', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;
