drop trigger if exists trg_ai_inbox_new_budget_web_push on public.ai_inbox_items;

create trigger trg_ai_inbox_new_budget_web_push
after insert on public.ai_inbox_items
for each row
when (
  new.source = 'api'
  and new.source_message_id like 'budget_request:%'
  and (new.structured_data->>'type') = 'new_budget_request'
)
execute function public.dispatch_new_budget_web_push();
