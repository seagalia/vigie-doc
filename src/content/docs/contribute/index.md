---
title: Contribute
description: Build and test Vigie from source, follow its code conventions, and send a change.
sidebar:
  order: 1
---

This page covers code changes to the [Vigie repository](https://github.com/seagalia/vigie). Before you contribute, read
its [code of conduct](https://github.com/seagalia/vigie/blob/main/CODE_OF_CONDUCT.md). It applies to every issue and
pull request, and to every discussion of the project.

## Layout

Vigie is one Go module, `github.com/seagalia/vigie`, and one binary, `vigie`.

| Directory | Holds |
|---|---|
| `main.go` | The command line, with `serve`, `check-config` and `version`. |
| `app/` | The HTTP server, its routes, and the reload by request and by `SIGHUP`. |
| `config/` | The YAML configuration, with the defaults and the checks of each type in its `UnmarshalYAML`. |
| `services/` | The four sources, the cache and the handler of `/services`. |
| `ui/` | The [web page](/reference/web-page/), plain HTML, CSS and JavaScript embedded in the binary, with no build step. |
| `logging/` | The zerolog setup. |
| `assets/` | The logos, the sample configuration and the systemd unit. |
| `e2e/` | The end-to-end tests of the `kubernetes` and `dns` sources. |

The answer of `GET /services` is read by the Flock agents and by meridian. Keep its JSON fields `ip`, `port` and
`load_balancing_weight` and its `service_name` parameter stable. The `eds=` prefix of the TXT records belongs to the
same contract, so change those clients in the same release if you change any of it.

## Before you start

Install these tools:

- Go, at the version of the `go` line of `go.mod`.
- Docker, for the tests that run in containers and for the image.
- golangci-lint v2 and [pre-commit](https://pre-commit.com/).

## Set up the repository

1. Clone the repository.

    ```bash
    git clone https://github.com/seagalia/vigie.git
    cd vigie
    ```

2. Install the pre-commit hooks, which run golangci-lint and the YAML and whitespace fixers before each commit.

    ```bash
    pip install pre-commit
    pre-commit install
    ```

3. Build and run the binary with a configuration of your own, starting from the sample.

    ```bash
    go build .
    cp assets/config.yml config.yml
    ./vigie serve -c config.yml
    ```

## Test your change

The tests use Ginkgo v2 and Gomega, with a `*_suite_test.go` in each package.

| Command | What it runs |
|---|---|
| `make test` | Every unit test on the current platform, with the race detector. |
| `make test-linux` | The same tests in a `golang:1.27` container, as in production. |
| `make test-e2e` | The `kubernetes` source against a kind cluster, and Consul through the `dns` source, in containers. Needs Docker and takes a few minutes. |
| `make lint` | golangci-lint, with the configuration CI uses. |

To run one package or one spec, call Ginkgo directly:

```bash
go tool ginkgo -r ./services
go tool ginkgo --focus "some describe text" ./app
```

Everything builds with `CGO_ENABLED=0`, which the Makefile exports. Only the unit tests turn cgo on, because the race
detector needs it on Linux. Never add a dependency that needs cgo.

## Code conventions

- Log with zerolog through `logging`. Get a component logger with `logging.Component("<name>")` and assign it to a
  variable before you call `.Info()`. Every log event ends with `Msg`, `Msgf` or `Send`, which `zerologlint` checks.
- Put the checks and the defaults of the configuration in the `UnmarshalYAML` of each type in `config/`.
- The brand assets of the page, in `ui/brand/`, come from the `exports/vigie` folder of the seagalia-brand kit.

## Send a change

1. Open an issue in the [GitHub issues](https://github.com/seagalia/vigie/issues) for a bug, with the output of `vigie
   version`, the configuration that fails, and what you expected.
2. Fork the repository and create a branch from `main`.
3. Make your change, with its tests and its documentation. The [configuration reference](/reference/configuration/) of
   this site follows `docs/configuration.md` of the repository, so change both.
4. Run `make lint` and `make test`, then open a pull request against `main`. CI runs the lint and the unit tests on it.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), such as `feat(services): …`,
`fix(config): …` or `docs: …`. Mark a breaking change with `!` after the type and a `BREAKING CHANGE:` footer.

## Releases

A tag `v*` pushed to the repository runs goreleaser. It publishes the archives of the binary for Linux and macOS on
`amd64` and `arm64`, with Windows zips, to the [GitHub releases](https://github.com/seagalia/vigie/releases), along with
`checksums.txt`.
