# Install

There are two parts: the npm package (`@adukiorg/anza`) and the Rust CLI binary (`anza`). You need both.

---

## npm Package

```bash
npm install @adukiorg/anza
```

This installs the library source, type declarations, and the Node wrapper scripts that spawn the Rust binary.

---

## Rust CLI

The CLI is written in Rust. You can either build it from source or use a prebuilt binary.

### Build from source

Requires Rust >= 1.75 and Cargo.

```bash
cd tools
cargo build --release
```

The binary lands at `tools/target/release/anza`.

### Or use the Node wrapper

If you are developing inside the repo, the wrapper at `library/bin/anza/index.js` detects the platform and spawns the correct binary automatically. After building once:

```bash
node library/bin/anza/index.js --help
```

For published installs, prebuilt platform binaries ship alongside the wrapper.

---

## Verify

```bash
anza --help
```

You should see the command list: `scan`, `build`, `dev`, `doctor`, `create`.
