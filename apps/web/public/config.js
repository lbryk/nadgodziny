// Runtime settings of the client. Replaced in the FTP/PHP package; safe to edit on the server.
//   api:    'path'  -> /api/config            (Node server)
//           'query' -> api/index.php?r=config (PHP hosting, no URL rewriting needed)
//   router: 'browser' -> /kalendarz           (needs the server to fall back to index.html)
//           'hash'    -> #/kalendarz          (works from any folder of any static host)
window.__NADGODZINY__ = { api: 'path', router: 'browser' };
