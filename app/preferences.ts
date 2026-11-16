import { createCookie } from "remix/cookie";
export const appearanceCookie = createCookie("taqyeem_appearance", {
  encode: encodeURIComponent,
  decode: decodeURIComponent,
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  maxAge: 31536000,
});
