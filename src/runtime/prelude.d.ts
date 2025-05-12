import type {
  FluentBundle,
  FluentResource,
  FluentVariable,
} from '@fluent/bundle';

declare type UnionToIntersection<T> = (
  T extends any
    ? (x: T) => void
    : never
) extends (x: infer Inner) => void
  ? Inner
  : never;

declare type InferFormatterType<T extends Record<PropertyKey, unknown>> =
  UnionToIntersection<
    {
      [K in keyof T]: T[K] extends never
        ? (bundle: FluentBundle, id: K, error?: null | Error[]) => string
        : (
            bundle: FluentBundle,
            id: K,
            args: T[K],
            error?: null | Error[],
          ) => string;
    }[keyof T]
  >;
