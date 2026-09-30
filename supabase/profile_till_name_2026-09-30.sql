-- What the till calls this person, when it isn't the start of their name here.
--
-- The rota carries the whole name ("Natasha Gadsden") because payslips and
-- right-to-work checks need it; the till signs people on by what everyone
-- actually calls them ("Tash"). Six of the seven line up on their first name;
-- this is for the one that doesn't, and the next one like her.
alter table public.profiles add column if not exists till_name text;

comment on column public.profiles.till_name is
  'The display name this person uses on the till, when it is not the start of name. Used to credit till work (e.g. the cashing up) to the right person.';

update public.profiles set till_name = 'Tash' where name = 'Natasha Gadsden';
