import { FluentBundle } from '@fluent/bundle';
import { formatMessage, resource } from '../locale/fluent.ftl';

const bundle = new FluentBundle('en-US');
bundle.addResource(resource);
const message = formatMessage(bundle, 'hello', {}, null);

console.log(resource, bundle);
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Root element not found');
}

root.innerHTML = `
  <div>
  Message says: ${message}
  </div>
`;
