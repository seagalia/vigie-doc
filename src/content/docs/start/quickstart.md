---
title: Quickstart
description: Install Vigie, serve two services from a file and from DNS, query them, then change an endpoint and reload.
sidebar:
  order: 1
tags: [cli, configuration, http-api]
---

## Overview

This quickstart runs Vigie on your own machine with two services. It guides you through:

1. [Install the `vigie` binary](#install-the-vigie-binary).
2. [Write a configuration](#write-a-configuration).
3. [Start the server](#start-the-server).
4. [Query the services](#query-the-services).
5. [Change an endpoint](#change-an-endpoint).
6. [Clean up](#clean-up).

It's meant for anyone who wants to see Vigie answer before installing it on a server. It assumes you're at ease in a
terminal. [How Vigie works](/concepts/how-vigie-works/) explains the ideas behind what you run here.

## Before you start

You need:

- Linux or macOS, with `curl`.
- Port 8080 free on your machine.

## Install the `vigie` binary

1. Install the binary of the latest release with the install script.

    ```bash
    curl -fsSL https://seagalia.io/install.sh | sh -s -- vigie
    ```

    It puts `vigie` in `/usr/local/bin` or `~/.local/bin`, and warns when that directory isn't in your `PATH`. [Install
    with the script](/start/install/#install-with-the-script) describes its options.

2. Check the binary.

    ```bash
    vigie version
    ```

3. Make a directory for the files of this quickstart.

    ```bash
    mkdir vigie-quickstart
    cd vigie-quickstart
    ```

## Write a configuration

1. Write the endpoints of a first service in a file, one per line.

    ```text title="web.txt"
    # web servers
    10.0.0.5
    10.0.0.6:8081
    10.0.0.7:8080#3
    ```

    A line without a port takes the default port of the service, and `#3` gives the endpoint a weight of 3. [Endpoint
    lines](/reference/configuration/#endpoint-lines) describes the format.

2. Write the configuration, with the service `web` read from that file and the service `local` read from DNS. A relative
   `path` starts from the directory you run `vigie` in.

    ```yaml title="config.yml"
    server:
      listen_addr: 127.0.0.1:8080
    services:
      - name: web
        default_port: 8080
        file:
          path: web.txt
      - name: local
        default_port: 9000
        dns:
          name: localhost
    ```

3. Check the file.

    ```bash
    vigie check-config -c config.yml
    ```

    The command prints `config <path> is valid`, with the absolute path of the file. It also refuses the keys it doesn't
    know, where `serve` ignores them.

## Start the server

Start the server in its own terminal:

```bash
vigie serve -c config.yml
```

It logs `Listening` with the address it listens on, and keeps running until you stop it.

## Query the services

1. Ask for the endpoints of `web`.

    ```bash
    curl -s 'http://127.0.0.1:8080/services?service_name=web'
    ```

    ```json
    [
      {
        "ip": "10.0.0.5",
        "port": 8080,
        "load_balancing_weight": 0
      },
      {
        "ip": "10.0.0.6",
        "port": 8081,
        "load_balancing_weight": 0
      },
      {
        "ip": "10.0.0.7",
        "port": 8080,
        "load_balancing_weight": 3
      }
    ]
    ```

2. Ask for `local`. It gives each address of `localhost` on port 9000, such as `127.0.0.1` and `::1`.

    ```bash
    curl -s 'http://127.0.0.1:8080/services?service_name=local'
    ```

3. Open `http://127.0.0.1:8080/` in a browser. The page lists both services with their endpoints, as [Web
   page](/reference/web-page/) describes.

## Change an endpoint

Vigie reads the file again once the answer it keeps in cache is older than 5 seconds, so a change to the endpoints needs
no reload.

1. Add a line to `web.txt`.

    ```bash
    echo '10.0.0.8:8080' >> web.txt
    ```

2. Wait 5 seconds, then ask for `web` again. The answer holds a fourth endpoint.

    ```bash
    curl -s 'http://127.0.0.1:8080/services?service_name=web'
    ```

A change to the configuration itself, such as a new service, needs a reload.

1. Add a third service at the end of `config.yml`.

    ```yaml title="config.yml" ins={12-15}
    server:
      listen_addr: 127.0.0.1:8080
    services:
      - name: web
        default_port: 8080
        file:
          path: web.txt
      - name: local
        default_port: 9000
        dns:
          name: localhost
      - name: default
        default_port: 8080
        file:
          path: web.txt
    ```

    The service named `default` answers the requests that give no `service_name`.

2. Reload the services.

    ```bash
    curl -s -X POST http://127.0.0.1:8080/reload
    ```

    Vigie answers `services reloaded`. When the new file is invalid, it answers `422` with the error and keeps the
    services it had.

3. Ask for the endpoints without a service name.

    ```bash
    curl -s http://127.0.0.1:8080/services
    ```

## Clean up

Stop the server with `Ctrl+C`, then remove the directory of the quickstart.

```bash
cd ..
rm -r vigie-quickstart
```

The binary stays installed. To remove it as well, run `rm "$(command -v vigie)"`.

## Next steps

- [Install Vigie](/start/install/) on a server, as a systemd service or in a container.
- [Reload the services](/guides/reload-the-services/) explains `SIGHUP` and why to turn `POST /reload` off on a shared
  network.
- [Configuration](/reference/configuration/) lists every key of the file.
