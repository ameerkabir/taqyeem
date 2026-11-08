// Browser-safe: shared by the middleware that sets the header and the client code that reads it.

/** Sent on a rejection so clients can react without parsing the (translated) message. */
export const ACCESS_REASON_HEADER = "X-Access-Reason";
/** The caller is not a member of the board; the fix is the join form. */
export const NOT_MEMBER_REASON = "not_member";
