import { clientEntry, type Handle, type RemixNode } from "remix/component";
import { draftForm } from "./draft-form.ts";
/** Keep a native edit form mounted, with drafts scoped to its original server version. */
export const DraftForm = clientEntry(
  "/app/ui/public/versioned-form.tsx#DraftForm",
  function DraftForm(
    handle: Handle<{
      action: string;
      storageKey: string;
      children?: RemixNode;
    }>,
  ) {
    return () => (
      <form
        method="post"
        action={handle.props.action}
        class="command-form"
        mix={draftForm(handle.props.storageKey)}
      >
        {handle.props.children}
      </form>
    );
  },
);
