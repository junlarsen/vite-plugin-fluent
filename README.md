# Vite Plugin Fluent

Vite plugin to transform Fluent files into JavaScript modules with inferred
TypeScript types. Never typo a translation key or translation argument again!

## Installation

```sh
pnpm install vite-plugin-fluent

# or using npm or yarn
npm install vite-plugin-fluent
yarn add vite-plugin-fluent
```

## Usage

Configure the Vite plugin in your `vite.config.ts` file. The plugin accepts no
options.

```ts
import { defineConfig } from "vite";
import { fluent  } from "vite-plugin-fluent";

export default defineConfig({
  plugins: [fluent()],
});
```

You can now import the Fluent file in your JavaScript or TypeScript files. The
plugin generates the corresponding `FluentResource` object, and a fully
type-safe `formatMessage` specific to the imported Fluent file.

```ftl
# app.ftl
greet = Hello, { $name }!
```

```ts
import { resource, formatMessage } from "./app.ftl";
import { FluentBundle } from "@fluent/bundle";

const bundle = new FluentBundle("en-US");
bundle.addResource(resource);

// 100% type-safe!
const message = formatMessage(bundle, "greet", { name: "World" });

// The following will cause a type error because age is not a valid argument
const message = formatMessage(bundle, "greet", { name: "World", age: 42 });

// The following will cause a type error because welcome is not a valid message
const message = formatMessage(bundle, "welcome", { name: "World" });
```

## Selection Narrowing

By default, all variables are inferred as `FluentVariable` exported from 
`@fluent/bundle`. This means we can pass strings, dates, numbers, and even
Temporal objects. The extended `FluentType<T>` is also supported.

However, if the variable is used in a [selector][selector], the plugin will
narrow the type down to the alternatives presented in the selector.

```ftl
apples = I have { $count ->
    [one] one apple
   *[other] { $count } apples
}
```

```ts
// count is narrowed to the type 'one' | 'other'
formatMessage(bundle, "apples", { count: "one" });
```

## Zero argument inference

When a Fluent message has no variable expressions, the plugin will infer the
arguments as none. This means that the `formatMessage` function will not accept
arguments as its third argument, and the optional Error list will instead be
the third argument.

```ftl
demo = Look ma', no arguments!
```

```ts
formatMessage(bundle, "demo");
```

## Message Attributes

Fluent supports [message attributes][attribute] to add sub-messages to a
translation message for better organization. The plugin will provide the
attribute messages as "dot indexed" keys.

```ftl
choices = What do you want to do?
    .create = Create a new document
    .open = Open an existing document
```

```ts
formatMessage(bundle, "choices");
formatMessage(bundle, "choices.create");
formatMessage(bundle, "choices.open");
```

## Examples

See the [integration test suite][integration] files for complete examples of
FTL inputs and generated TypeScript .d.ts output.

## How does it work?

The plugin uses both the Fluent parser, and the TypeScript compiler API in order
to parse the Fluent file, and generate the corresponding TypeScript types.

Whenever a `.ftl` file is imported, the plugin performs the transform, as well
as outputting a `.d.ts` file with the corresponding types next to the `.ftl`
file. These `.d.ts` files do not need to be committed to version control, but
they are required for `tsc` to type-check the project. Therefore we suggest
adding them to git.

## Development

The plugin is easiest to test using the setup in the [e2e][e2e] folder. For
this, you'll want to link the plugin to the e2e folder.

```sh
cd e2e
pnpm link ..

# Start the Vite server
pnpm dev
```

The plugin also has good test coverage over the generated types and code, all of
which are runnable through Vitest.

```sh
pnpm test
```

## License

The project is licensed under the [Apache 2.0 License][license]

[attribute]: https://projectfluent.org/fluent/guide/attributes.html
[selector]: https://projectfluent.org/fluent/guide/selectors.html
[license]: ./LICENSE
[e2e]: ./e2e
[integration]: ./test/files
