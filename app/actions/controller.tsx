import { createController } from "remix/router";
import { routes } from "../routes.ts";
import { HomePage } from "./home-page.tsx";

export default createController(
  { home: routes.home },
  {
    actions: {
      home(context) {
        return context.render(<HomePage i18n={context.i18n} />);
      },
    },
  },
);
