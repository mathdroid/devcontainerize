# devcontainerize

A CLI tool to automatically convert any project into a [devcontainer-compatible](https://containers.dev/) project.

## Installation

```bash
npm install -g devcontainerize
```

## Usage

In your project directory, run:

```bash
npx devcontainerize
```

Optional: Add `--gitignore` flag to automatically update `.gitignore`.

## Features

- Automatically detects project type
- Supports multiple languages and frameworks
- Creates necessary devcontainer files
- Option to update .gitignore

## Demo

![Demo](recording.mov)

## Caveat

This tool relies on the structure and content of the GitHub repository:
https://github.com/devcontainers/images/tree/main/src

Changes to this repository may affect the tool's functionality.

## License

MIT
