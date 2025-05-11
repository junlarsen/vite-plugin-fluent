import type {
  FluentBundle,
  FluentResource,
  FluentVariable,
} from '@fluent/bundle';
export declare const resource: FluentResource;
export declare function formatMessage(
  bundle: FluentBundle,
  id: 'hello',
  args: {
    readonly name: FluentVariable;
  },
  error?: null | Error[],
): string;
export declare function formatMessage(
  bundle: FluentBundle,
  id: 'cookies',
  args: {
    readonly count: 'one' | 'other';
  },
  error?: null | Error[],
): string;
