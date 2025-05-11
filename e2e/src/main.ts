import { bundle, resource } from '../locale/fluent.ftl?locale=en-US';

console.log(resource, bundle);
const root = document.querySelector<HTMLDivElement>('#app');
if (!root) {
  throw new Error('Root element not found');
}

root.innerHTML = `
  <div>
  Hello world
  </div>
`;
