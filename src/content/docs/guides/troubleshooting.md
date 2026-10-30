---
title: Troubleshooting
description: What the errors of Vigie mean, at start, on a reload and in the answer of /services, and how to fix them.
sidebar:
  order: 9
tags: [operations]
---

Start with the page at the root of the server. It shows each service with the endpoints it gives right now, or the error
of its source in red. Then look at the logs of the process, on its standard error.

## A key has no effect

`vigie serve` and a reload ignore the keys they don't know, so a misspelled key keeps its default. Run `vigie
check-config`, which refuses them:

```console
$ vigie check-config -c /etc/vigie/config.yml
vigie: error: invalid config /etc/vigie/config.yml: yaml: unmarshal errors:
                line 2: field listen_adr not found in type config.plain
```

When the key is right, check that it's one a reload applies. A change to `server` or `log` needs a restart, and so does
a change to `disable_reload_by_request`.

## The endpoints are old

Vigie keeps each answer for the `cache_ttl` of the service, 5 seconds by default, so a change shows up to that time
later. A client also polls at its own pace, such as the `refresh_rate` of a Flock backend, which adds to the delay.

A change to the configuration file itself needs a reload. Without one, Vigie keeps serving the services it loaded.

## A reload doesn't apply

`POST /reload` answers `422 services not reloaded:` with the cause, and a `SIGHUP` logs it with `read config` or `load
services`. In both cases Vigie keeps the previous services. Fix the file, check it with `vigie check-config`, and reload
again.

`POST /reload` answers `404` when the file sets `disable_reload_by_request: true`. Use `SIGHUP` instead, see [Reload the
services](/guides/reload-the-services/).

## A client refuses the endpoints

The Flock agent refuses an endpoint whose `ip` isn't an IP address. Vigie copies the host of the lines of a file, a
remote list or a TXT record without resolving it, so a line with a host name gives an `ip` that is a name. Write IP
addresses in those lines, and an IPv6 address in brackets with its port.
