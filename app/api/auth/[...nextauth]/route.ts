// @MX:NOTE Auth.js v5 catch-all route. The `handlers` object exports both
// GET and POST so the framework's CSRF, callback, and provider endpoints
// resolve through a single file. REQ-FND-055.
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
