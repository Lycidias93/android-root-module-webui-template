# Security policy

## Supported versions

Until a tagged stable release exists, only the latest default-branch core is
supported.

## Reporting

Do not publish a working exploit for the root API. Use a private GitHub security
advisory or contact the repository owner privately.

Include:

- affected core commit and version;
- Android/root-manager context;
- exact endpoint and request class;
- whether another local app, browser origin or network peer is required;
- minimal reproduction without private device data;
- proposed mitigation when known.

## Non-negotiable invariants

A change must not:

- bind outside exact IPv4 loopback;
- place bootstrap/session secrets in argv or persistent browser storage;
- add arbitrary shell execution or unrestricted filesystem paths;
- accept mutations without exact Origin and request-guard checks;
- write configuration without server and adapter validation;
- package live config, logs or secrets;
- keep the server running permanently;
- make WebUI availability a boot dependency;
- introduce remote scripts, fonts, analytics or CDN assets;
- advertise ABIs not built and verified.

See `docs/SECURITY_MODEL.md`.
