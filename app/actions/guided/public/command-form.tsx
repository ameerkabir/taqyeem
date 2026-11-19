import type { Handle, RemixNode } from "remix/component";
import type { ViewerPayload } from "../payload.ts";
import { routes } from "../../../routes.ts";
export interface CommandProps {
  data: ViewerPayload;
  kind: string;
  fields?: Record<string, string | number | boolean>;
  children?: RemixNode;
  draft?: string;
  id?: string;
}
export function CommandForm(handle: Handle<CommandProps>) {
  let id = crypto.randomUUID();
  return () => {
    let { data, kind, fields = {}, children, draft } = handle.props;
    return (
      <form
        id={handle.props.id}
        class="command-form"
        data-draft={draft}
        method="post"
        action={routes.sessionCommand.href({ boardId: data.board.id })}
      >
        <input type="hidden" name="id" defaultValue={id} />
        <input type="hidden" name="revision" value={data.revision} />
        <input type="hidden" name="kind" value={kind} />
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ))}
        {children}
      </form>
    );
  };
}
