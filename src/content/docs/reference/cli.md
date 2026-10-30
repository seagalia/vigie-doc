---
title: Command line
description: The commands of the vigie binary, serve, check-config and version, with their flags and exit codes.
sidebar:
  order: 1
tags: [cli]
---

The `vigie` binary runs the server and checks its configuration. Run `vigie --help`, or `vigie <command> --help`, for
the same text in your terminal.

```text
Usage: vigie <command>

Commands:
  serve --config-path="./config.yml"
    Run the endpoint discovery server.

  check-config --config-path="./config.yml"
    Check a configuration file, unknown keys included, without running the
    server.

  version
    Show version.
```

Every command accepts `-h`/`--help`. A command that fails prints `vigie: error: <message>` and exits with code `1`.

## `vigie serve`

Runs the server with the configuration file, until the process is stopped.

| Flag | Default | Description |
|---|---|---|
| `-c`, `--config-path` | `./config.yml` | Path of the [configuration file](/reference/configuration/). |

`serve` ignores the keys of the file it doesn't know, so check the file with `check-config` first. It fails at start
when the file is invalid or one of its sources can't be built, such as a kubeconfig that can't be loaded. It also fails
when it can't listen on `server.listen_addr`.

Once started, the process reloads its services on `SIGHUP`, see [Reload the services](/guides/reload-the-services/). It
logs to the standard error, in text or in JSON as `log` sets.

## `vigie check-config`

Checks a configuration file without running the server, and prints `config <path> is valid` with the absolute path of
the file.

| Flag | Default | Description |
|---|---|---|
| `-c`, `--config-path` | `./config.yml` | Path of the configuration file. |

It runs the same checks as `serve`, and also refuses the keys it doesn't know, which `serve` ignores. It doesn't build
the sources, so it doesn't load the kubeconfig of a `kubernetes` source or read any source.

```console
$ vigie check-config -c /etc/vigie/config.yml
vigie: error: invalid config /etc/vigie/config.yml: yaml: unmarshal errors:
                line 2: field listen_adr not found in type config.plain
```

## `vigie version`

Prints the version of the binary with the commit and the date it was built from.

```console
$ vigie version
vigie 0.1.0, commit 3596a75, built at 2026-10-30T10:00:00Z
```

A binary built with `go build` without the release flags prints `vigie 0.0.1-dev, commit none, built at unknown`.
